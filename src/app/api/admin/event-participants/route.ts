import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptProfilePii } from '@/lib/server/piiCrypto';

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
      .select('event_id, event_title, user_id, user_name, user_email, created_at')
      .order('created_at', { ascending: false });

    if (participantsError) {
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
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
        return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }

      if (profilesData) {
        for (const p of profilesData) {
          let finalPhone = '';

          if (p.phone_enc) {
            if (p.pii_key_version !== 1) {
              return NextResponse.json({ error: 'Failed to decrypt profile' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
            }
            try {
              finalPhone = await decryptProfilePii(p.phone_enc, {
                profileId: p.id,
                field: 'phone'
              });
            } catch {
              return NextResponse.json({ error: 'Failed to decrypt profile' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
            }
          }
          phoneMap[p.id] = finalPhone;
        }
      }
    }

    const enrichedParticipants = (participants || []).map((p: any) => ({
      event_id: p.event_id,
      event_title: p.event_title,
      user_name: p.user_name,
      user_email: p.user_email,
      user_phone: p.user_id ? phoneMap[p.user_id] || '' : '',
      created_at: p.created_at
    }));

    return NextResponse.json(
      { data: enrichedParticipants },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
