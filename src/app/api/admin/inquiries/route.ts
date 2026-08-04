import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptInquiryPii } from '@/lib/server/inquiryPiiCrypto';

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
      .select('id, user_id, user_email, user_name, user_phone, user_email_enc, user_name_enc, user_phone_enc, pii_key_version, category, title, content, attachment_url, status, admin_reply, created_at')
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

      let userName = inq.user_name;
      let userEmail = inq.user_email;
      let userPhone = inq.user_phone;

      const hasAnyEnc = inq.user_name_enc || inq.user_email_enc || inq.user_phone_enc;
      const hasAllEnc = inq.user_name_enc && inq.user_email_enc && inq.user_phone_enc;
      const hasVersion = inq.pii_key_version && inq.pii_key_version > 0;

      if (!hasAnyEnc && !inq.pii_key_version) {
        // Plaintext fallback
      } else if (hasAllEnc && hasVersion) {
        try {
          userName = decryptInquiryPii('user_name', inq.id, inq.user_name_enc, inq.pii_key_version);
          userEmail = decryptInquiryPii('user_email', inq.id, inq.user_email_enc, inq.pii_key_version);
          userPhone = decryptInquiryPii('user_phone', inq.id, inq.user_phone_enc, inq.pii_key_version);
        } catch (err) {
          throw new Error('Decryption failed');
        }
      } else {
        throw new Error('Invalid encryption state');
      }

      return {
        id: inq.id,
        user_id: inq.user_id,
        user_email: userEmail,
        user_name: userName,
        user_phone: userPhone,
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
