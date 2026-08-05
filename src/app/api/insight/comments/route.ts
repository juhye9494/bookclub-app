import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId')?.trim();

    if (!postId || postId.length < 1 || postId.length > 200 || /[\x00-\x1F\x7F]/.test(postId)) {
      return jsonNoStore({ error: 'Invalid post ID' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = req.headers.get('Authorization');
    let currentUser: any = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) currentUser = user;
    }

    const { data: comments, error } = await supabaseAdmin
      .from('insight_comments')
      .select('id, user_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('insight comment lookup failed');
      return jsonNoStore({ error: 'Failed to lookup comments' }, { status: 500 });
    }

    if (!comments || comments.length === 0) {
      return jsonNoStore({ comments: [], count: 0 });
    }

    const userIds = Array.from(new Set(comments.map((c: any) => c.user_id)));
    
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    if (profileError) {
      console.error('insight comment lookup failed');
      return jsonNoStore({ error: 'Failed to lookup comments' }, { status: 500 });
    }

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p.name]) || []);

    const resultComments = comments.map((c: any) => {
      const pName = profileMap.get(c.user_id);
      const author_name = pName && typeof pName === 'string' && pName.trim() !== '' ? pName : '회원';
      const can_delete = currentUser ? (c.user_id === currentUser.id || isAdmin(currentUser.email)) : false;
      
      return {
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author_name,
        can_delete
      };
    });

    return jsonNoStore({ comments: resultComments, count: resultComments.length });
  } catch (err) {
    console.error('insight comment lookup failed');
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const postId = typeof body.postId === 'string' ? body.postId.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!postId || postId.length < 1 || postId.length > 200 || /[\x00-\x1F\x7F]/.test(postId)) {
      return jsonNoStore({ error: 'Invalid post ID' }, { status: 400 });
    }
    
    if (!content || content.length < 1 || content.length > 500) {
      return jsonNoStore({ error: 'Invalid content length' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.name?.trim()) {
      return jsonNoStore({ error: '프로필 이름을 먼저 설정해 주세요.' }, { status: 400 });
    }

    const { error: insertError } = await supabaseAdmin
      .from('insight_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content
      });

    if (insertError) {
      console.error('insight comment creation failed');
      return jsonNoStore({ error: 'Failed to create comment' }, { status: 500 });
    }

    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('insight comment creation failed');
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}
