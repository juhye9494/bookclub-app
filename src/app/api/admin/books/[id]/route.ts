import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookId } = await context.params;
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
    
    // We allow partial updates
    const { cycle_id, title, author, genre, description, cover, tags, is_public, is_orderable, is_deleted, order_idx, lecture, bg_color, bg_color_dark } = body;

    const { error: updateErr } = await supabaseAdmin.from('books').update({
      cycle_id, title, author, genre, description, cover, tags, is_public, is_orderable, is_deleted, order_idx, lecture, bg_color, bg_color_dark
    }).eq('id', bookId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
