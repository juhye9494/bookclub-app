import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: inquiryId } = await params;
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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get inquiry to check attachment
    const { data: inquiry, error: getError } = await supabaseAdmin
      .from('inquiries')
      .select('attachment_url')
      .eq('id', inquiryId)
      .single();

    if (getError || !inquiry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Delete DB row first
    const { data: deletedInquiry, error: deleteError } = await supabaseAdmin
      .from('inquiries')
      .delete()
      .eq('id', inquiryId)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      return NextResponse.json({ error: '문의 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!deletedInquiry) {
      return NextResponse.json({ error: '삭제할 문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Cleanup storage after DB delete success
    if (inquiry.attachment_url) {
      try {
        let filePath: string | null = null;
        const attachmentUrl = inquiry.attachment_url;

        if (attachmentUrl.startsWith('http')) {
          const publicMarker = '/object/public/inquiry-attachments/';
          const signedMarker = '/object/sign/inquiry-attachments/';

          if (attachmentUrl.includes(publicMarker)) {
            filePath = attachmentUrl.split(publicMarker)[1].split('?')[0];
          } else if (attachmentUrl.includes(signedMarker)) {
            filePath = attachmentUrl.split(signedMarker)[1].split('?')[0];
          }
        } else {
          filePath = attachmentUrl.split('?')[0];
        }

        if (filePath) {
          filePath = decodeURIComponent(filePath).trim();
          
          if (
            filePath &&
            !filePath.includes('..') &&
            !filePath.startsWith('/') &&
            !filePath.startsWith('http://') &&
            !filePath.startsWith('https://')
          ) {
            const { error: storageError } = await supabaseAdmin.storage
              .from('inquiry-attachments')
              .remove([filePath]);

            if (storageError) {
              console.warn('[INQUIRY_ATTACHMENT_CLEANUP_FAILED]');
            }
          }
        }
      } catch (e) {
        console.warn('[INQUIRY_ATTACHMENT_CLEANUP_FAILED]');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
