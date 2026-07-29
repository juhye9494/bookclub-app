import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let query = supabaseAdmin.from('complimentary_member_access').select('*');
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: '데이터 조회에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ accessList: data });
  } catch (err) {
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, cycleId, grantReason } = body;

    if (!userId || !cycleId) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // UUID 검증 (간단한 정규식)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json({ error: '유효하지 않은 회원 ID(UUID)입니다.' }, { status: 400 });
    }

    if (typeof cycleId !== 'string' || cycleId.trim() === '') {
      return NextResponse.json({ error: '유효하지 않은 기수 ID입니다.' }, { status: 400 });
    }

    let validGrantReason = null;
    if (grantReason !== undefined && grantReason !== null) {
      if (typeof grantReason !== 'string') {
        return NextResponse.json({ error: '사유는 문자열이어야 합니다.' }, { status: 400 });
      }
      validGrantReason = grantReason.trim();
      if (validGrantReason.length > 255) {
        return NextResponse.json({ error: '사유는 최대 255자까지만 입력 가능합니다.' }, { status: 400 });
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    // 이미 유료 결제 내역(DONE)이 있는지 체크
    const { data: doneOrders, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .eq('payment_status', 'DONE')
      .limit(1);

    if (orderErr) {
      return NextResponse.json({ error: '결제 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
    if (doneOrders && doneOrders.length > 0) {
      return NextResponse.json({ error: '해당 기수에 이미 유료 결제(DONE) 내역이 있습니다.' }, { status: 403 });
    }

    // 이미 활성 상태인지 체크
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('complimentary_member_access')
      .select('id')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .is('revoked_at', null)
      .maybeSingle();

    if (existErr) {
      return NextResponse.json({ error: '기존 자격 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: '이미 활성 상태인 무료 회원 권한이 존재합니다.' }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('complimentary_member_access')
      .insert({
        user_id: userId,
        cycle_id: cycleId,
        grant_reason: validGrantReason,
        granted_by: user.id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // unique_violation
        return NextResponse.json({ error: '이미 활성 상태인 무료 회원 권한이 존재합니다.' }, { status: 409 });
      }
      return NextResponse.json({ error: '권한 부여 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, access: data });
  } catch (err) {
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { id, revokeReason } = body;

    if (!id) return NextResponse.json({ error: '권한 ID가 필요합니다.' }, { status: 400 });

    let validRevokeReason = null;
    if (revokeReason !== undefined && revokeReason !== null) {
      if (typeof revokeReason !== 'string') {
        return NextResponse.json({ error: '사유는 문자열이어야 합니다.' }, { status: 400 });
      }
      validRevokeReason = revokeReason.trim();
      if (validRevokeReason.length > 255) {
        return NextResponse.json({ error: '사유는 최대 255자까지만 입력 가능합니다.' }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('complimentary_member_access')
      .update({ 
        revoked_at: new Date().toISOString(), 
        revoked_by: user.id,
        revoke_reason: validRevokeReason
      })
      .eq('id', id)
      .is('revoked_at', null)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: '권한 회수 중 DB 오류가 발생했습니다.' }, { status: 500 });
    if (!data) return NextResponse.json({ error: '해당 권한을 찾을 수 없거나 이미 회수되었습니다.' }, { status: 400 });

    return NextResponse.json({ success: true, access: data });
  } catch (err) {
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}
