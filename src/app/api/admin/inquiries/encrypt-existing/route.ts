import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptInquiryPii, encryptInquiryPii } from '@/lib/server/inquiryPiiCrypto';

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
    if (userError || !user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const body = await req.json();
    const mode = body.mode;

    if (mode !== 'dry-run' && mode !== 'execute') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    if (mode === 'execute' && body.confirm !== 'ENCRYPT_INQUIRY_PII') {
      return NextResponse.json({ error: 'Missing confirmation' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let total = 0;
    let protectedCount = 0;
    let needsMigrationCount = 0;
    let invalidCount = 0;
    let migratedCount = 0;
    let conflictsCount = 0;

    let lastId = '00000000-0000-0000-0000-000000000000';
    let hasMore = true;

    const migrationTargets: any[] = [];

    while (hasMore) {
      const { data: rows, error: fetchError } = await supabaseAdmin
        .from('inquiries')
        .select('id, user_name, user_email, user_phone, user_name_enc, user_email_enc, user_phone_enc, pii_key_version')
        .order('id', { ascending: true })
        .gt('id', lastId)
        .limit(500);

      if (fetchError) {
        console.error('[MIGRATION_FETCH_ERROR]');
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        total++;

        const hasName = typeof row.user_name === 'string' && row.user_name.trim() !== '';
        const hasEmail = typeof row.user_email === 'string' && row.user_email.trim() !== '';
        const hasPhone = typeof row.user_phone === 'string' && row.user_phone.trim() !== '';
        const nameValid = hasName && row.user_name.length <= 100;
        const emailValid = hasEmail && row.user_email.length <= 320;
        const phoneValid = hasPhone && row.user_phone.length <= 50;
        const plaintextsValid = nameValid && emailValid && phoneValid;

        const hasAnyEnc = row.user_name_enc || row.user_email_enc || row.user_phone_enc;
        const hasAllEnc = row.user_name_enc && row.user_email_enc && row.user_phone_enc;
        const hasVersion = row.pii_key_version !== null && row.pii_key_version !== undefined;
        const versionValid = Number.isInteger(row.pii_key_version) && row.pii_key_version > 0;

        if (hasAllEnc && versionValid) {
          try {
            const decName = decryptInquiryPii('user_name', row.id, row.user_name_enc, row.pii_key_version);
            const decEmail = decryptInquiryPii('user_email', row.id, row.user_email_enc, row.pii_key_version);
            const decPhone = decryptInquiryPii('user_phone', row.id, row.user_phone_enc, row.pii_key_version);

            if (decName === row.user_name && decEmail === row.user_email && decPhone === row.user_phone) {
              protectedCount++;
            } else {
              invalidCount++;
            }
          } catch {
            invalidCount++;
          }
        } else if (!hasAnyEnc && !hasVersion) {
          if (plaintextsValid) {
            needsMigrationCount++;
            if (mode === 'execute') {
              migrationTargets.push(row);
            }
          } else {
            invalidCount++;
          }
        } else {
          invalidCount++;
        }
      }

      lastId = rows[rows.length - 1].id;
    }

    if (mode === 'dry-run') {
      return NextResponse.json({
        mode: 'dry-run',
        total,
        protected: protectedCount,
        needsMigration: needsMigrationCount,
        invalid: invalidCount,
        canExecute: invalidCount === 0
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (invalidCount > 0) {
      return NextResponse.json({ error: 'Cannot execute with invalid rows' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    for (const target of migrationTargets) {
      let encryptedName, encryptedEmail, encryptedPhone;
      try {
        encryptedName = encryptInquiryPii('user_name', target.id, target.user_name);
        encryptedEmail = encryptInquiryPii('user_email', target.id, target.user_email);
        encryptedPhone = encryptInquiryPii('user_phone', target.id, target.user_phone);
      } catch {
        console.error('[MIGRATION_ENCRYPT_ERROR]');
        return NextResponse.json({ error: 'Encryption failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      const keyVersion = encryptedName.keyVersion;
      if (
        !Number.isInteger(keyVersion) || keyVersion <= 0 ||
        encryptedEmail.keyVersion !== keyVersion ||
        encryptedPhone.keyVersion !== keyVersion
      ) {
        console.error('[MIGRATION_KEY_MISMATCH]');
        return NextResponse.json({ error: 'Key version mismatch' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('inquiries')
        .update({
          user_name_enc: encryptedName.encryptedValue,
          user_email_enc: encryptedEmail.encryptedValue,
          user_phone_enc: encryptedPhone.encryptedValue,
          pii_key_version: keyVersion
        })
        .eq('id', target.id)
        .eq('user_name', target.user_name)
        .eq('user_email', target.user_email)
        .eq('user_phone', target.user_phone)
        .is('user_name_enc', null)
        .is('user_email_enc', null)
        .is('user_phone_enc', null)
        .is('pii_key_version', null)
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error('[MIGRATION_UPDATE_ERROR]');
        conflictsCount++;
      } else if (!updateData) {
        conflictsCount++;
      } else {
        migratedCount++;
      }
    }

    return NextResponse.json({
      mode: 'execute',
      total,
      alreadyProtected: protectedCount,
      migrated: migratedCount,
      conflicts: conflictsCount,
      invalid: invalidCount
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    console.error('[MIGRATION_INTERNAL_ERROR]');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
