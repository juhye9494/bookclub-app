import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const match = authHeader.match(/^Bearer ([^\s]+)$/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: history, error: historyErr } = await supabaseAdmin
      .from('marketing_consent_history')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (historyErr) {
      console.error('Failed to fetch history:', historyErr);
      return NextResponse.json({ error: '이력을 불러오지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      history: history || []
    });

  } catch (error: any) {
    console.error('history api error:', error);
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 });
  }
}
