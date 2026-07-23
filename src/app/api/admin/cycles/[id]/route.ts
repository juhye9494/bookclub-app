import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: cycleId } = await context.params;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { id, name, subscription_start_date, subscription_end_date, book_order_start_date, book_order_end_date, shipping_start_date, operation_end_date, max_book_count, status } = body;

    // Check if modifying id
    if (id && id !== cycleId) {
      const { data: linkedOrders } = await supabaseAdmin.from('orders').select('id').eq('cycle_id', cycleId).limit(1);
      if (linkedOrders && linkedOrders.length > 0) {
        return NextResponse.json({ error: '이미 주문이 연결된 기수의 ID는 변경할 수 없습니다.' }, { status: 400 });
      }
    }

    if (subscription_start_date && subscription_end_date && new Date(subscription_start_date) >= new Date(subscription_end_date)) return NextResponse.json({ error: '구독 시작일은 종료일보다 이전이어야 합니다.' }, { status: 400 });
    if (book_order_start_date && book_order_end_date && new Date(book_order_start_date) >= new Date(book_order_end_date)) return NextResponse.json({ error: '도서 주문 시작일은 종료일보다 이전이어야 합니다.' }, { status: 400 });
    if (shipping_start_date && operation_end_date && new Date(shipping_start_date) > new Date(operation_end_date)) return NextResponse.json({ error: '배송 시작일은 운영 종료일 이전이어야 합니다.' }, { status: 400 });
    
    if (max_book_count !== undefined && max_book_count < 1) return NextResponse.json({ error: '최대 도서 권수는 1 이상이어야 합니다.' }, { status: 400 });

    const { error: updateErr } = await supabaseAdmin.from('cycles').update({
      id: id || undefined, 
      name, subscription_start_date, subscription_end_date, book_order_start_date, book_order_end_date, shipping_start_date, operation_end_date, max_book_count, status
    }).eq('id', cycleId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
