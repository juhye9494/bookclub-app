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
    
    // JWT 검증을 위한 클라이언트 생성 (인증용)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { books } = body;

    // 결제 환경 판별
    const isProduction = process.env.VERCEL_ENV === 'production';
    const isTest = !isProduction;
    
    // 고유 주문번호 생성
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const EXPECTED_AMOUNT = 45000;

    // DB 쓰기를 위한 Service Role 클라이언트 생성 (서버 전용 환경변수 사용)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel environment.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);



    // 2. 현재 활성화된 기수(Cycle) 식별
    const { data: cycles } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1);

    const activeCycle = cycles && cycles.length > 0 ? cycles[0] : null;
    if (!activeCycle) {
      return NextResponse.json({ error: '현재 결제 가능한 활성 기수가 없습니다.' }, { status: 400 });
    }

    const activeCycleId = activeCycle.id;

    // 2.5 신청 기간 및 테스트 계정 확인
    const now = new Date();
    const selStartStr = activeCycle.selection_start_date || activeCycle.start_date;
    const selEndStr = activeCycle.selection_end_date || activeCycle.end_date;
    
    let isSelectionPeriod = false;
    if (selStartStr && selEndStr) {
      const selStart = new Date(selStartStr);
      const selEnd = new Date(selEndStr);
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

    // 3. DB 기반 중복 결제 차단 로직 (해당 기수에 대한 유효한 DONE 주문 확인)
    const { data: existingOrders, error: checkError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('payment_status', 'DONE')
      .eq('cycle_id', activeCycleId);

    if (checkError) {
      console.error('[SUPABASE_ERROR] Init - Failed to check existing orders:', checkError);
      return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
    }

    if (existingOrders && existingOrders.length > 0) {
      console.warn(`[PAYMENT_INIT] 중복 결제 차단(DB). User ID: ${user.id}, Cycle ID: ${activeCycleId}`);
      return NextResponse.json({ error: '이미 해당 기수를 구독 중인 회원입니다.' }, { status: 409 });
    }

    // PENDING 상태의 주문 사전 생성
    const { data: newOrder, error: insertError } = await supabaseAdmin.from('orders').insert([{
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.name || 'Unknown',
      user_phone: user.user_metadata?.phone || 'Unknown',
      user_address: user.user_metadata?.address || 'Unknown',
      selected_books: [], // 도서 선택은 결제 완료 후 마이페이지에서 별도로 진행
      cycle_id: activeCycleId, // 현재 결제 중인 기수 연결
      total_amount: EXPECTED_AMOUNT,
      payment_order_id: orderId,
      payment_status: 'PENDING',
      is_test: isTest
    }]).select().single();

    if (insertError) {
      console.error('[SUPABASE_ERROR] Init - Failed to pre-create order:', insertError);
      return NextResponse.json({ error: '주문 초기화에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId, amount: EXPECTED_AMOUNT });
  } catch (err: any) {
    console.error('[PAYMENT_INIT_ERROR]', err.message);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
