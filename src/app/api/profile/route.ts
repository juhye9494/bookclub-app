import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  decryptProfilePii,
  encryptProfilePii,
  PiiCryptoError,
} from '@/lib/server/piiCrypto';

function getSupabaseClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env vars');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

function extractToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer ([^\s]+)$/);

  return match?.[1] ?? null;
}

function handleCryptoError(error: unknown) {
  // We log nothing about PII or tokens.
  return NextResponse.json({ error: '프로필 정보를 안전하게 처리하지 못했습니다.' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('id, email, name, phone, address, phone_enc, address_enc, pii_key_version, has_paid, created_at')
      .eq('id', user.id)
      .single();

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
      }
      return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    }

    let phone = profile.phone;
    let address = profile.address;

    if (profile.phone_enc !== null && profile.phone_enc !== undefined) {
      if (profile.pii_key_version !== 1) throw new PiiCryptoError('PII_VERSION_UNSUPPORTED');
      phone = decryptProfilePii(profile.phone_enc, { profileId: user.id, field: 'phone' });
    }

    if (profile.address_enc !== null && profile.address_enc !== undefined) {
      if (profile.pii_key_version !== 1) throw new PiiCryptoError('PII_VERSION_UNSUPPORTED');
      address = decryptProfilePii(profile.address_enc, { profileId: user.id, field: 'address' });
    }

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phone,
      address,
      has_paid: profile.has_paid,
      created_at: profile.created_at
    });

  } catch (err) {
    if (err instanceof PiiCryptoError) return handleCryptoError(err);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
    }

    const allowedKeys = ['name', 'phone', 'address'];
    const invalidKeys = ['id', 'user_id', 'email', 'has_paid', 'phone_enc', 'address_enc', 'pii_key_version', 'created_at'];

    const bodyKeys = Object.keys(body);
    if (bodyKeys.length === 0) {
      return NextResponse.json({ error: '수정할 데이터가 없습니다.' }, { status: 400 });
    }

    for (const key of bodyKeys) {
      if (invalidKeys.includes(key) || !allowedKeys.includes(key)) {
        return NextResponse.json({ error: '허용되지 않은 필드가 포함되어 있습니다.' }, { status: 400 });
      }
    }

    const updates: Record<string, any> = {};
    let requiresKeyVersion = false;

    if ('name' in body) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json({ error: '이름은 비어 있을 수 없습니다.' }, { status: 400 });
      }
      updates.name = body.name;
    }

    if ('phone' in body) {
      if (typeof body.phone !== 'string' || body.phone.trim() === '') {
        return NextResponse.json({ error: '연락처는 필수이며 비어 있을 수 없습니다.' }, { status: 400 });
      }
      updates.phone = body.phone;
      updates.phone_enc = encryptProfilePii(body.phone, { profileId: user.id, field: 'phone' });
      requiresKeyVersion = true;
    }

    if ('address' in body) {
      if (typeof body.address !== 'string') {
        return NextResponse.json({ error: '주소는 문자열이어야 합니다.' }, { status: 400 });
      }
      updates.address = body.address;
      if (body.address.trim() === '') {
        updates.address_enc = null;
      } else {
        updates.address_enc = encryptProfilePii(body.address, { profileId: user.id, field: 'address' });
      }
      requiresKeyVersion = true;
    }

    if (requiresKeyVersion) {
      updates.pii_key_version = 1;
    }

    const { data: updatedProfile, error: dbError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, email, name, phone, address, phone_enc, address_enc, pii_key_version, has_paid, created_at')
      .single();

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        return NextResponse.json(
          { error: '프로필을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: '프로필 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    if (!updatedProfile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    }

    let outPhone = updatedProfile.phone;
    let outAddress = updatedProfile.address;

    if (updatedProfile.phone_enc !== null && updatedProfile.phone_enc !== undefined) {
      if (updatedProfile.pii_key_version !== 1) throw new PiiCryptoError('PII_VERSION_UNSUPPORTED');
      outPhone = decryptProfilePii(updatedProfile.phone_enc, { profileId: user.id, field: 'phone' });
    }

    if (updatedProfile.address_enc !== null && updatedProfile.address_enc !== undefined) {
      if (updatedProfile.pii_key_version !== 1) throw new PiiCryptoError('PII_VERSION_UNSUPPORTED');
      outAddress = decryptProfilePii(updatedProfile.address_enc, { profileId: user.id, field: 'address' });
    }

    return NextResponse.json({
      id: updatedProfile.id,
      email: updatedProfile.email,
      name: updatedProfile.name,
      phone: outPhone,
      address: outAddress,
      has_paid: updatedProfile.has_paid,
      created_at: updatedProfile.created_at
    });

  } catch (err) {
    if (err instanceof PiiCryptoError) return handleCryptoError(err);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
