import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { encryptProfilePii } from '@/lib/server/piiCrypto';

export const dynamic = 'force-dynamic';

function safeResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const match = authHeader?.match(/^Bearer ([^\s]+)$/);
    const token = match?.[1];

    if (!token) {
      return safeResponse({ error: '로그인이 필요합니다.' }, 401);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return safeResponse({ error: '프로필 암호화 작업 중 오류가 발생했습니다.' }, 500);
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user || !user.email) {
      return safeResponse({ error: '로그인이 필요합니다.' }, 401);
    }

    if (!isAdmin(user.email)) {
      return safeResponse({ error: '관리자 권한이 필요합니다.' }, 403);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return safeResponse({ error: '잘못된 마이그레이션 요청입니다.' }, 400);
    }

    if (
      typeof rawBody !== 'object' ||
      rawBody === null ||
      Array.isArray(rawBody)
    ) {
      return safeResponse({ error: '잘못된 마이그레이션 요청입니다.' }, 400);
    }

    const body = rawBody as Record<string, unknown>;
    const keys = Object.keys(body);

    const hasExactKeys =
      keys.length === 2 &&
      keys.includes('mode') &&
      keys.includes('confirmation');

    if (
      !hasExactKeys ||
      (body.mode !== 'dry-run' && body.mode !== 'execute') ||
      body.confirmation !== 'ENCRYPT_EXISTING_PROFILES_V1'
    ) {
      return safeResponse({ error: '잘못된 마이그레이션 요청입니다.' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone, address, phone_enc, address_enc, pii_key_version')
      .order('id', { ascending: true });

    if (fetchError || !profiles) {
      return safeResponse({ error: '프로필 암호화 대상을 확인하지 못했습니다.' }, 500);
    }

    let totalProfiles = profiles.length;
    let alreadyFullyEncrypted = 0;
    let needsPhoneEncryption = 0;
    let needsAddressEncryption = 0;
    let missingPhoneValue = 0;
    let missingAddressValue = 0;
    let invalidExistingRows = 0;

    for (const row of profiles) {
      const hasPhonePlain = typeof row.phone === 'string' && row.phone.trim().length > 0;
      const hasAddressPlain = typeof row.address === 'string' && row.address.trim().length > 0;
      const hasPhoneEnc = !!row.phone_enc;
      const hasAddressEnc = !!row.address_enc;

      if ((hasPhoneEnc || hasAddressEnc) && row.pii_key_version !== 1) {
        invalidExistingRows++;
      }

      const phoneNeedsEnc = hasPhonePlain && !hasPhoneEnc;
      const addressNeedsEnc = hasAddressPlain && !hasAddressEnc;

      if (phoneNeedsEnc) needsPhoneEncryption++;
      if (addressNeedsEnc) needsAddressEncryption++;

      if (!hasPhonePlain) missingPhoneValue++;
      if (!hasAddressPlain) missingAddressValue++;

      if (!phoneNeedsEnc && !addressNeedsEnc) {
        alreadyFullyEncrypted++;
      }
    }

    if (invalidExistingRows > 0) {
      return safeResponse({
        error: '기존 암호화 데이터의 키 버전을 확인해 주세요.',
        invalidExistingRows
      }, 409);
    }

    if (body.mode === 'dry-run') {
      return safeResponse({
        mode: 'dry-run',
        totalProfiles,
        alreadyFullyEncrypted,
        needsPhoneEncryption,
        needsAddressEncryption,
        missingPhoneValue,
        missingAddressValue,
        invalidExistingRows
      });
    }

    let updatedRows = 0;
    let encryptedPhoneRows = 0;
    let encryptedAddressRows = 0;
    let skippedConcurrentRows = 0;
    let failedRows = 0;

    for (const row of profiles) {
      const hasPhonePlain = typeof row.phone === 'string' && row.phone.trim().length > 0;
      const hasAddressPlain = typeof row.address === 'string' && row.address.trim().length > 0;
      const hasPhoneEnc = !!row.phone_enc;
      const hasAddressEnc = !!row.address_enc;

      const phoneNeedsEnc = hasPhonePlain && !hasPhoneEnc;
      const addressNeedsEnc = hasAddressPlain && !hasAddressEnc;

      if (!phoneNeedsEnc && !addressNeedsEnc) {
        continue;
      }

      type EncryptionUpdate = {
        pii_key_version: 1;
        phone_enc?: string;
        address_enc?: string;
      };

      const payload: EncryptionUpdate = {
        pii_key_version: 1,
      };
      
      if (phoneNeedsEnc) {
        try {
          payload.phone_enc = encryptProfilePii(row.phone, { profileId: row.id, field: 'phone' });
        } catch {
          failedRows++;
          continue;
        }
      }

      if (addressNeedsEnc) {
        try {
          payload.address_enc = encryptProfilePii(row.address, { profileId: row.id, field: 'address' });
        } catch {
          failedRows++;
          continue;
        }
      }

      let query = supabaseAdmin.from('profiles').update(payload).eq('id', row.id);
      if (phoneNeedsEnc && typeof row.phone === 'string') {
        query = query.is('phone_enc', null).eq('phone', row.phone);
      }
      if (addressNeedsEnc && typeof row.address === 'string') {
        query = query.is('address_enc', null).eq('address', row.address);
      }
      
      const { data, error: updateError } = await query.select('id').maybeSingle();

      if (updateError) {
        failedRows++;
      } else if (!data) {
        skippedConcurrentRows++;
      } else {
        updatedRows++;
        if (phoneNeedsEnc) encryptedPhoneRows++;
        if (addressNeedsEnc) encryptedAddressRows++;
      }
    }

    if (failedRows > 0) {
      return safeResponse({
        error: '일부 프로필을 암호화하지 못했습니다.',
        updatedRows,
        failedRows,
        skippedConcurrentRows
      }, 500);
    }

    return safeResponse({
      mode: 'execute',
      totalProfiles,
      updatedRows,
      encryptedPhoneRows,
      encryptedAddressRows,
      alreadyEncryptedRows: alreadyFullyEncrypted,
      missingPhoneValue,
      missingAddressValue,
      skippedConcurrentRows,
      failedRows
    });

  } catch {
    return safeResponse({ error: '프로필 암호화 작업 중 오류가 발생했습니다.' }, 500);
  }
}
