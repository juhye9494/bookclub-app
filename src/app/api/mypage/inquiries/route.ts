import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabaseAdmin
      .from('inquiries')
      .select('id, category, title, content, attachment_url, status, admin_reply, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MYPAGE_INQUIRY_FETCH_ERROR]');
      return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500 });
    }

    const result = [];
    for (const inq of (data || [])) {
      let attachment_signed_url: string | undefined;

      if (inq.attachment_url) {
        let filePath = inq.attachment_url;
        if (filePath.startsWith('http')) {
          const publicMarker = '/object/public/inquiry-attachments/';
          const signedMarker = '/object/sign/inquiry-attachments/';
          if (filePath.includes(publicMarker)) {
            filePath = filePath.split(publicMarker)[1].split('?')[0];
          } else if (filePath.includes(signedMarker)) {
            filePath = filePath.split(signedMarker)[1].split('?')[0];
          }
        }

        if (filePath) {
          filePath = decodeURIComponent(filePath).trim();
          const { data: signedData, error: signedErr } = await supabaseAdmin.storage
            .from('inquiry-attachments')
            .createSignedUrl(filePath, 3600);

          if (signedErr) {
            console.warn(`[MYPAGE_INQUIRY_ATTACHMENT_URL_FAILED] ID: ${inq.id}`);
          } else if (signedData?.signedUrl) {
            attachment_signed_url = signedData.signedUrl;
          }
        }
      }

      result.push({
        id: inq.id,
        category: inq.category,
        title: inq.title,
        content: inq.content,
        status: inq.status,
        admin_reply: inq.admin_reply,
        created_at: inq.created_at,
        attachment_signed_url
      });
    }

    return NextResponse.json(
      { data: result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[MYPAGE_INQUIRY_INTERNAL_ERROR]');
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
