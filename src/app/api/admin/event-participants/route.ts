import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptProfilePii } from '@/lib/server/piiCrypto';
import { decryptEventParticipantPii } from '@/lib/server/eventParticipantPiiCrypto';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user || !user.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('event_participants')
      .select('event_id, user_id, event_title, user_name, user_email, user_name_enc, user_email_enc, pii_key_version, created_at')
      .order('created_at', { ascending: false });

    if (participantsError) {
      return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const userIds = Array.from(
      new Set(
        (participants || [])
          .map((p: any) => p.user_id)
          .filter(Boolean)
      )
    );

    let phoneMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, phone_enc, pii_key_version')
        .in('id', userIds);

      if (profilesError) {
        return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      if (profilesData) {
        for (const p of profilesData) {
          let finalPhone = '';

          if (p.phone_enc) {
            if (p.pii_key_version !== 1) {
              return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
            }
            try {
              finalPhone = await decryptProfilePii(p.phone_enc, {
                profileId: p.id,
                field: 'phone'
              });
            } catch {
              return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
            }
          }
          phoneMap[p.id] = finalPhone;
        }
      }
    }

    let enrichedParticipants: any[] = [];
    for (const p of participants || []) {
      let resolvedUserName = '';
      let resolvedUserEmail = '';

      const hasEncName = typeof p.user_name_enc === 'string' && p.user_name_enc.length > 0;
      const hasEncEmail = typeof p.user_email_enc === 'string' && p.user_email_enc.length > 0;
      const isValidVersion = typeof p.pii_key_version === 'number' && p.pii_key_version > 0;

      if (hasEncName && hasEncEmail && isValidVersion) {
        try {
          resolvedUserName = decryptEventParticipantPii(
            'user_name',
            p.event_id,
            p.user_id,
            p.user_name_enc,
            p.pii_key_version
          );
          resolvedUserEmail = decryptEventParticipantPii(
            'user_email',
            p.event_id,
            p.user_id,
            p.user_email_enc,
            p.pii_key_version
          );
        } catch {
          return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
        }
      } else if (!p.user_name_enc && !p.user_email_enc && (p.pii_key_version === null || p.pii_key_version === undefined)) {
        if (typeof p.user_name === 'string' && p.user_name.length > 0 && typeof p.user_email === 'string' && p.user_email.length > 0) {
          resolvedUserName = p.user_name;
          resolvedUserEmail = p.user_email;
        } else {
          return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
        }
      } else {
        return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      enrichedParticipants.push({
        event_id: p.event_id,
        event_title: p.event_title,
        user_name: resolvedUserName,
        user_email: resolvedUserEmail,
        user_phone: p.user_id ? phoneMap[p.user_id] || '' : '',
        created_at: p.created_at
      });
    }

    return NextResponse.json(
      { data: enrichedParticipants },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: '이벤트 신청자 정보를 불러오지 못했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
