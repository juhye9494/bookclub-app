import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, profileSetupToken, name, phone, address } = body;

    // A. 입력값 검증
    if (
      typeof userId !== 'string' ||
      typeof profileSetupToken !== 'string' ||
      typeof name !== 'string' ||
      typeof phone !== 'string' ||
      typeof address !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid input types' }, { status: 400 });
    }

    if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(profileSetupToken)) {
      return NextResponse.json({ error: 'Invalid identifier format' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedPhone || !trimmedAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (trimmedName.length > 100 || trimmedPhone.length > 50 || trimmedAddress.length > 500) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    // B. 실제 Auth 사용자 확인
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // C. 일회용 난수 확인
    const currentToken = authData.user.user_metadata?.profile_setup_token;
    
    if (!currentToken || currentToken !== profileSetupToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // D. profiles 저장 (요청 이메일 대신 확인된 auth 이메일 사용)
    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: authData.user.email,
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress
      }, {
        onConflict: 'id'
      });

    if (upsertError) {
      // 서버 로그에 개인정보 출력 제외, 최소한의 에러 기록만
      console.error('[Finalize Profile] Profiles Upsert Error (User ID masked)');
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }

    // E. Auth 메타데이터 정리
    const currentMetadata = authData.user.user_metadata || {};
    const safeMetadata = { ...currentMetadata };
    
    delete safeMetadata.profile_setup_token;
    delete safeMetadata.name;
    delete safeMetadata.phone;
    delete safeMetadata.address;
    delete safeMetadata.has_paid;

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: safeMetadata
    });

    if (updateAuthError) {
      console.error('[Finalize Profile] Auth Metadata Cleanup Error');
      return NextResponse.json({ error: 'Failed to complete profile setup' }, { status: 500 });
    }

    // F. 성공 응답
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[Finalize Profile] Internal Server Error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
