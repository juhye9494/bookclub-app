import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const { title, content, is_pinned, image_urls } = body;

    if (!title || !content) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
    }

    // Get current notice to find deleted images
    const { data: currentNotice } = await supabaseAdmin.from('notices').select('image_urls').eq('id', id).single();

    if (currentNotice && currentNotice.image_urls) {
      const currentUrls = currentNotice.image_urls as string[];
      const newUrls = (image_urls || []) as string[];
      
      const deletedUrls = currentUrls.filter(url => !newUrls.includes(url));
      
      if (deletedUrls.length > 0) {
        const deletedPaths = deletedUrls.map(url => {
          const parts = url.split('/notices/');
          return parts.length > 1 ? parts.pop() : null;
        }).filter(Boolean) as string[];

        if (deletedPaths.length > 0) {
          await supabaseAdmin.storage.from('notices').remove(deletedPaths);
        }
      }
    }

    const { data, error: updateErr } = await supabaseAdmin
      .from('notices')
      .update({
        title,
        content,
        is_pinned: !!is_pinned,
        image_urls: Array.isArray(image_urls) ? image_urls : [],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[Admin Notice Update Error]', updateErr);
      return NextResponse.json({ error: 'Failed to update notice' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Admin Notice API PUT Error]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    // Get current notice to delete associated images
    const { data: currentNotice } = await supabaseAdmin.from('notices').select('image_urls').eq('id', id).single();

    if (currentNotice && currentNotice.image_urls && currentNotice.image_urls.length > 0) {
      const deletedPaths = currentNotice.image_urls.map((url: string) => {
        const parts = url.split('/notices/');
        return parts.length > 1 ? parts.pop() : null;
      }).filter(Boolean) as string[];

      if (deletedPaths.length > 0) {
        await supabaseAdmin.storage.from('notices').remove(deletedPaths);
      }
    }

    const { error: deleteErr } = await supabaseAdmin.from('notices').delete().eq('id', id);

    if (deleteErr) {
      console.error('[Admin Notice Delete Error]', deleteErr);
      return NextResponse.json({ error: 'Failed to delete notice' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Admin Notice API DELETE Error]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
