import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postIdsParam = searchParams.get('postIds');

    if (!postIdsParam) {
      return jsonNoStore({ error: 'Invalid post IDs' }, { status: 400 });
    }

    const postIds = Array.from(new Set(postIdsParam.split(',').map(id => id.trim())));

    if (postIds.length < 1 || postIds.length > 100) {
      return jsonNoStore({ error: 'Invalid post IDs length' }, { status: 400 });
    }

    for (const id of postIds) {
      if (id.length < 1 || id.length > 200 || /[\x00-\x1F\x7F]/.test(id)) {
        return jsonNoStore({ error: 'Invalid post ID format' }, { status: 400 });
      }
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('insight_comments')
      .select('post_id')
      .in('post_id', postIds);

    if (error) {
      console.error('insight comment count lookup failed');
      return jsonNoStore({ error: '댓글 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    for (const id of postIds) {
      counts[id] = 0;
    }

    if (data) {
      for (const row of data) {
        if (counts[row.post_id] !== undefined) {
          counts[row.post_id]++;
        }
      }
    }

    return jsonNoStore({ counts });
  } catch (err) {
    console.error('insight comment count lookup failed');
    return jsonNoStore({ error: '댓글 수를 불러오지 못했습니다.' }, { status: 500 });
  }
}
