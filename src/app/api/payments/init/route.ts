import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    // 3. Create PENDING order
    // id (UUID) 필드 생략: DB gen_random_uuid()에 의존
    // status 필드 생략: 운영 DB에 없는 커스텀 필드 제거
    const { data: createdOrder, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        payment_order_id: orderId,
        payment_status: 'PENDING',
        selected_books: [],
        cycle_id: cycle_id
      })
      .select('payment_order_id')
      .single();

    if (insertError || !createdOrder) {
      console.error('Failed to insert order:', insertError);
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: createdOrder.payment_order_id, amount: EXPECTED_AMOUNT });
  } catch (err: any) {
    console.error('Init Payment Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
