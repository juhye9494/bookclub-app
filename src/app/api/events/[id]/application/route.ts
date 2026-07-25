import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { checkMemberAccess, getMemberAccessErrorResponse } from '@/lib/server/memberAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
      console.error('Failed to fetch profile:', profileError);
      return NextResponse.json({ error: 'Failed to apply for event' }, { status: 500 });
    }
    const user_name = profile?.name || user.email || 'Member';

    const { data, error: rpcError } = await supabaseAdmin.rpc('apply_event_atomic', {
      p_event_id: id, p_user_id: user.id, p_user_email: user.email || '', p_user_name: user_name
    });

    if (rpcError) {
      console.error('apply_event_atomic error:', rpcError);
      return NextResponse.json({ error: 'Failed to apply for event' }, { status: 500 });
    }
    if (data && data.success === false) {
      const code = data.code;
      let status = 400;
      if (code === 'EVENT_NOT_FOUND') status = 404;
      else if (code === 'ALREADY_APPLIED') status = 409;
      return NextResponse.json({ error: code }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('POST application error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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
