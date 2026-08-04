import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { encryptBookOrderPii, decryptBookOrderPii } from '@/lib/server/bookOrderPiiCrypto';

type InvalidReason =
  | 'blankEncryptedValue'
  | 'partialEncryptedState'
  | 'versionWithoutCiphertext'
  | 'invalidKeyVersion'
  | 'decryptFailed'
  | 'plaintextMismatch'
  | 'plaintextMissingOrBlank'
  | 'plaintextLengthInvalid';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return jsonNoStore({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) {
      return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonNoStore({ error: 'Invalid JSON' }, { status: 400 });
    }

    const mode = body?.mode;
    if (mode !== 'dry-run' && mode !== 'execute') {
      return jsonNoStore({ error: 'Invalid mode' }, { status: 400 });
    }
    if (mode === 'execute' && body?.confirm !== 'ENCRYPT_BOOK_ORDER_SHIPPING_PII') {
      return jsonNoStore({ error: 'Invalid confirm string' }, { status: 400 });
    }

    let offset = 0;
    const PAGE_SIZE = 500;
    let allRows: any[] = [];
    let fetchMore = true;
    let iterations = 0;

    while (fetchMore && iterations < 1000) {
      iterations++;
      const { data, error } = await supabaseAdmin
        .from('book_orders')
        .select(`
          id,
          shipping_name,
          shipping_phone,
          shipping_address,
          shipping_name_enc,
          shipping_phone_enc,
          shipping_address_enc,
          pii_key_version,
          updated_at
        `)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('book order shipping PII migration failed');
        return jsonNoStore({ error: 'Failed to fetch rows' }, { status: 500 });
      }

      const rows = data || [];
      allRows = allRows.concat(rows);

      if (rows.length < PAGE_SIZE) {
        fetchMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    if (fetchMore) {
      throw new Error('Migration scan limit exceeded');
    }

    let protectedCount = 0;
    let needsMigrationCount = 0;
    let invalidCount = 0;

    const invalidReasons: Record<InvalidReason, number> = {
      blankEncryptedValue: 0,
      partialEncryptedState: 0,
      versionWithoutCiphertext: 0,
      invalidKeyVersion: 0,
      decryptFailed: 0,
      plaintextMismatch: 0,
      plaintextMissingOrBlank: 0,
      plaintextLengthInvalid: 0,
    };

    const needsMigrationRows: any[] = [];

    for (const row of allRows) {
      const {
        shipping_name_enc,
        shipping_phone_enc,
        shipping_address_enc,
        pii_key_version,
        shipping_name,
        shipping_phone,
        shipping_address,
      } = row;

      // A. 암호화 컬럼에 공백 문자열 존재
      const isBlankEnc = (val: any) => typeof val === 'string' && val.trim() === '';
      if (
        (shipping_name_enc !== null && isBlankEnc(shipping_name_enc)) ||
        (shipping_phone_enc !== null && isBlankEnc(shipping_phone_enc)) ||
        (shipping_address_enc !== null && isBlankEnc(shipping_address_enc))
      ) {
        invalidCount++;
        invalidReasons.blankEncryptedValue++;
        continue;
      }

      // B. 암호문 일부만 존재
      const hasNameEnc = typeof shipping_name_enc === 'string' && shipping_name_enc.trim() !== '';
      const hasPhoneEnc = typeof shipping_phone_enc === 'string' && shipping_phone_enc.trim() !== '';
      const hasAddressEnc = typeof shipping_address_enc === 'string' && shipping_address_enc.trim() !== '';
      const encCount = (hasNameEnc ? 1 : 0) + (hasPhoneEnc ? 1 : 0) + (hasAddressEnc ? 1 : 0);

      if (encCount === 1 || encCount === 2) {
        invalidCount++;
        invalidReasons.partialEncryptedState++;
        continue;
      }

      const hasAllEnc = encCount === 3;
      const hasNoEnc = encCount === 0;

      // C. 키 버전만 존재
      if (hasNoEnc && pii_key_version !== null && pii_key_version !== undefined) {
        invalidCount++;
        invalidReasons.versionWithoutCiphertext++;
        continue;
      }

      // D. 암호문 3개가 있지만 버전이 무효
      if (hasAllEnc) {
        if (!Number.isInteger(pii_key_version) || pii_key_version <= 0) {
          invalidCount++;
          invalidReasons.invalidKeyVersion++;
          continue;
        }

        // E. 복호화 실패
        let decName = '';
        let decPhone = '';
        let decAddress = '';
        let decryptSuccess = true;

        try {
          decName = decryptBookOrderPii('shipping_name', row.id, shipping_name_enc, pii_key_version);
          decPhone = decryptBookOrderPii('shipping_phone', row.id, shipping_phone_enc, pii_key_version);
          decAddress = decryptBookOrderPii('shipping_address', row.id, shipping_address_enc, pii_key_version);

          if (decName.trim().length === 0 || decPhone.trim().length === 0 || decAddress.trim().length === 0) {
            decryptSuccess = false;
          }
        } catch {
          decryptSuccess = false;
        }

        if (!decryptSuccess) {
          invalidCount++;
          invalidReasons.decryptFailed++;
          continue;
        }

        // F. 암호문과 남아 있는 평문 불일치
        let mismatch = false;
        if (typeof shipping_name === 'string' && shipping_name !== decName) mismatch = true;
        if (typeof shipping_phone === 'string' && shipping_phone !== decPhone) mismatch = true;
        if (typeof shipping_address === 'string' && shipping_address !== decAddress) mismatch = true;

        if (mismatch) {
          invalidCount++;
          invalidReasons.plaintextMismatch++;
          continue;
        }

        protectedCount++;
        continue;
      }

      // G. 암호화되지 않은 행의 평문 누락
      const isMissingOrBlank = (val: any) => typeof val !== 'string' || val.trim() === '';
      if (isMissingOrBlank(shipping_name) || isMissingOrBlank(shipping_phone) || isMissingOrBlank(shipping_address)) {
        invalidCount++;
        invalidReasons.plaintextMissingOrBlank++;
        continue;
      }

      // H. 평문 길이 초과
      if (
        shipping_name.length > 100 ||
        shipping_phone.length > 50 ||
        shipping_address.length > 500
      ) {
        invalidCount++;
        invalidReasons.plaintextLengthInvalid++;
        continue;
      }

      needsMigrationCount++;
      needsMigrationRows.push(row);
    }

    const invalidReasonTotal = Object.values(invalidReasons).reduce(
      (sum, count) => sum + count,
      0
    );

    if (invalidReasonTotal !== invalidCount) {
      throw new Error('Invalid migration classification totals');
    }

    if (mode === 'dry-run') {
      return jsonNoStore({
        mode: 'dry-run',
        total: allRows.length,
        protected: protectedCount,
        needsMigration: needsMigrationCount,
        invalid: invalidCount,
        invalidReasons,
        canExecute: invalidCount === 0
      });
    }

    if (invalidCount > 0) {
      return jsonNoStore({
        error: '암호화할 수 없는 도서 주문 데이터가 있습니다.',
        total: allRows.length,
        protected: protectedCount,
        needsMigration: needsMigrationCount,
        invalid: invalidCount,
        invalidReasons
      }, { status: 409 });
    }

    let migrated = 0;
    let conflicts = 0;

    for (const row of needsMigrationRows) {
      try {
        const encryptedName = encryptBookOrderPii('shipping_name', row.id, row.shipping_name);
        const encryptedPhone = encryptBookOrderPii('shipping_phone', row.id, row.shipping_phone);
        const encryptedAddress = encryptBookOrderPii('shipping_address', row.id, row.shipping_address);

        if (
          !Number.isInteger(encryptedName.keyVersion) ||
          encryptedName.keyVersion <= 0 ||
          encryptedName.keyVersion !== encryptedPhone.keyVersion ||
          encryptedName.keyVersion !== encryptedAddress.keyVersion
        ) {
          throw new Error('version mismatch');
        }

        let query = supabaseAdmin
          .from('book_orders')
          .update({
            shipping_name_enc: encryptedName.encryptedValue,
            shipping_phone_enc: encryptedPhone.encryptedValue,
            shipping_address_enc: encryptedAddress.encryptedValue,
            pii_key_version: encryptedName.keyVersion
          })
          .eq('id', row.id)
          .is('shipping_name_enc', null)
          .is('shipping_phone_enc', null)
          .is('shipping_address_enc', null)
          .is('pii_key_version', null);

        if (row.updated_at === null) {
          query = query.is('updated_at', null);
        } else {
          query = query.eq('updated_at', row.updated_at);
        }

        const { data: updateData, error: updateErr } = await query.select('id').maybeSingle();

        if (updateErr) {
          console.error('book order shipping PII migration failed');
          conflicts++;
        } else if (!updateData) {
          conflicts++;
        } else {
          migrated++;
        }

      } catch (err) {
        console.error('book order shipping PII migration failed');
        return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
      }
    }

    const responseStatus = conflicts > 0 ? 409 : 200;
    return jsonNoStore({
      mode: 'execute',
      total: allRows.length,
      alreadyProtected: protectedCount,
      migrated,
      conflicts,
      invalid: invalidCount
    }, { status: responseStatus });

  } catch (err: any) {
    console.error('book order shipping PII migration failed');
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
