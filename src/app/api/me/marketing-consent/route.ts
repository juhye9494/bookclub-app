import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { decryptProfilePii } from '@/lib/server/piiCrypto';
import { CURRENT_CONSENT_VERSION } from '@/constants/marketingTerms';
import { jsonNoStore } from '@/lib/server/jsonNoStore';

export const dynamic = 'force-dynamic';

// GET: 회원 본인의 현재 동의 상태 및 기본 프로필 조회
export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const userId = user.id;

    // 1. 프로필 정보 조회 (이름, 암호화된 연락처)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, phone, phone_enc')
      .eq('id', userId)
      .maybeSingle();

    let decryptedPhone = profile?.phone || '';
    if (profile?.phone_enc) {
      try {
        decryptedPhone = await decryptProfilePii(profile.phone_enc, {
          profileId: userId,
          field: 'phone'
        });
      } catch (e) {
        console.error('Failed to decrypt phone for user:', userId, e);
      }
    }

    // 2. 마케팅 동의 상태 조회
    const { data: consent, error: consentErr } = await supabaseAdmin
      .from('marketing_consents')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (consentErr && consentErr.code !== 'PGRST116') {
      console.error('Failed to fetch marketing consent:', consentErr);
    }

    return jsonNoStore({
      success: true,
      profile: {
        id: userId,
        email: user.email,
        name: profile?.name || '',
        phone: decryptedPhone
      },
      consent: consent || {
        user_id: userId,
        status: 'unanswered',
        privacy_marketing_consent: false,
        email_marketing_consent: false,
        sms_marketing_consent: false,
        consent_version: CURRENT_CONSENT_VERSION,
        consent_source: 'none',
        consented_at: null,
        updated_at: null
      }
    });
  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return jsonNoStore({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    console.error('GET /api/me/marketing-consent error:', error);
    return jsonNoStore({ error: '데이터를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST: 회원 본인의 동의 설정 저장, 변경 또는 철회
export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const userId = user.id;

    const body = await req.json();
    const {
      privacy_marketing_consent = false,
      email_marketing_consent = false,
      sms_marketing_consent = false,
      consent_source = 'consent_page',
      action_type: requestedAction
    } = body;

    const validSources = ['signup', 'popup', 'consent_page', 'mypage', 'system'];
    const safeSource = validSources.includes(consent_source) ? consent_source : 'consent_page';

    const isExplicitRejectOrWithdraw = requestedAction === 'reject' || requestedAction === 'withdraw';
    const reqPrivacy = isExplicitRejectOrWithdraw ? false : Boolean(privacy_marketing_consent);
    const reqEmail = isExplicitRejectOrWithdraw ? false : Boolean(email_marketing_consent);
    const reqSms = isExplicitRejectOrWithdraw ? false : Boolean(sms_marketing_consent);

    // 개인정보 마케팅 이용 동의 없이 이메일·문자만 발송 대상으로 저장하지 않음
    if ((reqEmail || reqSms) && !reqPrivacy) {
      return jsonNoStore(
        { error: '이메일 또는 문자(SMS) 수신에 동의하시려면 마케팅 목적의 개인정보 수집·이용에 동의해 주세요.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 기존 상태 조회
    const { data: currentConsent } = await supabaseAdmin
      .from('marketing_consents')
      .select('status, privacy_marketing_consent, email_marketing_consent, sms_marketing_consent, consented_at, next_confirm_due, last_confirmed_at')
      .eq('user_id', userId)
      .maybeSingle();

    const wasAgreed = currentConsent?.status === 'agreed';
    const wasAgreedOrWithdrawn = currentConsent?.status === 'agreed' || currentConsent?.status === 'withdrawn';
    const isAnyAgreed = Boolean(reqPrivacy || reqEmail || reqSms);

    let finalStatus: 'agreed' | 'rejected' | 'withdrawn' | 'unanswered';
    let finalAction: 'agree' | 'update' | 'reject' | 'withdraw';

    if (requestedAction === 'withdraw' || (wasAgreedOrWithdrawn && !isAnyAgreed)) {
      finalStatus = 'withdrawn';
      finalAction = 'withdraw';
    } else if (requestedAction === 'reject' || (!wasAgreedOrWithdrawn && !isAnyAgreed)) {
      finalStatus = 'rejected';
      finalAction = 'reject';
    } else if (wasAgreed) {
      finalStatus = 'agreed';
      finalAction = 'update';
    } else {
      finalStatus = 'agreed';
      finalAction = 'agree';
    }

    const confirmDueDate = new Date();
    confirmDueDate.setFullYear(confirmDueDate.getFullYear() + 2);

    const hadChannel = Boolean(
      wasAgreed &&
      currentConsent?.privacy_marketing_consent &&
      (currentConsent?.email_marketing_consent || currentConsent?.sms_marketing_consent)
    );

    const nextConfirmDue =
      finalStatus === 'agreed' && (reqEmail || reqSms)
        ? (hadChannel && currentConsent?.next_confirm_due ? currentConsent.next_confirm_due : confirmDueDate.toISOString())
        : null;

    const consentData = {
      user_id: userId,
      status: finalStatus,
      privacy_marketing_consent: finalStatus === 'agreed' ? reqPrivacy : false,
      email_marketing_consent: finalStatus === 'agreed' ? reqEmail : false,
      sms_marketing_consent: finalStatus === 'agreed' ? reqSms : false,
      consent_version: CURRENT_CONSENT_VERSION,
      consent_source: safeSource,
      consented_at: finalStatus === 'agreed' ? (wasAgreed && currentConsent?.consented_at ? currentConsent.consented_at : now) : null,
      next_confirm_due: nextConfirmDue,
      updated_at: now
    };

    // 1. marketing_consents upsert
    const { data: savedConsent, error: upsertErr } = await supabaseAdmin
      .from('marketing_consents')
      .upsert(consentData, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();

    if (upsertErr) {
      console.error('Failed to upsert marketing consent:', upsertErr);
      return jsonNoStore({ error: '동의 정보 저장에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 });
    }

    // 2. DB 트리거(marketing_consent_audit)에 의해 이력이 이미 생성되었는지 확인 후, 미생성 시 이력 보완 삽입
    const choicesChanged =
      !currentConsent ||
      currentConsent.status !== consentData.status ||
      Boolean(currentConsent.privacy_marketing_consent) !== consentData.privacy_marketing_consent ||
      Boolean(currentConsent.email_marketing_consent) !== consentData.email_marketing_consent ||
      Boolean(currentConsent.sms_marketing_consent) !== consentData.sms_marketing_consent;

    if (choicesChanged) {
      const { data: latestHist } = await supabaseAdmin
        .from('marketing_consent_history')
        .select('status, privacy_marketing_consent, email_marketing_consent, sms_marketing_consent, action_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const recentTriggerRow =
        latestHist &&
        latestHist.length > 0 &&
        latestHist[0].status === consentData.status &&
        Boolean(latestHist[0].privacy_marketing_consent) === consentData.privacy_marketing_consent &&
        Boolean(latestHist[0].email_marketing_consent) === consentData.email_marketing_consent &&
        Boolean(latestHist[0].sms_marketing_consent) === consentData.sms_marketing_consent &&
        Math.abs(new Date(latestHist[0].created_at).getTime() - new Date(now).getTime()) < 10000;

      if (!recentTriggerRow) {
        const { error: historyErr } = await supabaseAdmin
          .from('marketing_consent_history')
          .insert({
            user_id: userId,
            status: finalStatus,
            privacy_marketing_consent: consentData.privacy_marketing_consent,
            email_marketing_consent: consentData.email_marketing_consent,
            sms_marketing_consent: consentData.sms_marketing_consent,
            action_type: finalAction,
            consent_version: CURRENT_CONSENT_VERSION,
            consent_source: safeSource,
            created_at: now
          });

        if (historyErr) {
          console.error('Failed to insert marketing consent history:', historyErr);
          return jsonNoStore({ error: '동의 변경 이력 저장에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 });
        }
      }
    }

    // 정보통신망법 제50조 제7항 알림 내용 생성 (수신동의/철회 처리결과 통지)
    const resultNotice = {
      senderName: '한경 언더라인',
      legalBasis: '정보통신망 이용촉진 및 정보보호 등에 관한 법률 제50조 제7항',
      processedAt: now,
      status: finalStatus,
      action: finalAction,
      details: {
        privacy: consentData.privacy_marketing_consent ? '동의' : '미동의/철회',
        email: consentData.email_marketing_consent ? '수신동의' : '수신거부/철회',
        sms: consentData.sms_marketing_consent ? '수신동의' : '수신거부/철회'
      }
    };

    return jsonNoStore({
      success: true,
      consent: savedConsent || consentData,
      notice: resultNotice
    });

  } catch (error: any) {
    if (error.message === 'AUTH_UNAUTHORIZED') {
      return jsonNoStore({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    console.error('POST /api/me/marketing-consent error:', error);
    return jsonNoStore({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
