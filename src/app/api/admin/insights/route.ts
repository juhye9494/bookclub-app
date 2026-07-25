import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdmin(user.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      author,
      day,
      type,
      date,
      summary,
      content,
      cover,
      likes,
      order_idx
    } = body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof author !== 'string' ||
      !author.trim()
    ) {
      return NextResponse.json({ error: 'Invalid insight data' }, { status: 400 });
    }

    if (likes !== undefined && (typeof likes !== 'number' || !Number.isFinite(likes))) {
      return NextResponse.json({ error: 'Invalid insight data' }, { status: 400 });
    }

    if (order_idx !== undefined && (typeof order_idx !== 'number' || !Number.isFinite(order_idx))) {
      return NextResponse.json({ error: 'Invalid insight data' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const newPost = {
      id: 'insight-' + Date.now(),
      title: title.trim(),
      author: author.trim(),
      day: day || '',
      type: type || '',
      date: date || '',
      summary: summary || null,
      content: content || null,
      cover: cover || null,
      likes: likes !== undefined ? likes : 0,
      order_idx: order_idx !== undefined ? order_idx : 0
    };

    const { data, error } = await supabaseAdmin
      .from('insights')
      .insert(newPost)
      .select()
      .single();

    if (error) {
      console.error('Error inserting insight');
      return NextResponse.json({ error: 'Failed to insert insight' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in insights POST');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
