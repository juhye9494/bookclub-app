import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { checkMemberAccess, getMemberAccessErrorResponse } from '@/lib/server/memberAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const accessInfo = await checkMemberAccess(user.id, user.email || '');
    if (!accessInfo.canAccessMemberFeatures) {
      return getMemberAccessErrorResponse(accessInfo);
    }

    const body = await req.json();
    const { p_title, p_desc, p_book, p_max_members, p_tags, p_perks, p_place, p_time, p_intro } = body;

    // 입력값 전체 엄격 검증
    if (!p_title || typeof p_title !== 'string' || p_title.trim().length === 0 || p_title.length > 100) {
      return NextResponse.json({ error: 'Title is required and must be under 100 characters' }, { status: 400 });
    }
    if (typeof p_desc !== 'string' && p_desc !== undefined && p_desc !== null || (p_desc && p_desc.length > 500)) {
      return NextResponse.json({ error: 'Description must be a string under 500 characters' }, { status: 400 });
    }
    if (typeof p_book !== 'string' && p_book !== undefined && p_book !== null || (p_book && p_book.length > 200)) {
      return NextResponse.json({ error: 'Book must be a string under 200 characters' }, { status: 400 });
    }
    
    const maxMembers = Number(p_max_members);
    if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 100) {
      return NextResponse.json({ error: 'Invalid max_members, must be an integer between 2 and 100' }, { status: 400 });
    }
    
    if (p_tags) {
      if (!Array.isArray(p_tags) || p_tags.length > 10 || p_tags.some(t => typeof t !== 'string' || t.length > 30)) {
        return NextResponse.json({ error: 'Tags must be an array of strings (max 10 items, max 30 chars each)' }, { status: 400 });
      }
    }
    if (p_perks) {
      if (!Array.isArray(p_perks) || p_perks.length > 10 || p_perks.some(t => typeof t !== 'string' || t.length > 50)) {
        return NextResponse.json({ error: 'Perks must be an array of strings (max 10 items, max 50 chars each)' }, { status: 400 });
      }
    }
    
    if (p_place && (typeof p_place !== 'string' || p_place.length > 100)) {
      return NextResponse.json({ error: 'Place must be a string under 100 characters' }, { status: 400 });
    }
    if (p_time && (typeof p_time !== 'string' || p_time.length > 100)) {
      return NextResponse.json({ error: 'Time must be a string under 100 characters' }, { status: 400 });
    }
    if (p_intro && (typeof p_intro !== 'string' || p_intro.length > 2000)) {
      return NextResponse.json({ error: 'Intro must be a string under 2000 characters' }, { status: 400 });
    }

    // Server-side profile name fetch (조회 에러와 Null 필드 분리)
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('name').eq('id', user.id).maybeSingle();
    
    if (profileError) {
      console.error('Failed to fetch profile:', profileError);
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }
    
    const leaderName = profile?.name || user.email || 'Leader';
    const groupId = `group-${crypto.randomUUID()}`;

    const { data, error: rpcError } = await supabaseAdmin.rpc('create_group_secure', {
      p_id: groupId, p_title: p_title.trim(), p_desc: p_desc || '', p_book: p_book || '',
      p_creator_id: user.id, p_creator_email: user.email || '', p_creator_name: leaderName,
      p_max_members: maxMembers, p_tags: Array.isArray(p_tags) ? p_tags : [],
      p_perks: Array.isArray(p_perks) ? p_perks : ['커피값 지원 신청가능'],
      p_place: p_place || null, p_time: p_time || null, p_intro: p_intro || null
    });

    if (rpcError) {
      console.error('create_group_secure error:', rpcError);
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }

    if (!data || data.success !== true) {
      console.error('create_group_secure returned failure:', data);
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }

    // 그룹 생성 후 저장할 groupId를 반환 (프론트에서 open-chat 저장에 사용)
    return NextResponse.json({ success: true, groupId });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('POST /api/groups error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
