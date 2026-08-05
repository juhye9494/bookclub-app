import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) {
      return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { cohortId, orderedBookIds } = body;

    if (!cohortId || typeof cohortId !== 'string') {
      return jsonNoStore({ error: 'Invalid input' }, { status: 400 });
    }

    if (!Array.isArray(orderedBookIds) || new Set(orderedBookIds).size !== orderedBookIds.length) {
      return jsonNoStore({ error: 'Invalid input' }, { status: 400 });
    }

    const { error: rpcError } = await supabaseAdmin.rpc('reorder_books_atomic', {
      p_cycle_id: cohortId,
      p_ordered_book_ids: orderedBookIds,
    });

    if (rpcError) {
      console.error('book reorder failed');
      return jsonNoStore({ error: 'Failed to reorder books' }, { status: 500 });
    }

    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('book reorder failed');
    return jsonNoStore({ error: 'Internal Server Error' }, { status: 500 });
  }
}
