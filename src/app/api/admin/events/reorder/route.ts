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

    const { list } = await req.json();
    if (!Array.isArray(list)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    for (let i = 0; i < list.length; i++) {
      await supabaseAdmin.from('events').update({ order_idx: i }).eq('id', list[i].id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Admin Event Reorder API Error]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
