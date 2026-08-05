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

    const { data, error: rpcError } = await supabaseAdmin.rpc('join_group_atomic_v2', {
      p_group_id: id, p_user_id: user.id
    });

    if (rpcError) {
      console.error('group operation failed');
      return NextResponse.json({ error: 'Failed to join group' }, { status: 500 });
    }
    if (data && data.success === false) {
      const code = data.code;
      let status = 400;
      if (code === 'GROUP_NOT_FOUND') status = 404;
      else if (code === 'ALREADY_JOINED' || code === 'GROUP_CLOSED') status = 409;
      else if (code === 'CREATOR_CANNOT_JOIN') status = 400;
      return NextResponse.json({ error: code }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('group operation failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(req);

    const { data, error: rpcError } = await supabaseAdmin.rpc('leave_group_atomic', {
      p_group_id: id, p_user_id: user.id
    });

    if (rpcError) {
      console.error('group operation failed');
      return NextResponse.json({ error: 'Failed to cancel membership' }, { status: 500 });
    }
    if (data && data.success === false) {
      const code = data.code;
      let status = 400;
      if (code === 'GROUP_NOT_FOUND' || code === 'MEMBERSHIP_NOT_FOUND') status = 404;
      return NextResponse.json({ error: code }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('group operation failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
