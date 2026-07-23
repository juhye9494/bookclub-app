import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();

    const { data: cycles, error } = await supabaseAdmin
      .from('cycles')
      .select('id, name, subscription_start_date, subscription_end_date, selection_start_date, selection_end_date, max_book_count, status')
      .neq('status', 'closed')
      .lte('subscription_start_date', now)
      .gte('subscription_end_date', now)
      .order('subscription_start_date', { ascending: false });

    if (error) {
      console.error('Fetch open cycles error:', error);
      return NextResponse.json({ error: '기수 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ cycles });
  } catch (err: any) {
    console.error('Cycles Open API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
