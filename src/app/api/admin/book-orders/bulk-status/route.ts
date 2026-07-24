import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function PATCH(req: Request) {
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
    if (userError || !user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { order_ids, order_status } = body;

    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: '변경할 주문을 선택해주세요.' }, { status: 400 });
    }

    const uniqueOrderIds = Array.from(new Set(order_ids));
    if (uniqueOrderIds.length > 200) {
      return NextResponse.json({ error: '한 번에 최대 200건까지만 변경할 수 있습니다.' }, { status: 400 });
    }

    const allowedStatuses = ['주문접수', '배송준비중', '배송중', '배송완료'];
    if (!allowedStatuses.includes(order_status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 });
    }

    const { data: updatedData, error } = await supabaseAdmin
      .from('book_orders')
      .update({
        order_status: order_status,
        updated_at: new Date().toISOString(),
      })
      .in('id', uniqueOrderIds)
      .neq('order_status', '주문취소')
      .select('id');

    if (error) {
      console.error('Bulk update error:', error.code);
      return NextResponse.json({ error: '상태 업데이트 실패' }, { status: 500 });
    }

    const updatedCount = updatedData?.length || 0;
    const skippedCount = uniqueOrderIds.length - updatedCount;

    return NextResponse.json({
      success: true,
      requested_count: uniqueOrderIds.length,
      updated_count: updatedCount,
      skipped_count: skippedCount
    });

  } catch (err: any) {
    console.error('Admin order bulk update error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
