import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

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
    const { cycle_id, title, author, genre, description, cover, tags, is_public, is_orderable, is_deleted, order_idx, lecture, bg_color, bg_color_dark, isbn } = body;

    if (!cycle_id || !title) {
      return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 });
    }

    const id = `b-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const insertPayload: any = {
      id, cycle_id, title, author, genre, description, cover, tags, is_public, is_orderable, is_deleted, order_idx, lecture, bg_color, bg_color_dark
    };
    if (isbn !== undefined) insertPayload.isbn = isbn;

    const { data, error: insertErr } = await supabaseAdmin.from('books').insert(insertPayload).select().single();

    if (insertErr) {
      console.error('[Admin Book Insert Error]', insertErr.code);
      return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Admin Book API Error]');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
