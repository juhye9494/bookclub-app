import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { checkMemberAccess, getMemberAccessErrorResponse } from '@/lib/server/memberAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { encryptEventParticipantPii } from '@/lib/server/eventParticipantPiiCrypto';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(req);

    const accessInfo = await checkMemberAccess(user.id, user.email || '');
    if (!accessInfo.canAccessMemberFeatures) {
      return getMemberAccessErrorResponse(accessInfo);
    }

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('name').eq('id', user.id).maybeSingle();
    if (profileError) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    const profileName = profile?.name || user.email || 'Member';

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    if (!uuidRegex.test(user.id)) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    if (typeof id !== 'string' || id.trim() === '' || id.length > 200 || /[:\x00-\x1F\x7F]/.test(id)) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!user.email || user.email.length === 0 || user.email.length > 320) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!profileName || profileName.length === 0 || profileName.length > 100) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    let encryptedName;
    let encryptedEmail;
    try {
      encryptedName = encryptEventParticipantPii('user_name', id, user.id, profileName);
      encryptedEmail = encryptEventParticipantPii('user_email', id, user.id, user.email);
    } catch (err) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const keyVersion = encryptedName.keyVersion;
    if (
      !Number.isInteger(keyVersion) || keyVersion <= 0 ||
      encryptedEmail.keyVersion !== keyVersion
    ) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const { data, error: rpcError } = await supabaseAdmin.rpc('apply_event_atomic_v2', {
      p_event_id: id,
      p_user_id: user.id,
      p_user_email: user.email,
      p_user_name: profileName,
      p_user_name_enc: encryptedName.encryptedValue,
      p_user_email_enc: encryptedEmail.encryptedValue,
      p_pii_key_version: keyVersion,
    });

    if (rpcError) {
      console.error('event application failed');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    if (data && data.success === false) {
      const code = data.code;
      let status = 400;
      if (code === 'EVENT_NOT_FOUND') status = 404;
      else if (code === 'ALREADY_APPLIED') status = 409;
      return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('event application failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(req);

    const { error: deleteError, count } = await supabaseAdmin.from('event_participants').delete({ count: 'exact' }).eq('event_id', id).eq('user_id', user.id);
    if (deleteError) {
      console.error('event_participants delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to cancel application' }, { status: 500 });
    }
    if (count === 0) {
      return NextResponse.json({ error: 'MEMBERSHIP_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('DELETE application error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
