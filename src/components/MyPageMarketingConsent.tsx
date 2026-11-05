"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MARKETING_TERMS, CURRENT_CONSENT_VERSION } from '@/constants/marketingTerms';

interface NoticeData {
  senderName: string;
  processedAt: string;
  status: string;
  action: string;
  details: {
    privacy: string;
    email: string;
    sms: string;
  };
}

export default function MyPageMarketingConsent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverConsent, setServerConsent] = useState<any>(null);

  // 로컬 폼 상태
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  // 약관 전문 보기 토글
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);

  // 처리 결과 알림
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchConsent = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/me/marketing-consent', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setServerConsent(data.consent);
        if (data.consent) {
          setPrivacyConsent(Boolean(data.consent.privacy_marketing_consent));
          setEmailConsent(Boolean(data.consent.email_marketing_consent));
          setSmsConsent(Boolean(data.consent.sms_marketing_consent));
        }
      } else {
        setErrorMsg('마케팅 동의 정보를 불러오지 못했습니다.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsent();
  }, []);

  const handleToggleAll = (checked: boolean) => {
    setPrivacyConsent(checked);
    setEmailConsent(checked);
    setSmsConsent(checked);
  };

  const isAllChecked = privacyConsent && emailConsent && smsConsent;

  // 저장 요청
  const handleSave = async () => {
    setErrorMsg(null);
    if ((emailConsent || smsConsent) && !privacyConsent) {
      setErrorMsg('이메일 또는 문자(SMS) 수신에 동의하시려면 [선택] 마케팅 목적의 개인정보 수집·이용에 동의해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const isAny = privacyConsent || emailConsent || smsConsent;
      const res = await fetch('/api/me/marketing-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          privacy_marketing_consent: privacyConsent,
          email_marketing_consent: emailConsent,
          sms_marketing_consent: smsConsent,
          consent_source: 'mypage',
          action_type: isAny ? 'update' : 'withdraw'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '저장에 실패했습니다.');
        return;
      }

      setServerConsent(data.consent);
      setNotice(data.notice);
    } catch (e) {
      setErrorMsg('저장 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 전체 철회 요청
  const handleWithdrawAll = async () => {
    if (!confirm('모든 마케팅 정보 수신 동의를 철회하시겠습니까?\n철회 시 기수 모집, 할인 이벤트 및 무료 북토크 알림을 받으실 수 없습니다.')) {
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/me/marketing-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          privacy_marketing_consent: false,
          email_marketing_consent: false,
          sms_marketing_consent: false,
          consent_source: 'mypage',
          action_type: 'withdraw'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '철회 처리에 실패했습니다.');
        return;
      }

      setPrivacyConsent(false);
      setEmailConsent(false);
      setSmsConsent(false);
      setServerConsent(data.consent);
      setNotice(data.notice);
    } catch (e) {
      setErrorMsg('철회 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        마케팅 수신 설정을 불러오는 중...
      </div>
    );
  }

  const getStatusBadge = () => {
    if (!serverConsent || serverConsent.status === 'unanswered') {
      return <span style={{ padding: '4px 10px', background: '#f3f4f6', color: '#6b7280', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600 }}>미응답</span>;
    }
    if (serverConsent.status === 'agreed') {
      return <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600 }}>수신 동의 중</span>;
    }
    if (serverConsent.status === 'withdrawn') {
      return <span style={{ padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600 }}>수신 철회</span>;
    }
    return <span style={{ padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600 }}>수신 거부</span>;
  };

  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', border: '1px solid var(--border)' }}>
      
      {/* 헤더 & 상태 요약 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
            마케팅 정보 수신 설정
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
            한경 언더라인의 도서 혜택, 이벤트, 신규 기수 소식 수신 여부를 직접 설정하실 수 있습니다.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>현재 상태:</span>
          {getStatusBadge()}
        </div>
      </div>

      {serverConsent?.consented_at && (
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px' }}>
          최종 설정 일시: {new Date(serverConsent.consented_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          {serverConsent.consent_source && ` (${serverConsent.consent_source === 'signup' ? '회원가입' : serverConsent.consent_source === 'mypage' ? '마이페이지' : '동의페이지'})`}
        </div>
      )}

      {/* 전체 선택 */}
      <div style={{
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
        border: '1px solid #e2e8f0',
        cursor: 'pointer'
      }}
      onClick={() => handleToggleAll(!isAllChecked)}
      >
        <input
          type="checkbox"
          id="mypage-all-consent"
          checked={isAllChecked}
          onChange={(e) => handleToggleAll(e.target.checked)}
          style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
          onClick={(e) => e.stopPropagation()}
        />
        <label htmlFor="mypage-all-consent" style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
          전체 마케팅 정보 수신 동의 (선택)
        </label>
      </div>

      {/* 개별 설정 항목 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
        
        {/* 1. 개인정보 수집 이용 */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="checkbox"
                id="my-privacy"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                style={{ width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--accent)' }}
              />
              <div>
                <label htmlFor="my-privacy" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', cursor: 'pointer' }}>
                  {MARKETING_TERMS.privacy.title}
                </label>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0' }}>
                  이벤트 안내 및 맞춤형 혜택 제공 목적
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPrivacyDetail(!showPrivacyDetail)}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {showPrivacyDetail ? '닫기 ▲' : '전문보기 ▼'}
            </button>
          </div>

          {showPrivacyDetail && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#fff', borderRadius: '8px', fontSize: '0.76rem', color: '#4b5563', lineHeight: 1.6, border: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 4px' }}><strong>• 수집 목적:</strong> {MARKETING_TERMS.privacy.purpose}</p>
              <p style={{ margin: '0 0 4px' }}><strong>• 수집 항목:</strong> {MARKETING_TERMS.privacy.items}</p>
              <p style={{ margin: '0 0 4px' }}><strong>• 보유 기간:</strong> {MARKETING_TERMS.privacy.period}</p>
              <p style={{ margin: 0 }}><strong>• 거부 권리:</strong> {MARKETING_TERMS.privacy.rejectionRight}</p>
            </div>
          )}
        </div>

        {/* 2. 이메일 수신 동의 */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="checkbox"
              id="my-email"
              checked={emailConsent}
              onChange={(e) => setEmailConsent(e.target.checked)}
              style={{ width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--accent)' }}
            />
            <div>
              <label htmlFor="my-email" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', cursor: 'pointer' }}>
                {MARKETING_TERMS.email.title}
              </label>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0' }}>
                {MARKETING_TERMS.email.desc}
              </p>
            </div>
          </div>
        </div>

        {/* 3. 문자 수신 동의 */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="checkbox"
              id="my-sms"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              style={{ width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--accent)' }}
            />
            <div>
              <label htmlFor="my-sms" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', cursor: 'pointer' }}>
                {MARKETING_TERMS.sms.title}
              </label>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0' }}>
                {MARKETING_TERMS.sms.desc}
              </p>
            </div>
          </div>
        </div>

      </div>

      {errorMsg && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px' }}>
          {errorMsg}
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          type="button"
          onClick={handleWithdrawAll}
          disabled={saving}
          style={{
            padding: '10px 18px',
            background: '#f3f4f6',
            color: '#4b5563',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          전체 수신 철회
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      {/* 처리 결과 모달 안내 */}
      {notice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            padding: '28px 24px',
            boxShadow: '0 20px 30px rgba(0,0,0,0.15)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>
              {notice.status === 'agreed' ? '✅' : 'ℹ️'}
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
              {notice.action === 'withdraw' ? '마케팅 수신 철회 완료' : '마케팅 수신 설정 완료'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '16px', lineHeight: 1.5 }}>
              정보통신망법 제50조 제7항에 따른 수신 동의 처리 결과입니다.
            </p>

            <div style={{
              background: '#f9fafb',
              borderRadius: '12px',
              padding: '14px 16px',
              textAlign: 'left',
              fontSize: '0.82rem',
              lineHeight: 1.8,
              border: '1px solid #f3f4f6',
              marginBottom: '20px'
            }}>
              <div><strong>전송자:</strong> {notice.senderName}</div>
              <div><strong>처리일시:</strong> {new Date(notice.processedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
              <div><strong>개인정보 마케팅 이용:</strong> {notice.details.privacy}</div>
              <div><strong>이메일 수신:</strong> {notice.details.email}</div>
              <div><strong>문자(SMS) 수신:</strong> {notice.details.sms}</div>
            </div>

            <button
              onClick={() => setNotice(null)}
              style={{
                width: '100%',
                padding: '11px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
