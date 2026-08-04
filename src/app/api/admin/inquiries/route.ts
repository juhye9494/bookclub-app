import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: inquiries, error: dbError } = await supabaseAdmin
      .from('inquiries')
      .select('id, user_id, user_email, user_name, user_phone, category, title, content, attachment_url, status, admin_reply, created_at')
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('[INQUIRY_FETCH_FAILED]');
      return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const processedInquiries = await Promise.all((inquiries || []).map(async (inq) => {
      let attachment_signed_url = '';

      if (inq.attachment_url) {
        let filePath = inq.attachment_url;
        if (filePath.startsWith('http')) {
          const marker = '/object/public/inquiry-attachments/';
          const sMarker = '/object/sign/inquiry-attachments/';
          const idx = filePath.indexOf(marker);
          if (idx !== -1) {
            filePath = filePath.substring(idx + marker.length);
          } else {
            const sIdx = filePath.indexOf(sMarker);
            if (sIdx !== -1) {
              filePath = filePath.substring(sIdx + sMarker.length).split('?')[0];
            }
          }
        }

        filePath = decodeURIComponent(filePath).trim();

        if (filePath && !filePath.includes('..') && !filePath.startsWith('/') && !filePath.startsWith('http://') && !filePath.startsWith('https://')) {
          const { data: signedData, error: signedErr } = await supabaseAdmin.storage
            .from('inquiry-attachments')
            .createSignedUrl(filePath, 3600);

          if (signedErr) {
            console.warn('[INQUIRY_SIGNED_URL_FAILED]');
          } else if (signedData?.signedUrl) {
            attachment_signed_url = signedData.signedUrl;
          }
        }
      }

      return {
        id: inq.id,
        user_id: inq.user_id,
        user_email: inq.user_email,
        user_name: inq.user_name,
        user_phone: inq.user_phone,
        category: inq.category,
        title: inq.title,
        content: inq.content,
        attachment_signed_url: attachment_signed_url,
        status: inq.status,
        admin_reply: inq.admin_reply,
        created_at: inq.created_at
      };
    }));

    return NextResponse.json({ data: processedInquiries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[INQUIRY_GET_ERROR]');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
