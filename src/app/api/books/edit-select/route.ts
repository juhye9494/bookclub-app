import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return NextResponse.json({ error: '서버 설정 오류가 발생했습니다.' }, { status: 500 });
    }
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { editOrderId, bookIds } = body;

    if (!editOrderId) {
      return NextResponse.json({ error: '도서 주문 번호가 필요합니다.' }, { status: 400 });
    }

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return NextResponse.json({ error: '도서를 선택해주세요.' }, { status: 400 });
    }

    const uniqueIds = new Set(bookIds);
    if (uniqueIds.size !== bookIds.length) {
      return NextResponse.json({ error: '중복된 도서가 포함되어 있습니다.' }, { status: 400 });
    }

    // 1. Check book_order ownership and status
    const { data: bo, error: boErr } = await supabaseAdmin
      .from('book_orders')
      .select('id, user_id, subscription_order_id, cycle_id, order_status')
      .eq('id', editOrderId)
      .maybeSingle();

    if (boErr) {
      console.error('book_orders fetch error:', boErr);
      return NextResponse.json({ error: '도서 주문 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!bo) {
      return NextResponse.json({ error: '해당 도서 주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (bo.user_id !== user.id) {
      return NextResponse.json({ error: '본인의 주문 내역이 아닙니다.' }, { status: 403 });
    }

    if (bo.order_status !== '주문접수') {
      return NextResponse.json({ error: '배송준비중 이후 상태에서는 변경할 수 없습니다.' }, { status: 409 });
    }

    // 2. Check linked subscription order
    const { data: orderData, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, cycle_id, payment_status')
      .eq('id', bo.subscription_order_id)
      .maybeSingle();

    if (orderErr) {
      console.error('orders fetch error:', orderErr);
      return NextResponse.json({ error: '구독 결제 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!orderData) {
      return NextResponse.json({ error: '연결된 구독 결제 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (orderData.user_id !== user.id) {
      return NextResponse.json({ error: '구독 결제 내역의 소유권이 일치하지 않습니다.' }, { status: 403 });
    }

    if (orderData.cycle_id !== bo.cycle_id) {
      return NextResponse.json({ error: '구독 내역과 도서 주문의 기수 정보가 일치하지 않습니다.' }, { status: 400 });
    }

    if (orderData.payment_status !== 'DONE') {
      return NextResponse.json({ error: '유효한 구독 결제 내역(DONE)이 아닙니다.' }, { status: 400 });
    }

    // 3. RPC 호출 (상세 검증은 DB RPC에서 처리)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('update_book_order', {
      p_book_order_id: editOrderId,
      p_book_ids: bookIds
    });

    if (rpcError) {
      console.error('update_book_order RPC Error:', rpcError);
      return NextResponse.json({ error: '도서 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Book Edit API Error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
