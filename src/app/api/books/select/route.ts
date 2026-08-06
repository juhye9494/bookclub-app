import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { decryptOrderPii } from '@/lib/server/orderPiiCrypto';
import { encryptBookOrderPii } from '@/lib/server/bookOrderPiiCrypto';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { subOrderId, bookIds, deliveryNote } = body;

    if (!subOrderId) {
      return NextResponse.json({ error: '구독 주문 번호가 필요합니다.' }, { status: 400 });
    }

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return NextResponse.json({ error: '도서를 선택해주세요.' }, { status: 400 });
    }

    const uniqueIds = new Set(bookIds);
    if (uniqueIds.size !== bookIds.length) {
      return NextResponse.json({ error: '중복된 도서가 포함되어 있습니다.' }, { status: 400 });
    }

    let parsedDeliveryNote: string | null = null;
    if (deliveryNote !== undefined && deliveryNote !== null) {
      const trimmed = String(deliveryNote).trim();
      if (trimmed !== '') {
        if (trimmed.length > 200) {
          return NextResponse.json({ error: '배송 요청사항은 200자 이하로 입력해 주세요.' }, { status: 400 });
        }
        if (/[\r\n\t]/.test(trimmed)) {
          return NextResponse.json({ error: '배송 요청사항에 허용되지 않는 문자가 포함되어 있습니다.' }, { status: 400 });
        }
        parsedDeliveryNote = trimmed;
      }
    }

    // 1. 주문 소유권, 결제 상태 검사 및 암호화된 배송정보 조회
    const { data: orderData, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, payment_order_id, payment_status, user_name_enc, user_phone_enc, user_address_enc, pii_key_version, cycle_id, cycles(book_order_start_date)')
      .eq('id', subOrderId)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !orderData) {
      return NextResponse.json({ error: '주문 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    if (orderData.payment_status !== 'DONE') {
      return NextResponse.json({ error: '결제가 완료된 주문(DONE)에서만 신청할 수 있습니다.' }, { status: 403 });
    }

    if (!orderData.cycle_id) {
      return NextResponse.json({ error: '주문에 연결된 기수(Cycle)가 없습니다.' }, { status: 400 });
    }
    
    if (orderData.pii_key_version !== 1) {
      return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
    
    const paymentOrderId = orderData.payment_order_id;
    if (typeof paymentOrderId !== 'string' || paymentOrderId.trim() === '') {
      return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }

    let shippingName, shippingPhone, shippingAddress;
    try {
      if (!orderData.user_name_enc || !orderData.user_phone_enc || !orderData.user_address_enc) {
        throw new Error('Missing encrypted PII');
      }

      shippingName = decryptOrderPii(orderData.user_name_enc, { field: 'user_name', paymentOrderId });
      shippingPhone = decryptOrderPii(orderData.user_phone_enc, { field: 'user_phone', paymentOrderId });
      shippingAddress = decryptOrderPii(orderData.user_address_enc, { field: 'user_address', paymentOrderId });
      
      if (!shippingName || !shippingPhone || !shippingAddress) {
         throw new Error('Empty decrypted PII');
      }
    } catch (err) {
      console.error('book order creation failed');
      return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }

    const cycle: any = orderData.cycles || {};

    // 2. 선택한 도서가 해당 기수에 속하는지 확인
    const { data: booksData, error: booksErr } = await supabaseAdmin
      .from('books')
      .select('id, cycle_id')
      .in('id', bookIds);

    if (booksErr || !booksData || booksData.length !== bookIds.length) {
      return NextResponse.json({ error: '일부 도서 정보를 확인할 수 없습니다.' }, { status: 400 });
    }

    for (const b of booksData) {
      if (b.cycle_id !== orderData.cycle_id) {
        return NextResponse.json({ error: '선택한 도서가 주문하신 기수와 일치하지 않습니다.' }, { status: 400 });
      }
    }

    const bookOrderId = crypto.randomUUID();

    let encryptedShippingName, encryptedShippingPhone, encryptedShippingAddress, encryptedDeliveryNote;
    try {
      encryptedShippingName = encryptBookOrderPii('shipping_name', bookOrderId, shippingName);
      encryptedShippingPhone = encryptBookOrderPii('shipping_phone', bookOrderId, shippingPhone);
      encryptedShippingAddress = encryptBookOrderPii('shipping_address', bookOrderId, shippingAddress);
      
      encryptedDeliveryNote = parsedDeliveryNote ? encryptBookOrderPii('delivery_note', bookOrderId, parsedDeliveryNote) : null;

      const keyVersion = encryptedShippingName.keyVersion;
      if (
        !Number.isInteger(keyVersion) ||
        keyVersion <= 0 ||
        encryptedShippingPhone.keyVersion !== keyVersion ||
        encryptedShippingAddress.keyVersion !== keyVersion ||
        (encryptedDeliveryNote && encryptedDeliveryNote.keyVersion !== keyVersion)
      ) {
        throw new Error('Book order shipping encryption version mismatch');
      }
    } catch (err) {
      console.error('book order creation failed');
      return NextResponse.json(
        { error: '배송 요청사항을 포함한 주문 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 3. RPC 호출
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('place_book_order_v5', {
      p_book_order_id: bookOrderId,
      p_subscription_order_id: subOrderId,
      p_user_id: user.id,
      p_book_ids: bookIds,
      p_shipping_name_enc: encryptedShippingName.encryptedValue,
      p_shipping_phone_enc: encryptedShippingPhone.encryptedValue,
      p_shipping_address_enc: encryptedShippingAddress.encryptedValue,
      p_pii_key_version: encryptedShippingName.keyVersion,
      p_delivery_note_enc: encryptedDeliveryNote ? encryptedDeliveryNote.encryptedValue : null
    });

    if (rpcError) {
      console.error('book order creation failed');
      return NextResponse.json({ error: '배송 요청사항을 포함한 주문 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, newOrderId: bookOrderId });
  } catch (err: any) {
    console.error('book order creation failed');
    return NextResponse.json({ error: '배송 요청사항을 포함한 주문 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
