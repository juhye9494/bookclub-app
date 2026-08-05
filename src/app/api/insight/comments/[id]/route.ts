import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { id } = await context.params;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return jsonNoStore({ error: 'Invalid comment ID' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: comment, error: fetchError } = await supabaseAdmin
      .from('insight_comments')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !comment) {
      return jsonNoStore({ error: 'Not found' }, { status: 404 });
    }

    if (comment.user_id !== user.id && !isAdmin(user.email)) {
      return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('insight_comments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('insight comment deletion failed');
      return jsonNoStore({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('insight comment deletion failed');
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}
