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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { books } = body;

    if (!books || !Array.isArray(books) || books.length !== 4) {
      return NextResponse.json({ error: '정확히 4권의 도서를 선택해주세요.' }, { status: 400 });
    }

    // 중복 체크
    const bookIds = books.map(b => b.id);
    const uniqueIds = new Set(bookIds);
    if (uniqueIds.size !== 4) {
      return NextResponse.json({ error: '중복된 도서가 포함되어 있습니다.' }, { status: 400 });
    }

    // 활성 기수 정보 확인
    const { data: cycles } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1);

    if (!cycles || cycles.length === 0) {
      return NextResponse.json({ error: '현재 활성화된 기수(독서클럽) 정보가 없습니다.' }, { status: 400 });
    }
    const activeCycle = cycles[0];

    // 선택 가능 기간(selection_start_date, selection_end_date) 검사 로직
    // 만약 DB에 해당 컬럼이 없거나 NULL이면 cycle의 start_date, end_date를 대체로 사용
    const now = new Date();
    const selStartStr = activeCycle.selection_start_date || activeCycle.start_date;
    const selEndStr = activeCycle.selection_end_date || activeCycle.end_date;
    
    let isSelectionPeriod = false;
    if (selStartStr && selEndStr) {
      const selStart = new Date(selStartStr);
      const selEnd = new Date(selEndStr);
      // 종료일은 해당 일의 23:59:59까지로 간주
      selEnd.setHours(23, 59, 59, 999);
      isSelectionPeriod = now >= selStart && now <= selEnd;
    } else {
      isSelectionPeriod = true;
    }

    const testUserIds = (process.env.INTERNAL_PAYMENT_TEST_USER_IDS || '').split(',').map(id => id.trim());
    const isTestUser = testUserIds.includes(user.id);

    if (!isSelectionPeriod && !isTestUser) {
      return NextResponse.json({ error: '신청 기간은 8월 1일부터입니다.' }, { status: 403 });
    }

    // 실제 등록된 도서인지 검증
    const { data: validBooks } = await supabaseAdmin
      .from('books')
      .select('id, cycle_id')
      .in('id', bookIds);

    if (!validBooks || validBooks.length !== 4) {
      return NextResponse.json({ error: '유효하지 않은 도서가 포함되어 있습니다.' }, { status: 400 });
    }

    for (const vb of validBooks) {
      if (vb.cycle_id !== activeCycle.id) {
        return NextResponse.json({ error: '현재 기수에서 선택할 수 없는 도서가 포함되어 있습니다.' }, { status: 400 });
      }
    }

    // 유효한 DONE 주문 조회 (결제 완료된 주문이면서 현재 기수인 경우)
    const { data: doneOrders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_status', 'DONE')
      .eq('cycle_id', activeCycle.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!doneOrders || doneOrders.length === 0) {
      return NextResponse.json({ error: '결제 완료된 구독 내역(DONE 주문)이 없거나, 현재 기수에 해당하는 구독 내역이 아닙니다.' }, { status: 403 });
    }

    const order = doneOrders[0];

    // 도서 재선택 가능 조건 검증 (배송 처리가 시작된 경우 불가)
    if (order.order_status !== '배송준비중' && order.order_status !== 'PENDING' && order.order_status !== '결제완료') {
      return NextResponse.json({ error: `이미 ${order.order_status} 상태이므로 도서 선택을 변경할 수 없습니다.` }, { status: 400 });
    }

    // 선택 도서 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ selected_books: books })
      .eq('id', order.id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[SUPABASE_ERROR] Failed to save selected books:', updateError);
      return NextResponse.json({ error: '도서 선택 정보를 저장하는 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '도서 선택이 성공적으로 저장되었습니다.' });
  } catch (err: any) {
    console.error('[API_BOOKS_SELECT_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
