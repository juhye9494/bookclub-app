import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { orderId } = body;
    const referenceId = crypto.randomUUID();

    if (!orderId) {
      return NextResponse.json({ error: '주문 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 1. 주문 사전 검증 (권한 및 상태 확인)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, payment_order_id, payment_status, cycle_id, payment_key, total_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '유효하지 않은 주문입니다.' }, { status: 400 });
    }

    if (order.user_id !== user.id) {
      return NextResponse.json({ error: '주문에 대한 권한이 없습니다.' }, { status: 403 });
    }

    if (order.payment_status !== 'DONE') {
      return NextResponse.json({ error: '결제가 완료된 주문만 취소할 수 있습니다.' }, { status: 400 });
    }

    if (!order.cycle_id) {
      return NextResponse.json({ error: '주문에 기수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 2. 기수(Cycle) 정보 검증
    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from('cycles')
      .select('id, book_order_start_date, subscription_end_date, status')
      .eq('id', order.cycle_id)
      .single();

    if (cycleError || !cycle) {
      return NextResponse.json({ error: '기수 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    if (cycle.status === 'closed') {
      return NextResponse.json({ error: '종료된 기수의 결제는 취소할 수 없습니다.' }, { status: 403 });
    }

    const now = new Date();
    const subEnd = cycle.subscription_end_date ? new Date(cycle.subscription_end_date) : new Date('2000-01-01');
    const bookStart = cycle.book_order_start_date ? new Date(cycle.book_order_start_date) : new Date('2000-01-01');

    if (now > subEnd) {
      return NextResponse.json({ error: '구독 신청 기간이 지났습니다. 환불은 1:1 문의를 이용해주세요.' }, { status: 403 });
    }

    if (now >= bookStart) {
      return NextResponse.json({ error: '도서 신청 기간이 시작되어 마이페이지에서 직접 취소할 수 없습니다. 환불은 1:1 문의를 이용해주세요.' }, { status: 403 });
    }

    // 3. 연관된 활성 book_orders 검사
    const { data: activeBookOrders, error: bookOrderError } = await supabaseAdmin
      .from('book_orders')
      .select('id')
      .eq('subscription_order_id', order.id)
      .neq('order_status', '주문취소')
      .limit(1);

    if (bookOrderError) {
      return NextResponse.json({ error: '도서 주문 정보 확인 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (activeBookOrders && activeBookOrders.length > 0) {
      return NextResponse.json({ error: '이미 도서 신청 내역이 존재하여 직접 취소할 수 없습니다. 1:1 문의를 이용해주세요.' }, { status: 403 });
    }

    // 4. Toss paymentKey 확보
    let paymentKey = order.payment_key;
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      console.error('[CRITICAL] TOSS_SECRET_KEY is not configured.');
      return NextResponse.json({ error: '결제 취소 키가 설정되지 않았습니다.' }, { status: 500 });
    }
    const encryptedSecretKey = Buffer.from(`${secretKey}:`).toString('base64');

    if (!paymentKey) {
      // payment_key가 DB에 없으면 API로 조회
      const getPaymentRes = await fetch(`https://api.tosspayments.com/v1/payments/orders/${order.payment_order_id}`, {
        method: 'GET',
        headers: { Authorization: `Basic ${encryptedSecretKey}` }
      });
      if (!getPaymentRes.ok) {
        console.error('[TOSS_PAYMENT_ERROR] Toss 주문 조회 실패:', order.payment_order_id);
        return NextResponse.json({ error: '결제 정보를 확인할 수 없습니다. 고객센터로 문의해주세요.' }, { status: 500 });
      }
      const paymentData = await getPaymentRes.json();
      paymentKey = paymentData.paymentKey;
      if (!paymentKey) {
        return NextResponse.json({ error: '결제 Key를 확인할 수 없습니다. 고객센터로 문의해주세요.' }, { status: 500 });
      }
    }

    // 5. Toss 환불(취소) 요청
    const cancelRes = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encryptedSecretKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `user-refund-${order.payment_order_id}`
      },
      body: JSON.stringify({
        cancelReason: '고객 요청에 의한 구독 취소'
      })
    });

    const cancelData = await cancelRes.json();

    let isFullyCanceled = false;

    if (!cancelRes.ok) {
      if (cancelData.code === 'ALREADY_CANCELED_PAYMENT') {
        // 이미 취소된 결제의 안전한 동기화
        const getPaymentRes = await fetch(`https://api.tosspayments.com/v1/payments/orders/${order.payment_order_id}`, {
          method: 'GET',
          headers: { Authorization: `Basic ${encryptedSecretKey}` }
        });
        
        if (getPaymentRes.ok) {
          const paymentData = await getPaymentRes.json();
          if (
            paymentData.orderId === order.payment_order_id &&
            paymentData.status === 'CANCELED' &&
            paymentData.balanceAmount === 0
          ) {
            isFullyCanceled = true;
          } else {
            console.error('[TOSS_CANCEL_VERIFY_ERROR]', {
            orderIdMatches: paymentData?.orderId === order.payment_order_id,
            status: paymentData?.status,
            balanceAmount: paymentData?.balanceAmount,
          });
            return NextResponse.json({ error: '결제 취소 상태를 확인할 수 없습니다. 고객센터에 문의해주세요.' }, { status: 500 });
          }
        } else {
          console.error('[TOSS_CANCEL_VERIFY_ERROR] 이미 취소된 결제 조회 실패:', order.payment_order_id);
          return NextResponse.json({ error: '결제 취소 상태 확인에 실패했습니다. 고객센터에 문의해주세요.' }, { status: 500 });
        }
      } else {
        const paymentKeySuffix =
          typeof paymentKey === 'string' && paymentKey.length >= 6
            ? paymentKey.slice(-6)
            : 'N/A';

        console.error('[TOSS_CANCEL_ERROR]', {
          referenceId,
          internalOrderId: order.id,
          paymentOrderId: order.payment_order_id,
          paymentKeySuffix,
          tossHttpStatus: cancelRes.status,
          tossErrorCode:
            typeof cancelData?.code === 'string'
              ? cancelData.code
              : 'UNKNOWN',
          tossErrorMessage:
            typeof cancelData?.message === 'string'
              ? cancelData.message
              : 'UNKNOWN',
        });

        if (paymentKey) {
          try {
            const paymentLookupRes = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
              method: 'GET',
              headers: { Authorization: `Basic ${encryptedSecretKey}` }
            });

            let paymentData: any = null;

            try {
              paymentData = await paymentLookupRes.json();
            } catch {
              paymentData = null;
            }

            if (paymentLookupRes.ok) {
              console.error('[TOSS_PAYMENT_STATE]', {
                referenceId,
                lookupHttpStatus: paymentLookupRes.status,
                method: paymentData?.method ?? null,
                status: paymentData?.status ?? null,
                totalAmount: paymentData?.totalAmount ?? null,
                balanceAmount: paymentData?.balanceAmount ?? null,
                cancelCount: Array.isArray(paymentData?.cancels)
                  ? paymentData.cancels.length
                  : 0,
                latestCancelStatus:
                  Array.isArray(paymentData?.cancels) &&
                  paymentData.cancels.length > 0
                    ? paymentData.cancels[paymentData.cancels.length - 1]?.cancelStatus ?? null
                    : null,
              });
            } else {
              console.error('[TOSS_PAYMENT_LOOKUP_ERROR]', {
                referenceId,
                lookupHttpStatus: paymentLookupRes.status,
                lookupErrorCode:
                  typeof paymentData?.code === 'string'
                    ? paymentData.code
                    : 'UNKNOWN',
              });
            }
          } catch (lookupError) {
            console.error('[TOSS_PAYMENT_LOOKUP_EXCEPTION]', {
              referenceId,
              message:
                lookupError instanceof Error
                  ? lookupError.message
                  : 'UNKNOWN',
            });
          }
        }

        return NextResponse.json({ 
          error: '결제 취소에 실패했습니다. 잠시 후 다시 시도하거나 1:1 문의를 이용해주세요.',
          referenceId 
        }, { status: cancelRes.status });
      }
    } else {
      // 5-1. Toss 전액 취소 결과를 실제 응답값으로 검증
      const hasDoneCancel = cancelData.cancels && cancelData.cancels.some((c: any) => c.cancelStatus === 'DONE');
      if (
        cancelData.status === 'CANCELED' &&
        cancelData.balanceAmount === 0 &&
        hasDoneCancel
      ) {
        isFullyCanceled = true;
      } else {
        console.error('[TOSS_CANCEL_VALIDATION_ERROR]', {
        status: cancelData?.status,
        balanceAmount: cancelData?.balanceAmount,
        cancelStatuses: Array.isArray(cancelData?.cancels)
          ? cancelData.cancels.map((item: any) => item.cancelStatus)
          : [],
      });
        return NextResponse.json({ error: '결제 취소 내역 검증에 실패했습니다. 고객센터로 문의해주세요.' }, { status: 500 });
      }
    }

    if (!isFullyCanceled) {
      return NextResponse.json({ error: '결제 취소 처리가 완료되지 않았습니다.' }, { status: 500 });
    }

    // 6. DB 상태 CANCELLED 갱신 조건부 업데이트
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'CANCELLED' })
      .eq('id', order.id)
      .eq('user_id', user.id)
      .eq('payment_status', 'DONE')
      .select('id')
      .maybeSingle();

    if (updateError || !updatedOrder) {
      // 갱신 결과가 0행이면 주문 상태 다시 조회
      const { data: checkOrder, error: checkError } = await supabaseAdmin
        .from('orders')
        .select('payment_status')
        .eq('id', order.id)
        .single();
        
      if (checkError || !checkOrder) {
        console.error(`[CRITICAL] Toss 결제는 취소되었으나 DB CANCELLED 갱신 0행 및 재조회 실패. OrderId: ${order.id}`);
        return NextResponse.json({ error: '결제는 취소되었으나, 내역 반영 중 오류가 발생했습니다.' }, { status: 500 });
      }
      
      if (checkOrder.payment_status === 'CANCELLED') {
        // 이미 CANCELLED이면 성공으로 처리
        return NextResponse.json({ success: true, message: '결제가 성공적으로 취소되었습니다.' });
      } else {
        // DONE이 아닌 다른 상태이거나 알 수 없는 오류
        console.error(`[CRITICAL] Toss 결제는 취소되었으나 DB CANCELLED 갱신 0행 및 현재 상태(${checkOrder.payment_status}) 이상. OrderId: ${order.id}`);
        return NextResponse.json({ error: '결제는 취소되었으나, 내역 동기화에 실패했습니다.' }, { status: 500 });
      }
    }

    // 메타데이터(has_paid) 작업 제거 (사용자 요청)

    return NextResponse.json({ success: true, message: '결제가 성공적으로 취소되었습니다.' });

  } catch (err: any) {
    console.error('[TOSS_CANCEL_ERROR] 서버 내부 오류:', err.message);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.', code: 'SERVER_ERROR' }, { status: 500 });
  }
}
