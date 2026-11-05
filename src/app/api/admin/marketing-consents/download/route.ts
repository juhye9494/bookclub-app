import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptProfilePii } from '@/lib/server/piiCrypto';
import { buildXlsx } from '@/lib/server/xlsxBuilder';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const match = authHeader.match(/^Bearer ([^\s]+)$/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const filter = url.searchParams.get('filter') || 'all';

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Auth Users
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
        return NextResponse.json({ error: '회원 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      for (const authUser of data.users) {
        authEmailById.set(authUser.id, authUser.email ?? '');
        activeAuthUserIds.add(authUser.id);
      }

      if (data.users.length < perPage) break;
      authPage += 1;
    }

    // 2. profiles
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, name, phone, phone_enc, created_at')
      .order('created_at', { ascending: false });

    if (profileErr) {
      return NextResponse.json({ error: '프로필을 불러오지 못했습니다.' }, { status: 500 });
    }

    // 3. marketing_consents
    const { data: consents } = await supabaseAdmin
      .from('marketing_consents')
      .select('*');

    const consentByUserId = new Map<string, any>();
    for (const c of (consents || [])) {
      consentByUserId.set(c.user_id, c);
    }

    // 4. 통합 목록 생성
    const allMembers = [];

    for (const p of (profiles || [])) {
      if (!activeAuthUserIds.has(p.id)) continue; // 탈퇴 회원 제외

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

      const isEmailEligible = privacyConsent && emailConsent && status === 'agreed';
      const isSmsEligible = privacyConsent && smsConsent && status === 'agreed';

      allMembers.push({
        id: p.id,
        name: p.name || '미등록',
        email,
        phone,
        status,
        privacyConsent,
        emailConsent,
        smsConsent,
        isEmailEligible,
        isSmsEligible,
        consent_version: consent?.consent_version || '-',
        consent_source: consent?.consent_source || '-',
        consented_at: consent?.consented_at || '-',
        updated_at: consent?.updated_at || '-'
      });
    }

    // 5. 검색 및 필터 적용 (관리자 목록 API와 100% 동일)
    let filtered = allMembers;

    if (search) {
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(search) ||
        m.email.toLowerCase().includes(search) ||
        m.phone.replace(/[^0-9]/g, '').includes(search.replace(/[^0-9]/g, ''))
      );
    }

    if (filter === 'email_eligible') {
      filtered = filtered.filter(m => m.isEmailEligible);
    } else if (filter === 'sms_eligible') {
      filtered = filtered.filter(m => m.isSmsEligible);
    } else if (filter === 'unanswered') {
      filtered = filtered.filter(m => m.status === 'unanswered');
    } else if (filter === 'rejected_or_withdrawn') {
      filtered = filtered.filter(m => m.status === 'rejected' || m.status === 'withdrawn');
    }

    // 6. Excel (.xlsx) 데이터 조합
    const headers = [
      '회원ID',
      '이름',
      '이메일',
      '연락처',
      '개인정보_마케팅이용동의',
      '이메일_수신동의',
      '문자_수신동의',
      '상태',
      '이메일발송가능여부',
      '문자발송가능여부',
      '최종처리시각',
      '동의버전',
      '신청경로'
    ];

    const getStatusLabel = (s: string) => {
      switch (s) {
        case 'agreed': return '동의';
        case 'rejected': return '거부';
        case 'withdrawn': return '철회';
        case 'unanswered': default: return '미응답';
      }
    };

    const rows = filtered.map(m => [
      m.id,
      m.name,
      m.email,
      m.phone, // inlineStr 텍스트 형식으로 저장되어 010 앞자리 보존
      m.privacyConsent ? '동의' : '미동의',
      m.emailConsent ? '동의' : '미동의',
      m.smsConsent ? '동의' : '미동의',
      getStatusLabel(m.status),
      m.isEmailEligible ? '발송가능' : '발송불가',
      m.isSmsEligible ? '발송가능' : '발송불가',
      m.consented_at !== '-' ? new Date(m.consented_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-',
      m.consent_version,
      m.consent_source
    ]);

    const xlsxBuffer = buildXlsx({
      headers,
      rows,
      sheetName: '마케팅동의명단'
    });

    const nowStr = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date()).replace(/[^0-9]/g, '');

    const filename = `marketing_consent_${filter}_${nowStr}.xlsx`;

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });

  } catch (error: any) {
    console.error('download api error:', error);
    return NextResponse.json({ error: '다운로드 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
