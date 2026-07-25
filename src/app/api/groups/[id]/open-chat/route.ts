import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function initClients(req: Request) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  
  const token = authHeader.slice(7).trim();
  if (!token) throw new Error('Unauthorized');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) throw new Error('Server configuration error');

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  
  return { supabaseAuth, supabaseAdmin, token };
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    let clients;
    try {
      clients = initClients(req);
    } catch (e: any) {
      if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const { supabaseAuth, supabaseAdmin, token } = clients;
    const { id } = await context.params;

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('creator_id, membersCount, maxMembers, status')
      .eq('id', id)
      .single();

    if (groupError || !group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    const isCreator = group.creator_id === user.id;

    if (!isCreator) {
      const isClosed = group.membersCount >= group.maxMembers || group.status === '모집마감';
      if (isClosed) return NextResponse.json({ error: 'Recruitment is closed' }, { status: 403 });

      const { data: memberData } = await supabaseAdmin
        .from('group_participants')
        .select('id')
        .eq('group_id', id)
        .eq('user_id', user.id)
        .eq('role', 'member')
        .single();
      
      if (!memberData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('group_open_chat_links')
      .select('open_chat_url')
      .eq('group_id', id)
      .single();

    if (linkError || !linkData) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    return NextResponse.json(
      { url: linkData.open_chat_url },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    let clients;
    try {
      clients = initClients(req);
    } catch (e: any) {
      if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const { supabaseAuth, supabaseAdmin, token } = clients;
    const { id } = await context.params;

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (groupError || !group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    if (group.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { open_chat_url } = body;

    const trimmed = (open_chat_url || '').trim();
    if (!trimmed) {
      const { error: deleteError } = await supabaseAdmin
        .from('group_open_chat_links')
        .delete()
        .eq('group_id', id);
      
      if (deleteError) {
        return NextResponse.json({ error: 'Failed to delete open chat URL' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    let validUrl = '';
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'open.kakao.com') {
        return NextResponse.json({ error: 'Invalid open chat URL' }, { status: 400 });
      }
      validUrl = parsed.toString();
    } catch {
      return NextResponse.json({ error: 'Invalid open chat URL' }, { status: 400 });
    }

    const { error: upsertError } = await supabaseAdmin
      .from('group_open_chat_links')
      .upsert({
        group_id: id,
        open_chat_url: validUrl,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to save open chat URL' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
