import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookOrderId } = await params;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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
      return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 401 });
    }

    // Update order status to 주문취소 conditionally
    const { data: cancelledOrder, error: updateErr } = await supabaseAdmin
      .from('book_orders')
      .update({ order_status: '주문취소', updated_at: new Date().toISOString() })
      .eq('id', bookOrderId)
      .eq('user_id', user.id)
      .eq('order_status', '주문접수')
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('Cancel order error:', updateErr);
      return NextResponse.json({ error: '도서 신청 취소 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!cancelledOrder) {
      return NextResponse.json({ error: '이미 배송 준비가 시작되었거나 취소할 수 없는 주문입니다.' }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Book order cancel API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
