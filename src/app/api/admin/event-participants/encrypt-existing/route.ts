import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { encryptEventParticipantPii, decryptEventParticipantPii } from '@/lib/server/eventParticipantPiiCrypto';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user || !user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const body = await req.json().catch(() => ({}));
    const { mode, confirm } = body;

    if (mode !== 'dry-run' && mode !== 'execute') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    if (mode === 'execute' && confirm !== 'ENCRYPT_EVENT_PARTICIPANT_PII') {
      return NextResponse.json({ error: 'Invalid confirm string' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    let allParticipants: any[] = [];
    const pageSize = 500;
    let page = 0;
    let fetchMore = true;

    while (fetchMore) {
      const { data, error } = await supabaseAdmin
        .from('event_participants')
        .select('event_id, user_id, user_name, user_email, user_name_enc, user_email_enc, pii_key_version')
        .order('event_id', { ascending: true })
        .order('user_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('event participant migration failed');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      if (data && data.length > 0) {
        allParticipants = allParticipants.concat(data);
        page++;
        if (data.length < pageSize) {
          fetchMore = false;
        }
      } else {
        fetchMore = false;
      }
    }

    let protectedCount = 0;
    let needsMigrationCount = 0;
    let invalidCount = 0;

    const migrationTargets: any[] = [];
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

    for (const p of allParticipants) {
      const hasEncName = typeof p.user_name_enc === 'string' && p.user_name_enc.length > 0;
      const hasEncEmail = typeof p.user_email_enc === 'string' && p.user_email_enc.length > 0;
      const isValidVersion = typeof p.pii_key_version === 'number' && p.pii_key_version > 0;

      if (hasEncName && hasEncEmail && isValidVersion) {
        try {
          decryptEventParticipantPii('user_name', p.event_id, p.user_id, p.user_name_enc, p.pii_key_version);
          decryptEventParticipantPii('user_email', p.event_id, p.user_id, p.user_email_enc, p.pii_key_version);
          protectedCount++;
        } catch {
          invalidCount++;
        }
      } else if (!p.user_name_enc && !p.user_email_enc && (p.pii_key_version === null || p.pii_key_version === undefined)) {
        const isNameValid = typeof p.user_name === 'string' && p.user_name.trim().length > 0 && p.user_name.length <= 100;
        const isEmailValid = typeof p.user_email === 'string' && p.user_email.trim().length > 0 && p.user_email.length <= 320;
        const isEventIdValid = typeof p.event_id === 'string' && p.event_id.trim().length > 0 && p.event_id.length <= 200 && !/[:\x00-\x1F\x7F]/.test(p.event_id);
        const isUserIdValid = typeof p.user_id === 'string' && uuidRegex.test(p.user_id);

        if (isNameValid && isEmailValid && isEventIdValid && isUserIdValid) {
          needsMigrationCount++;
          migrationTargets.push(p);
        } else {
          invalidCount++;
        }
      } else {
        invalidCount++;
      }
    }

    if (mode === 'dry-run') {
      return NextResponse.json({
        mode: 'dry-run',
        total: allParticipants.length,
        protected: protectedCount,
        needsMigration: needsMigrationCount,
        invalid: invalidCount,
        canExecute: invalidCount === 0
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (invalidCount > 0) {
      return NextResponse.json({ error: 'Cannot execute with invalid rows' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    let migrated = 0;
    let conflicts = 0;

    for (const target of migrationTargets) {
      let encryptedName;
      let encryptedEmail;

      try {
        encryptedName = encryptEventParticipantPii('user_name', target.event_id, target.user_id, target.user_name);
        encryptedEmail = encryptEventParticipantPii('user_email', target.event_id, target.user_id, target.user_email);
      } catch {
        console.error('event participant migration failed');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      if (encryptedName.keyVersion !== encryptedEmail.keyVersion || !Number.isInteger(encryptedName.keyVersion)) {
        console.error('event participant migration failed');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      const { error: updateError, count } = await supabaseAdmin
        .from('event_participants')
        .update({
          user_name_enc: encryptedName.encryptedValue,
          user_email_enc: encryptedEmail.encryptedValue,
          pii_key_version: encryptedName.keyVersion
        }, { count: 'exact' })
        .eq('event_id', target.event_id)
        .eq('user_id', target.user_id)
        .is('user_name_enc', null)
        .is('user_email_enc', null)
        .is('pii_key_version', null);

      if (updateError) {
        console.error('event participant migration failed');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      if (count !== 1) {
        conflicts++;
      } else {
        migrated++;
      }
    }

    return NextResponse.json({
      mode: 'execute',
      total: allParticipants.length,
      alreadyProtected: protectedCount,
      migrated,
      conflicts,
      invalid: invalidCount
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    console.error('event participant migration failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
