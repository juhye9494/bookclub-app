import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

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
      .select('*')
      .order('created_at', { ascending: false });

    if (participantsError) {
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
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
        .select('id, phone')
        .in('id', userIds);

      if (!profilesError && profilesData) {
        phoneMap = Object.fromEntries(profilesData.map((p: any) => [p.id, p.phone]));
      }
    }

    const enrichedParticipants = (participants || []).map((p: any) => ({
      ...p,
      user_phone: p.user_id ? phoneMap[p.user_id] || '' : ''
    }));

    return NextResponse.json({ data: enrichedParticipants });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
