import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptProfilePii } from '@/lib/server/piiCrypto';
import { encryptInquiryPii } from '@/lib/server/inquiryPiiCrypto';
import crypto from 'crypto';

export async function POST(req: Request) {
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
    if (userError || !user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const formData = await req.formData();
    const category = formData.get('category')?.toString();
    const title = formData.get('title')?.toString();
    const content = formData.get('content')?.toString();
    const attachment = formData.get('attachment') as File | null;

    if (!category || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    if (title.trim().length === 0 || title.length > 200) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    if (content.trim().length === 0 || content.length > 5000) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const CATEGORIES = ['가입문의', '배송문의', '교환문의', '환불문의', '저자 섭외 문의', '독서모임 활동비 신청', '기타 문의'];
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('name, phone, phone_enc, pii_key_version')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    let phone = profile.phone || '';
    if (profile.phone_enc !== null && profile.phone_enc !== undefined) {
      if (profile.pii_key_version !== 1) {
        console.error('inquiry creation failed');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }
      try {
        phone = decryptProfilePii(profile.phone_enc, { profileId: user.id, field: 'phone' });
      } catch (err) {
        console.error('inquiry creation failed');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const userName = profile.name && profile.name.trim() !== '' ? profile.name : (user.email || '이름 없음');
    const userEmail = user.email || '이메일 없음';
    const userPhone = phone && phone.trim() !== '' ? phone : '전화번호 없음';

    const inquiryId = crypto.randomUUID();

    let encryptedName;
    let encryptedEmail;
    let encryptedPhone;

    try {
      encryptedName = encryptInquiryPii('user_name', inquiryId, userName);
      encryptedEmail = encryptInquiryPii('user_email', inquiryId, userEmail);
      encryptedPhone = encryptInquiryPii('user_phone', inquiryId, userPhone);
    } catch (err) {
      console.error('inquiry creation failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const keyVersion = encryptedName.keyVersion;
    if (
      !Number.isInteger(keyVersion) || keyVersion <= 0 ||
      encryptedEmail.keyVersion !== keyVersion ||
      encryptedPhone.keyVersion !== keyVersion
    ) {
      console.error('inquiry creation failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    let attachmentUrl = '';
    if (attachment) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(attachment.type)) {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      if (attachment.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }

      const fileExt = attachment.name.split('.').pop() || 'tmp';
      const randomUuid = crypto.randomUUID();
      const filePath = `${user.id}/${randomUuid}.${fileExt}`;

      const arrayBuffer = await attachment.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from('inquiry-attachments')
        .upload(filePath, buffer, {
          contentType: attachment.type,
          upsert: false
        });

      if (uploadError) {
        console.error('inquiry creation failed');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }
      attachmentUrl = filePath;
    }

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('inquiries')
      .insert([{
        id: inquiryId,
        user_id: user.id,
        user_name: userName,
        user_email: userEmail,
        user_phone: userPhone,
        user_name_enc: encryptedName.encryptedValue,
        user_email_enc: encryptedEmail.encryptedValue,
        user_phone_enc: encryptedPhone.encryptedValue,
        pii_key_version: keyVersion,
        category,
        title,
        content,
        attachment_url: attachmentUrl
      }])
      .select('id')
      .maybeSingle();

    if (insertError || !insertData) {
      console.error('inquiry creation failed');
      if (attachmentUrl) {
        await supabaseAdmin.storage.from('inquiry-attachments').remove([attachmentUrl]);
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ success: true, id: insertData.id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('inquiry creation failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
