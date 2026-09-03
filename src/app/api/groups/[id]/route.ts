import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export const dynamic = 'force-dynamic';

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
    
    const isCreator = group.creator_id === user.id;
    const isUserAdmin = isAdmin(user.email);
    
    if (!isCreator && !isUserAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();

    const { error: updateError } = await supabaseAdmin
      .from('groups')
      .update(body)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
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
    
    const isCreator = group.creator_id === user.id;
    const isUserAdmin = isAdmin(user.email);
    
    if (!isCreator && !isUserAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: deletedRows, error: deleteError } = await supabaseAdmin
      .from('groups')
      .delete()
      .eq('id', id)
      .select('id');

    if (deleteError || !deletedRows || deletedRows.length !== 1) {
      return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
