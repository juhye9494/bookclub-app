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

    // PENDING 상태의 주문 사전 생성
    const { error: insertError } = await supabaseAdmin.from('orders').insert([{
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.name || 'Unknown',
      user_phone: user.user_metadata?.phone || 'Unknown',
      user_address: user.user_metadata?.address || 'Unknown',
      selected_books: books || [],
      total_amount: EXPECTED_AMOUNT,
      payment_order_id: orderId,
      payment_status: 'PENDING',
      is_test: isTest
    }]);

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
