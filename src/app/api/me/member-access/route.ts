import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { checkMemberAccess } from '@/lib/server/memberAccess';

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const accessInfo = await checkMemberAccess(user.id, user.email || '');
    
    return NextResponse.json(accessInfo, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0'
      }
    });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('member-access error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
