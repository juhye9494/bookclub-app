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

    const body = await req.json();
    const { subOrderId, bookIds } = body;

    if (!subOrderId) {
      return NextResponse.json({ error: '구독 주문 번호가 필요합니다.' }, { status: 400 });
    }

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return NextResponse.json({ error: '도서를 선택해주세요.' }, { status: 400 });
    }

    const uniqueIds = new Set(bookIds);
    if (uniqueIds.size !== bookIds.length) {
      return NextResponse.json({ error: '중복된 도서가 포함되어 있습니다.' }, { status: 400 });
    }

    // 1. 주문 소유권 및 결제 완료 상태 검증
    const { data: orderData, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('user_id, payment_status, cycle_id, cycles(book_order_start_date)')
      .eq('id', subOrderId)
      .single();

    if (orderErr || !orderData) {
      return NextResponse.json({ error: '주문 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    if (orderData.user_id !== user.id) {
      return NextResponse.json({ error: '본인의 주문내역이 아닙니다.' }, { status: 403 });
    }

    if (orderData.payment_status !== 'DONE') {
      return NextResponse.json({ error: '결제가 완료된 주문(DONE)만 도서를 신청할 수 있습니다.' }, { status: 403 });
    }

    if (!orderData.cycle_id) {
      return NextResponse.json({ error: '주문에 연결된 기수(Cycle)가 없습니다.' }, { status: 400 });
    }

    const cycle: any = orderData.cycles || {};
    if (cycle.book_order_start_date) {
      const orderStart = new Date(cycle.book_order_start_date);
      const now = new Date();
      if (now < orderStart) {
        return NextResponse.json({ error: '아직 도서 신청 기간이 아닙니다. (' + orderStart.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' 부터 신청 가능)' }, { status: 400 });
      }
    }

    // 2. 선택한 도서가 해당 기수에 속하는지 확인
    const { data: booksData, error: booksErr } = await supabaseAdmin
      .from('books')
      .select('id, cycle_id')
      .in('id', bookIds);

    if (booksErr || !booksData || booksData.length !== bookIds.length) {
      return NextResponse.json({ error: '일부 도서 정보를 확인할 수 없습니다.' }, { status: 400 });
    }

    for (const b of booksData) {
      if (b.cycle_id !== orderData.cycle_id) {
        return NextResponse.json({ error: '선택한 도서가 주문하신 기수와 일치하지 않습니다.' }, { status: 400 });
      }
    }

    // 3. RPC 호출 (세부 제약은 DB 내부에서 처리)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('place_book_order', {
      p_subscription_order_id: subOrderId,
      p_book_ids: bookIds
    });

    if (rpcError) {
      console.error('place_book_order RPC Error:', rpcError);
      return NextResponse.json({ error: rpcError.message || '도서 주문에 실패했습니다.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, newOrderId: rpcData });
  } catch (err: any) {
    console.error('Book Select API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
