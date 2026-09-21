import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function POST(req: Request) {
  try {
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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 서버 사이드 유효성 검사 (MIME 타입 및 용량 제한)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({ error: '지원되지 않는 파일 형식입니다. (JPG, PNG, WEBP만 허용)' }, { status: 400 });
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: '파일 용량이 너무 큽니다. (최대 5MB)' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const extension = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${crypto.randomUUID()}.${extension}`;
    const filePath = `${fileName}`;

    const { data, error: uploadErr } = await supabaseAdmin.storage
      .from('notices')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadErr) {
      console.error('[Admin Notice Image Upload Error]', uploadErr);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('notices').getPublicUrl(filePath);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl, path: filePath });
  } catch (err: any) {
    console.error('[Admin Notice Image Upload Exception]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
