import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventType, data } = body;

    // 결제 상태 변경 이벤트만 처리
    if (eventType !== 'PAYMENT_STATUS_CHANGED') {
      return NextResponse.json({ success: true, message: 'Ignored event' });
    }

    const { paymentKey, orderId, status } = data;

    // 결제가 취소된 경우에 대한 동기화 처리
    if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!serviceRoleKey) {
        console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is not configured.');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // 1. 해당 주문 조회
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('user_id, id')
        .eq('payment_order_id', orderId)
        .single();

      if (orderError || !order) {
        console.error('[WEBHOOK_ERROR] 취소된 주문을 찾을 수 없습니다. OrderId:', orderId);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // 2. 주문 상태를 CANCELED로 업데이트
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'CANCELLED' })
        .eq('id', order.id);

      // 3. 해당 사용자의 다른 유효한(DONE) 주문이 남아있는지 확인
      // 본 취소 건을 제외하고 결제 완료된 다른 구독권이 있는지 검사합니다.
      const { data: otherValidOrders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('user_id', order.user_id)
        .eq('payment_status', 'DONE')
        .neq('id', order.id);

      // 4. 다른 유효한 구독이 없다면 유저의 구독 상태(has_paid)를 false로 강등
      if (!otherValidOrders || otherValidOrders.length === 0) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          order.user_id,
          { user_metadata: { has_paid: false } }
        );

        if (authUpdateError) {
          console.error('[CRITICAL_WEBHOOK_SYNC_ERROR] 사용자 구독 상태(has_paid=false) 강등에 실패했습니다.', { userId: order.user_id, error: authUpdateError });
        }
      }

      return NextResponse.json({ success: true, message: 'Cancellation processed successfully' });
    }

    return NextResponse.json({ success: true, message: 'Status processed' });
  } catch (err: any) {
    console.error('[WEBHOOK_ERROR] 서버 내부 오류:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
