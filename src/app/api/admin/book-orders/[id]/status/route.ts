import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

// Allowed state transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  '주문접수': ['배송준비중', '주문취소'],
  '배송준비중': ['배송중', '주문취소'],
  '배송중': ['배송완료'],
  '배송완료': [],
  '주문취소': [] // Once cancelled, cannot revert
};

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await context.params;
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
    if (userError || !user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { status: newStatus } = body;

    if (!newStatus || !Object.keys(ALLOWED_TRANSITIONS).includes(newStatus)) {
      return NextResponse.json({ error: '유효하지 않은 주문 상태입니다.' }, { status: 400 });
    }

    // Fetch current status and cycle_id
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('book_orders')
      .select('order_status, cycle_id')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const currentStatus = order.order_status;

    if (currentStatus === newStatus) {
      return NextResponse.json({ error: '동일한 상태로 변경할 수 없습니다.' }, { status: 400 });
    }

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      return NextResponse.json({ error: `[${currentStatus}] 상태에서는 [${newStatus}] 상태로 변경할 수 없습니다.` }, { status: 400 });
    }

    // Check cycle shipping_start_date
    const { data: cycle, error: cycleErr } = await supabaseAdmin
      .from('cycles')
      .select('shipping_start_date')
      .eq('id', order.cycle_id)
      .single();

    if (cycleErr || !cycle) {
      return NextResponse.json({ error: '기수 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    const now = new Date();
    const shippingStart = new Date(cycle.shipping_start_date);

    if (now < shippingStart) {
      if (['배송준비중', '배송중', '배송완료'].includes(newStatus)) {
        return NextResponse.json({ error: '배송 시작일 전에는 배송 상태를 변경할 수 없습니다. (주문취소만 가능)' }, { status: 400 });
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('book_orders')
      .update({ order_status: newStatus })
      .eq('id', orderId)
      .eq('order_status', currentStatus)
      .select('id')
      .single();

    if (updateError || !updated) {
      console.error('Update status error:', updateError);
      return NextResponse.json({ error: '주문 상태가 이미 변경되었습니다. 새로고침 후 다시 시도하세요.' }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Admin order status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
