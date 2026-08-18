import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptProfilePii } from '@/lib/server/piiCrypto';
import {
  encryptOrderPii,
  createOrderPiiHmac,
} from '@/lib/server/orderPiiCrypto';
import { getCycleOneStatus, TARGET_CYCLE_ID } from '@/lib/server/cycleUtils';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { cycle_id } = body;

    if (!cycle_id) {
      return NextResponse.json({ error: 'cycle_id is required' }, { status: 400 });
    }

    const orderId = `order_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const EXPECTED_AMOUNT = 45000;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, phone, address, phone_enc, address_enc, pii_key_version')
      .eq('id', user.id)
      .single();

    let finalPhone = profile?.phone || '';
    let finalAddress = profile?.address || '';

    if (profile) {
      if ((profile.phone_enc || profile.address_enc) && profile.pii_key_version !== 1) {
        return NextResponse.json({ error: '회원정보를 안전하게 불러오지 못했습니다.' }, { status: 500 });
      }

      try {
        if (profile.phone_enc) {
          finalPhone = await decryptProfilePii(profile.phone_enc, {
            profileId: profile.id,
            field: 'phone'
          });
        }
        if (profile.address_enc) {
          finalAddress = await decryptProfilePii(profile.address_enc, {
            profileId: profile.id,
            field: 'address'
          });
        }
      } catch {
        return NextResponse.json({ error: '회원정보를 안전하게 불러오지 못했습니다.' }, { status: 500 });
      }
    }

    const finalName = typeof profile?.name === 'string' ? profile.name.trim() : '';
    finalPhone = typeof finalPhone === 'string' ? finalPhone.trim() : '';
    finalAddress = typeof finalAddress === 'string' ? finalAddress.trim() : '';

    if (
      profileError ||
      !user.email ||
      !finalName ||
      !finalPhone ||
      !finalAddress
    ) {
      if (profileError) {
        console.error('[Payment Init] Profile fetch failed');
      }

      return NextResponse.json(
        {
          error: '회원 이메일, 이름, 연락처, 주소 정보가 부족합니다. 마이페이지에서 수정해주세요.'
        },
        { status: 400 }
      );
    }

    // 1. Verify cycle
    const { data: cycle, error: cycleErr } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('id', cycle_id)
      .single();

    if (cycleErr || !cycle) {
      return NextResponse.json({ error: '존재하지 않는 기수입니다.' }, { status: 400 });
    }

    if (cycle.status === 'closed') {
      return NextResponse.json({ error: '해당 기수는 모집이 강제 종료되었습니다.' }, { status: 400 });
    }

    const now = new Date();
    const subStart = new Date(cycle.subscription_start_date);
    const subEnd = new Date(cycle.subscription_end_date);

    if (now < subStart || now > subEnd) {
      return NextResponse.json({ error: '현재 구독 신청 기간이 아닙니다.' }, { status: 400 });
    }

    // 2. Duplicate payment check (DONE)
    const { data: existingOrders, error: existingErr } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('cycle_id', cycle_id)
      .eq('payment_status', 'DONE')
      .limit(1);

    if (existingErr) {
      console.error('Failed to check existing orders:', existingErr);
      return NextResponse.json({ error: '주문 조회에 실패했습니다.' }, { status: 500 });
    }

    if (existingOrders && existingOrders.length > 0) {
      return NextResponse.json({ error: '이미 해당 기수의 구독을 완료하셨습니다.' }, { status: 409 });
    }

    // 2.1 Enforce subscriber limit for cycle-2026-h1
    if (cycle_id === TARGET_CYCLE_ID) {
      const cycleStatus = await getCycleOneStatus();

      if (cycleStatus === 'error') {
        return NextResponse.json(
          {
            error: '현재 멤버십 신청 가능 여부를 확인할 수 없습니다.\n잠시 후 다시 시도해주세요.'
          },
          { status: 503 }
        );
      }

      if (cycleStatus === 'closed') {
        return NextResponse.json(
          {
            error: '한경 언더라인 1기 모집이 마감되었습니다.\n보내주신 관심에 감사드립니다.'
          },
          { status: 403 }
        );
      }
    }

    // 2.5 Cleanup old PENDING orders for this user and cycle
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('orders')
      .delete()
      .eq('user_id', user.id)
      .eq('cycle_id', cycle_id)
      .eq('payment_status', 'PENDING')
      .lt('created_at', thirtyMinutesAgo);

    // 3. Create PENDING order
    // id (UUID) 필드 생략: DB gen_random_uuid()에 의존
    // status 필드 생략: 운영 DB에 없는 커스텀 필드 제거

    if (process.env.PII_ENCRYPTION_ACTIVE_VERSION !== '1') {
      return NextResponse.json({ error: '결제 초기화 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const userNameEnc = encryptOrderPii(finalName, {
      field: 'user_name',
      paymentOrderId: orderId,
    });

    const userEmailEnc = encryptOrderPii(user.email, {
      field: 'user_email',
      paymentOrderId: orderId,
    });

    const userPhoneEnc = encryptOrderPii(finalPhone, {
      field: 'user_phone',
      paymentOrderId: orderId,
    });

    const userAddressEnc = encryptOrderPii(finalAddress, {
      field: 'user_address',
      paymentOrderId: orderId,
    });

    const userNameHmac = createOrderPiiHmac(finalName, {
      field: 'user_name',
    });

    const userEmailHmac = createOrderPiiHmac(user.email, {
      field: 'user_email',
    });

    const { data: createdOrder, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        user_name_enc: userNameEnc,
        user_email_enc: userEmailEnc,
        user_phone_enc: userPhoneEnc,
        user_address_enc: userAddressEnc,
        user_name_hmac: userNameHmac,
        user_email_hmac: userEmailHmac,
        pii_key_version: 1,
        is_test: process.env.VERCEL_ENV !== 'production',
        payment_order_id: orderId,
        payment_status: 'PENDING',
        selected_books: [],
        total_amount: EXPECTED_AMOUNT,
        cycle_id: cycle_id
      })
      .select('payment_order_id')
      .single();

    if (insertError || !createdOrder) {
      console.error('Failed to insert order:', insertError?.code ?? 'UNKNOWN');
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: createdOrder.payment_order_id, amount: EXPECTED_AMOUNT });
  } catch {
    return NextResponse.json({ error: '결제 초기화 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
