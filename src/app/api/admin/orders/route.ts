import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }
    const match = authHeader.match(/^Bearer ([^\s]+)$/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: orders, error: dbError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, cycle_id, total_amount, payment_status, created_at')
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json({ error: '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    return NextResponse.json(
      { orders },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ error: '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
