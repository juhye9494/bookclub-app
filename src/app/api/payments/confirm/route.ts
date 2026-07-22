import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 민감 정보 마스킹 헬퍼
function maskKey(key: string) {
  if (!key || key.length < 10) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 4);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel environment.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { paymentKey, orderId, amount } = body;

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: '결제 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 1. 주문 사전 검증 (권한 및 금액 확인)
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('payment_order_id', orderId)
      .single();

    if (!order) {
      console.error('[TOSS_PAYMENT_ERROR] 주문 정보를 찾을 수 없습니다. OrderId:', orderId);
      return NextResponse.json({ error: '유효하지 않은 주문입니다.' }, { status: 400 });
    }

    if (order.user_id !== user.id) {
      console.error('[TOSS_PAYMENT_ERROR] 주문 소유권 불일치. DB_User:', maskKey(order.user_id), 'Req_User:', maskKey(user.id));
      return NextResponse.json({ error: '주문에 대한 권한이 없습니다.' }, { status: 403 });
    }

    const EXPECTED_AMOUNT = order.total_amount;
    if (Number(amount) !== EXPECTED_AMOUNT) {
      console.error('[TOSS_PAYMENT_ERROR] 요청 금액 불일치 (사전차단). 요청:', amount, '기대:', EXPECTED_AMOUNT);
      // 승인 요청 전이므로 취소가 아닌 차단만 수행
      return NextResponse.json({ error: '결제 요청 금액이 변조되었습니다.' }, { status: 400 });
    }

    // 중복 결제 차단 로직: 현재 주문 외에 이미 DONE 상태인 주문이 있는지 확인
    const { data: existingDoneOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('payment_status', 'DONE')
      .neq('id', order.id);

    if (existingDoneOrders && existingDoneOrders.length > 0) {
      console.warn(`[PAYMENT_CONFIRM] 중복 결제 승인 차단. User ID: ${user.id}`);
      return NextResponse.json({ error: '이미 유효한 구독이 존재합니다.' }, { status: 409 });
    }

    const isProduction = process.env.VERCEL_ENV === 'production';
    const secretKey = isProduction 
      ? (process.env.TOSS_SECRET_KEY || 'test_sk_Z1aOwX7K8m2Y0yKqK6G03yQxRvDP') 
      : 'test_sk_Z1aOwX7K8m2Y0yKqK6G03yQxRvDP';
    const encryptedSecretKey = Buffer.from(`${secretKey}:`).toString('base64');
    
    // 2. 복구 프로세스: 이미 payment_key가 저장되어 있다면 승인이 시도되었을 수 있음
    if (order.payment_key === paymentKey) {
      if (order.payment_status === 'DONE') {
        return NextResponse.json({ success: true, message: '이미 처리된 주문입니다.' });
      }
      
      // 상태가 DONE이 아니면 토스 결제 조회 API로 실제 승인 상태 확인
      const inquiryRes = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
        headers: { Authorization: `Basic ${encryptedSecretKey}` }
      });
      
      if (inquiryRes.ok) {
        const inquiryData = await inquiryRes.json();
        if (inquiryData.status === 'DONE') {
          // 승인은 완료되었으나 이전 DB 갱신이 실패한 상태이므로 DB 업데이트 후 성공 처리
          await finalizeOrder(supabaseAdmin, user.id, order.id);
          return NextResponse.json({ success: true, data: inquiryData });
        } else if (inquiryData.status === 'CANCELED' || inquiryData.status === 'ABORTED') {
          return NextResponse.json({ error: '결제가 이미 취소되거나 중단되었습니다.' }, { status: 400 });
        }
      }
    } else {
      // 3. Confirm API 호출 전 PENDING 주문에 paymentKey 먼저 기록 (복구 지원)
      await supabaseAdmin
        .from('orders')
        .update({ payment_key: paymentKey })
        .eq('id', order.id);
    }

    // 4. 결제 승인 요청
    const confirmResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encryptedSecretKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `confirm-${orderId}`
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: Number(amount),
      }),
    });

    const data = await confirmResponse.json();

    if (!confirmResponse.ok) {
      console.error('[TOSS_PAYMENT_ERROR] 결제 승인 실패:', data.code, data.message, 'OrderId:', orderId);
      return NextResponse.json({ error: data.message, code: data.code }, { status: confirmResponse.status });
    }

    // 5. 승인 후 검증 및 자동 취소
    if (data.totalAmount !== EXPECTED_AMOUNT) {
      console.error('[CRITICAL_PAYMENT_ERROR] 승인 후 금액 불일치. 자동 취소를 진행합니다. OrderId:', orderId);
      
      // 즉시 결제 취소 API 호출
      await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encryptedSecretKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `cancel-${orderId}`
        },
        body: JSON.stringify({
          cancelReason: '결제 금액 위변조 감지로 인한 자동 취소'
        })
      });

      await supabaseAdmin.from('orders').update({ payment_status: 'CANCELED' }).eq('id', order.id);
      return NextResponse.json({ error: '결제 금액 불일치로 승인이 자동 취소되었습니다.', code: 'AMOUNT_MISMATCH_CANCELED' }, { status: 400 });
    }

    if (data.status === 'DONE') {
      // 정상 완료 시 상태 갱신
      const success = await finalizeOrder(supabaseAdmin, user.id, order.id);
      if (!success) {
        console.error('[CRITICAL_PAYMENT_SYNC_ERROR] 결제는 성공했으나 DB/상태 업데이트 실패', { orderId, userId: maskKey(user.id), paymentKey: maskKey(paymentKey) });
        return NextResponse.json({ error: '결제는 성공했으나 DB 업데이트에 실패했습니다. 고객센터로 문의해주세요.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data });
    } else {
      console.error('[TOSS_PAYMENT_ERROR] 결제가 DONE 상태가 아님:', data.status, 'OrderId:', orderId);
      return NextResponse.json({ error: '결제가 완료되지 않았습니다.', code: 'NOT_DONE' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[TOSS_PAYMENT_ERROR] 서버 내부 오류:', err.message);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.', code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// 결제 완료 후 DB 및 유저 상태 업데이트 공통 함수
async function finalizeOrder(supabaseAdmin: any, userId: string, orderDbId: string) {
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'DONE' })
    .eq('id', orderDbId);

  if (updateError) return false;

  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { user_metadata: { has_paid: true } }
  );
  
  if (authUpdateError) return false;

  return true;
}
