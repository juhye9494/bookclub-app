import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const filePath = formData.get('filePath') as string;

    if (!file || !filePath) {
      return NextResponse.json({ error: '파일과 경로가 필요합니다.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { error: uploadError } = await supabaseAdmin.storage.from('books').upload(filePath, file);

    if (uploadError) {
      return NextResponse.json({ error: '업로드에 실패했습니다.' }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('books').getPublicUrl(filePath);

    return NextResponse.json({ publicUrl: publicUrlData.publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: '업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
