import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptProfilePii } from '@/lib/server/piiCrypto';

export const dynamic = 'force-dynamic';

import { jsonNoStore } from '@/lib/server/jsonNoStore';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }
    const match = authHeader.match(/^Bearer ([^\s]+)$/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    if (!user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const filter = url.searchParams.get('filter') || 'all'; // all, email_eligible, sms_eligible, unanswered, rejected_or_withdrawn
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Auth Users 전체 조회 (이메일 및 삭제여부 매핑)
    const authEmailById = new Map<string, string>();
    const activeAuthUserIds = new Set<string>();
    const perPage = 1000;
    let authPage = 1;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: authPage,
        perPage,
      });

      if (error) {
        console.error('admin auth user lookup failed:', error);
        return NextResponse.json({ error: '회원 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      for (const authUser of data.users) {
        authEmailById.set(authUser.id, authUser.email ?? '');
        activeAuthUserIds.add(authUser.id);
      }

      if (data.users.length < perPage) {
        break;
      }
      authPage += 1;
    }

    // 2. profiles 조회
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, name, phone, phone_enc, created_at')
      .order('created_at', { ascending: false });

    if (profileErr) {
      console.error('admin profile lookup failed:', profileErr);
      return NextResponse.json({ error: '프로필 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    // 3. marketing_consents 전체 조회
    const { data: consents, error: consentErr } = await supabaseAdmin
      .from('marketing_consents')
      .select('*');

    if (consentErr && consentErr.code !== 'PGRST116') {
      console.error('admin consent lookup failed:', consentErr);
    }

    const consentByUserId = new Map<string, any>();
    for (const c of (consents || [])) {
      consentByUserId.set(c.user_id, c);
    }

    // 4. 회원 데이터 통합 및 전화번호 복호화
    const allMembers = [];
    let totalEmailEligible = 0;
    let totalSmsEligible = 0;
    let totalUnanswered = 0;
    let totalRejectedOrWithdrawn = 0;

    for (const p of (profiles || [])) {
      // 탈퇴한 회원 제외 (auth.users에 없는 경우)
      if (!activeAuthUserIds.has(p.id)) {
        continue;
      }

      const email = authEmailById.get(p.id) || '';
      let phone = p.phone || '';
      if (p.phone_enc) {
        try {
          phone = await decryptProfilePii(p.phone_enc, {
            profileId: p.id,
            field: 'phone'
          });
        } catch {
          phone = p.phone || '';
        }
      }

      const consent = consentByUserId.get(p.id);
      const status: 'unanswered' | 'agreed' | 'rejected' | 'withdrawn' = consent?.status || 'unanswered';
      const privacyConsent = Boolean(consent?.privacy_marketing_consent);
      const emailConsent = Boolean(consent?.email_marketing_consent);
      const smsConsent = Boolean(consent?.sms_marketing_consent);

      // 발송 가능 여부: 개인정보 마케팅 이용 동의 AND 해당 채널 동의 AND 상태가 agreed
      const isEmailEligible = privacyConsent && emailConsent && status === 'agreed';
      const isSmsEligible = privacyConsent && smsConsent && status === 'agreed';

      // 통계 집계
      if (isEmailEligible) totalEmailEligible++;
      if (isSmsEligible) totalSmsEligible++;
      if (status === 'unanswered') totalUnanswered++;
      if (status === 'rejected' || status === 'withdrawn') totalRejectedOrWithdrawn++;

      allMembers.push({
        id: p.id,
        name: p.name || '미등록',
        email,
        phone,
        status,
        privacy_marketing_consent: privacyConsent,
        email_marketing_consent: emailConsent,
        sms_marketing_consent: smsConsent,
        is_email_eligible: isEmailEligible,
        is_sms_eligible: isSmsEligible,
        consent_version: consent?.consent_version || '-',
        consent_source: consent?.consent_source || '-',
        consented_at: consent?.consented_at || null,
        updated_at: consent?.updated_at || null,
        created_at: p.created_at
      });
    }

    // 5. 검색 및 필터 적용
    let filtered = allMembers;

    if (search) {
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(search) ||
        m.email.toLowerCase().includes(search) ||
        m.phone.replace(/[^0-9]/g, '').includes(search.replace(/[^0-9]/g, ''))
      );
    }

    if (filter === 'email_eligible') {
      filtered = filtered.filter(m => m.is_email_eligible);
    } else if (filter === 'sms_eligible') {
      filtered = filtered.filter(m => m.is_sms_eligible);
    } else if (filter === 'unanswered') {
      filtered = filtered.filter(m => m.status === 'unanswered');
    } else if (filter === 'rejected_or_withdrawn') {
      filtered = filtered.filter(m => m.status === 'rejected' || m.status === 'withdrawn');
    }

    // 6. 페이징
    const totalCount = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginatedMembers = filtered.slice(startIndex, startIndex + limit);

    return jsonNoStore({
      success: true,
      summary: {
        total_members: allMembers.length,
        email_eligible_count: totalEmailEligible,
        sms_eligible_count: totalSmsEligible,
        unanswered_count: totalUnanswered,
        rejected_or_withdrawn_count: totalRejectedOrWithdrawn,
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      members: paginatedMembers
    });

  } catch (error: any) {
    console.error('admin marketing consents error:', error);
    return jsonNoStore({ error: '오류가 발생했습니다.' }, { status: 500 });
  }
}
