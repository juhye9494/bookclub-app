import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { encryptBookOrderPii } from '@/lib/server/bookOrderPiiCrypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^[0-9+\-()\s]{7,50}$/;

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookOrderId } = await context.params;

    if (!bookOrderId || !UUID_REGEX.test(bookOrderId)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 401 });
    }

    const body = await req.json();
    const shippingName = typeof body.shipping_name === 'string' ? body.shipping_name.trim() : '';
    const shippingPhone = typeof body.shipping_phone === 'string' ? body.shipping_phone.trim() : '';
    const shippingAddress = typeof body.shipping_address === 'string' ? body.shipping_address.trim() : '';

    if (
      !shippingName || shippingName.length > 100 ||
      !shippingPhone || !PHONE_REGEX.test(shippingPhone) ||
      !shippingAddress || shippingAddress.length > 500
    ) {
      return NextResponse.json({ error: '배송지 정보(받는 분, 연락처, 주소)를 모두 올바르게 입력해주세요.' }, { status: 400 });
    }

    let encryptedShippingName, encryptedShippingPhone, encryptedShippingAddress;
    try {
      encryptedShippingName = encryptBookOrderPii('shipping_name', bookOrderId, shippingName);
      encryptedShippingPhone = encryptBookOrderPii('shipping_phone', bookOrderId, shippingPhone);
      encryptedShippingAddress = encryptBookOrderPii('shipping_address', bookOrderId, shippingAddress);

      const keyVersion = encryptedShippingName.keyVersion;
      if (
        !Number.isInteger(keyVersion) ||
        keyVersion <= 0 ||
        encryptedShippingPhone.keyVersion !== keyVersion ||
        encryptedShippingAddress.keyVersion !== keyVersion
      ) {
        throw new Error('Book order shipping encryption version mismatch');
      }
    } catch (err) {
      console.error('book order shipping address update failed');
      return NextResponse.json(
        { error: '서버 오류가 발생했습니다.' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    // 조건부 UPDATE 실행
    const { data: updateData, error: updateErr } = await supabaseAdmin
      .from('book_orders')
      .update({
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        shipping_name_enc: encryptedShippingName.encryptedValue,
        shipping_phone_enc: encryptedShippingPhone.encryptedValue,
        shipping_address_enc: encryptedShippingAddress.encryptedValue,
        pii_key_version: encryptedShippingName.keyVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookOrderId)
      .eq('user_id', user.id)
      .eq('order_status', '주문접수')
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('book order shipping address update failed');
      return NextResponse.json({ error: '배송지 변경 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!updateData) {
      return NextResponse.json({ error: '이미 배송 준비가 시작되어 배송지를 변경할 수 없습니다.' }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: updateData });

  } catch (err: any) {
    console.error('book order shipping address update failed');
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
