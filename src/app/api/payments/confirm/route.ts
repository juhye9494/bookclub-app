import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCycleOneStatus, TARGET_CYCLE_ID } from '@/lib/server/cycleUtils';

const maskKey = (key: string) => {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
};

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
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, payment_order_id, payment_status, cycle_id')
      .eq('payment_order_id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[TOSS_PAYMENT_ERROR] 주문 정보를 찾을 수 없습니다. OrderId:', orderId);
      return NextResponse.json({ error: '유효하지 않은 주문입니다.' }, { status: 400 });
    }

    if (order.user_id !== user.id) {
      console.error('[TOSS_PAYMENT_ERROR] 주문 소유권 불일치. DB_User:', maskKey(order.user_id), 'Req_User:', maskKey(user.id));
      return NextResponse.json({ error: '주문에 대한 권한이 없습니다.' }, { status: 403 });
    }

    if (!order.cycle_id) {
      console.error('[TOSS_PAYMENT_ERROR] 주문에 기수(cycle_id) 정보가 없습니다. OrderId:', orderId);
      return NextResponse.json({ error: '주문에 기수 정보가 누락되었습니다.' }, { status: 400 });
    }

    const EXPECTED_AMOUNT = 45000;
    const requestedAmount = Number(amount);

    if (
      !Number.isInteger(requestedAmount) ||
      requestedAmount !== EXPECTED_AMOUNT
    ) {
      console.error('[TOSS_PAYMENT_ERROR] 요청 금액 불일치 (사전차단). 요청:', amount, '기대:', EXPECTED_AMOUNT);
      return NextResponse.json({ error: '결제 요청 금액이 변조되었습니다.' }, { status: 400 });
    }

    // 이미 처리된 주문인지 검사
    if (order.payment_status === 'DONE') {
      return NextResponse.json({ success: true, message: '이미 처리된 주문입니다.' });
    }

    if (order.payment_status !== 'PENDING') {
      return NextResponse.json(
        { error: '현재 상태에서는 결제를 승인할 수 없습니다.' },
        { status: 409 }
      );
    }

    // 중복 결제 차단 로직: 현재 주문 외에 동일한 사용자가 '동일 기수'에 DONE 상태인 주문이 있는지 확인
    const { data: existingDoneOrders, error: doneOrdersError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('cycle_id', order.cycle_id)
      .eq('payment_status', 'DONE')
      .neq('id', order.id);

    if (doneOrdersError) {
      console.error('[TOSS_PAYMENT_ERROR] 중복 결제 조회 실패:', doneOrdersError.message);
      return NextResponse.json({ error: '결제 상태 확인 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (existingDoneOrders && existingDoneOrders.length > 0) {
      console.warn(`[PAYMENT_CONFIRM] 중복 결제 승인 차단. User ID: ${maskKey(user.id)}, Cycle ID: ${order.cycle_id}`);
      return NextResponse.json({ error: '이미 해당 기수에 유효한 구독이 존재합니다.' }, { status: 409 });
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      console.error('[CRITICAL] TOSS_SECRET_KEY is not configured.');
      return NextResponse.json(
        { error: '결제 시크릿 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }
    const encryptedSecretKey = Buffer.from(`${secretKey}:`).toString('base64');
    
    // 1.5. 정원 마감 검증 (최종 결제 승인 직전)
    if (order.cycle_id === TARGET_CYCLE_ID) {
      const cycleStatus = await getCycleOneStatus();
      if (cycleStatus === 'closed') {
        console.warn(`[PAYMENT_CONFIRM] 정원 초과 차단. User ID: ${maskKey(user.id)}, OrderId: ${orderId}`);
        // 토스 결제 승인 거부 처리 (결제 실패 유도)
        return NextResponse.json({ error: '모집 정원이 마감되어 결제를 진행할 수 없습니다.' }, { status: 403 });
      }
    }

    // 2. 결제 승인 요청 (토스 API)
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
        amount: requestedAmount,
      }),
    });

    const data = await confirmResponse.json();

    if (!confirmResponse.ok) {
      console.error('[TOSS_PAYMENT_ERROR] 결제 승인 실패:', data.code, data.message, 'OrderId:', orderId);
      return NextResponse.json({ error: data.message, code: data.code }, { status: confirmResponse.status });
    }

    // 3. 승인 후 금액 검증 및 자동 취소
    if (data.totalAmount !== EXPECTED_AMOUNT) {
      console.error('[CRITICAL_PAYMENT_ERROR] 승인 후 금액 불일치. 자동 취소를 진행합니다. OrderId:', orderId);
      
      const cancelRes = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
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

      if (cancelRes.ok) {
        const { error: cancelStatusError } = await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'CANCELLED' })
          .eq('id', order.id)
          .eq('payment_status', 'PENDING');
          
        if (cancelStatusError) {
          console.error('[CRITICAL] 결제는 취소됐지만 DB 취소 상태 저장에 실패했습니다.', cancelStatusError.code);
        }
        
        return NextResponse.json({ error: '결제 금액 불일치로 승인이 자동 취소되었습니다.', code: 'AMOUNT_MISMATCH_CANCELED' }, { status: 400 });
      } else {
        console.error('[CRITICAL] 금액 불일치로 인한 결제 자동 취소에 실패했습니다.', { orderId });
        return NextResponse.json({ error: '결제 취소 처리에 실패했습니다. 고객센터로 문의해주세요.' }, { status: 500 });
      }
    }

    if (data.status === 'DONE') {
      // 4. 정상 완료 시 상태 갱신 (조건부)
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'DONE', payment_key: paymentKey })
        .eq('id', order.id)
        .eq('payment_status', 'PENDING')
        .select('id')
        .maybeSingle();

      if (updateError || !updatedOrder) {
        // updatedOrder가 NULL일 때 (0행 업데이트) 다른 스레드가 먼저 처리했는지 재조회
        if (!updateError && !updatedOrder) {
          const { data: latestOrder, error: latestOrderError } = await supabaseAdmin
            .from('orders')
            .select('payment_status')
            .eq('id', order.id)
            .single();

          if (!latestOrderError && latestOrder?.payment_status === 'DONE') {
            await finalizeUserMetadata(supabaseAdmin, user);
            return NextResponse.json({
              success: true,
              data,
              message: '이미 정상 처리된 주문입니다.',
            });
          }
        }

        // DB 저장 실패 시 토스 결제 자동 취소 시도
        const isDuplicate = updateError && updateError.code === '23505';
        const cancelReason = isDuplicate ? '동일 기수 중복 결제 감지로 인한 자동 취소' : '서버 오류로 인한 결제 자동 취소';
        const cancelIdempotencyKey = isDuplicate ? `cancel-duplicate-${orderId}` : `cancel-dbfail-${orderId}`;
        
        console.error(`[CRITICAL_PAYMENT_SYNC_ERROR] DB 업데이트 실패. 에러코드: ${updateError?.code}. 취소를 시도합니다.`);
        
        const cancelRes = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${encryptedSecretKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': cancelIdempotencyKey
          },
          body: JSON.stringify({ cancelReason })
        });

        if (cancelRes.ok) {
          const { error: cancelStatusError } = await supabaseAdmin
            .from('orders')
            .update({ payment_status: 'CANCELLED' })
            .eq('id', order.id)
            .eq('payment_status', 'PENDING');
            
          if (cancelStatusError) {
            console.error('[CRITICAL] 결제는 취소됐지만 DB 취소 상태 저장에 실패했습니다.', cancelStatusError.code);
          }
          
          if (isDuplicate) {
            return NextResponse.json({ error: '동일 기수에 중복 결제가 감지되어 자동으로 취소되었습니다.' }, { status: 409 });
          }
          return NextResponse.json({ error: '시스템 오류로 인해 결제가 취소되었습니다. 다시 시도해주세요.' }, { status: 500 });
        } else {
          console.error('[CRITICAL] 결제 승인 후 DB 업데이트 실패 및 자동 취소도 실패했습니다.', { orderId, error: updateError?.code });
          return NextResponse.json({ error: '결제 저장에 실패했습니다. 고객센터로 문의해주세요.' }, { status: 500 });
        }
      }

      // 5. DB 상태 갱신 성공 시 사용자 메타데이터 보조 업데이트
      await finalizeUserMetadata(supabaseAdmin, user);
      
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

// 사용자 메타데이터는 보조 작업이므로 실패해도 전체 흐름에 영향을 주지 않음
async function finalizeUserMetadata(supabaseAdmin: any, user: any) {
  try {
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        user_metadata: { 
          ...(user.user_metadata ?? {}),
          has_paid: true 
        } 
      }
    );
    
    if (authUpdateError) {
      console.warn(`[USER_META_UPDATE_FAIL] 사용자 메타데이터(has_paid) 업데이트 실패 (User ID: ${maskKey(user.id)}):`, authUpdateError.message);
    }
  } catch (error: any) {
    console.warn(`[USER_META_UPDATE_FAIL] 사용자 메타데이터 업데이트 중 예외 발생 (User ID: ${maskKey(user.id)}):`, error.message);
  }
}
