import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: cycles, error: fetchErr } = await supabaseAdmin.from('cycles').select('*').order('subscription_start_date', { ascending: false });
    if (fetchErr) throw fetchErr;

    return NextResponse.json({ cycles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { id, name, subscription_start_date, subscription_end_date, book_order_start_date, book_order_end_date, shipping_start_date, operation_end_date, max_book_count, status } = body;

    if (!id || !name || !subscription_start_date || !subscription_end_date || !book_order_start_date || !book_order_end_date || !shipping_start_date || !operation_end_date) {
      return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 });
    }

    if (new Date(subscription_start_date) >= new Date(subscription_end_date)) return NextResponse.json({ error: '구독 시작일은 종료일보다 이전이어야 합니다.' }, { status: 400 });
    if (new Date(book_order_start_date) >= new Date(book_order_end_date)) return NextResponse.json({ error: '도서 주문 시작일은 종료일보다 이전이어야 합니다.' }, { status: 400 });
    if (new Date(shipping_start_date) > new Date(operation_end_date)) return NextResponse.json({ error: '배송 시작일은 운영 종료일 이전이어야 합니다.' }, { status: 400 });
    if (max_book_count < 1) return NextResponse.json({ error: '최대 도서 권수는 1 이상이어야 합니다.' }, { status: 400 });

    const { data: existing } = await supabaseAdmin.from('cycles').select('id').eq('id', id).single();
    if (existing) return NextResponse.json({ error: '이미 존재하는 기수 ID입니다.' }, { status: 400 });

    const { error: insertErr } = await supabaseAdmin.from('cycles').insert({
      id, name, subscription_start_date, subscription_end_date, book_order_start_date, book_order_end_date, shipping_start_date, operation_end_date, max_book_count, status: status || 'upcoming'
    });

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
