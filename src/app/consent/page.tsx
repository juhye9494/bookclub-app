"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { MARKETING_TERMS, CURRENT_CONSENT_VERSION } from '@/constants/marketingTerms';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
}

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

export default function MarketingConsentPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 선택 동의 항목 상태 (기본값: 체크 해제)
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  // 저장 완료 후 안내 모달 상태
  const [completedNotice, setCompletedNotice] = useState<NoticeData | null>(null);

  // 약관 상세 보기 아코디언 토글
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.dispatchEvent(
            new CustomEvent('open-login', {
              detail: {
                mode: 'login',
                returnTo: '/consent',
              },
            })
          );
          setLoading(false);
          return;
        }

        const res = await fetch('/api/me/marketing-consent', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          if (data.consent) {
            setPrivacyConsent(Boolean(data.consent.privacy_marketing_consent));
            setEmailConsent(Boolean(data.consent.email_marketing_consent));
            setSmsConsent(Boolean(data.consent.sms_marketing_consent));
          }
        }
      } catch (err) {
        console.error('Failed to load consent page data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // 전체 선택 핸들러
  const handleToggleAll = (checked: boolean) => {
    setPrivacyConsent(checked);
    setEmailConsent(checked);
    setSmsConsent(checked);
  };

  const isAllChecked = privacyConsent && emailConsent && smsConsent;

  // 동의 설정 저장 핸들러
  const handleSave = async (isExplicitReject: boolean = false) => {
    setSaveError(null);
    if (!isExplicitReject && (emailConsent || smsConsent) && !privacyConsent) {
      setSaveError('이메일 또는 문자(SMS) 수신에 동의하시려면 [선택] 마케팅 목적의 개인정보 수집·이용에 동의해 주세요.');
      return;
    }
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('로그인이 필요합니다.');
        router.push('/');
        return;
      }

      const payload = isExplicitReject
        ? {
            privacy_marketing_consent: false,
            email_marketing_consent: false,
            sms_marketing_consent: false,
            consent_source: 'consent_page',
            action_type: 'reject'
          }
        : {
            privacy_marketing_consent: privacyConsent,
            email_marketing_consent: emailConsent,
            sms_marketing_consent: smsConsent,
            consent_source: 'consent_page',
            action_type: (privacyConsent || emailConsent || smsConsent) ? 'agree' : 'reject'
          };

      const res = await fetch('/api/me/marketing-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error || '저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }

      if (isExplicitReject) {
        setPrivacyConsent(false);
        setEmailConsent(false);
        setSmsConsent(false);
      }

      setCompletedNotice(data.notice);
    } catch (err) {
      console.error('Save consent error:', err);
      setSaveError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  // 전화번호 마스킹 (010-****-1234)
  const formatMaskedPhone = (phone: string) => {
    if (!phone) return '미등록';
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div style={{ padding: '120px 20px', textAlign: 'center', fontFamily: 'var(--sans)', color: '#6b7280' }}>
        정보를 불러오는 중입니다...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: '480px', margin: '100px auto', padding: '40px 24px', textAlign: 'center', fontFamily: 'var(--sans)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px' }}>로그인이 필요한 페이지입니다</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>한경 언더라인 회원 계정으로 로그인 후 동의 설정을 진행해 주세요.</p>
        <button
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('open-login', {
                detail: { mode: 'login', returnTo: '/consent' }
              })
            );
          }}
          style={{
            padding: '12px 28px',
            backgroundColor: 'var(--accent, #1e3a8a)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: 'calc(100vh - 80px)', padding: '60px 20px', fontFamily: 'var(--sans)' }}>
      <div style={{ maxWidth: '580px', margin: '0 auto', background: '#ffffff', borderRadius: '24px', padding: '40px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ 
            display: 'inline-block', 
            padding: '4px 12px', 
            background: '#e0e7ff', 
            color: '#3730a3', 
            borderRadius: '20px', 
            fontSize: '0.8rem', 
            fontWeight: 600,
            marginBottom: '12px' 
          }}>
            회원 전용 맞춤 설정
          </span>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            마케팅 수신 동의 설정
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#6b7280', marginTop: '10px', lineHeight: 1.6 }}>
            한경 언더라인의 신간 도서, 기수 모집, 특별 강연 및<br/>
            다양한 회원 전용 혜택 정보를 선택하여 받아보실 수 있습니다.
          </p>
        </div>

        {/* 연결된 회원 기본 정보 (재입력 방지) */}
        <div style={{ 
          background: '#f8fafc', 
          borderRadius: '16px', 
          padding: '20px', 
          marginBottom: '28px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '12px', letterSpacing: '0.02em' }}>
            연결된 회원 계정 정보
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: '8px', fontSize: '0.88rem' }}>
            <span style={{ color: '#94a3b8' }}>이름</span>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{profile.name || '미등록'}</span>

            <span style={{ color: '#94a3b8' }}>이메일</span>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{profile.email}</span>

            <span style={{ color: '#94a3b8' }}>연락처</span>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{formatMaskedPhone(profile.phone)}</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '12px', borderTop: '1px solid #edf2f7', paddingTop: '8px' }}>
            * 회원 정보 수정은 마이페이지 &gt; 프로필 관리에서 변경하실 수 있습니다.
          </div>
        </div>

        {/* 선택 항목 전체 동의 */}
        <div style={{
          padding: '16px 20px',
          background: '#f1f5f9',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          cursor: 'pointer'
        }}
        onClick={() => handleToggleAll(!isAllChecked)}
        >
          <input
            type="checkbox"
            id="all-consent"
            checked={isAllChecked}
            onChange={(e) => handleToggleAll(e.target.checked)}
            style={{ width: '20px', height: '20px', accentColor: 'var(--accent, #1e3a8a)', cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="all-consent" style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
            마케팅 수신 전체 동의 (선택)
          </label>
        </div>

        {/* 개별 선택 동의 항목 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          
          {/* 1. 개인정보 수집 이용 동의 */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                <input
                  type="checkbox"
                  id="privacy-consent"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  style={{ width: '18px', height: '18px', marginTop: '3px', accentColor: 'var(--accent, #1e3a8a)', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="privacy-consent" style={{ fontSize: '0.94rem', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                    {MARKETING_TERMS.privacy.title}
                  </label>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>
                    이벤트, 할인 혜택 및 신간 도서 추천 등 마케팅 목적 활용
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyDetail(!showPrivacyDetail)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.78rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '2px',
                  whiteSpace: 'nowrap'
                }}
              >
                {showPrivacyDetail ? '닫기 ▲' : '전문보기 ▼'}
              </button>
            </div>

            {/* 약관 상세 내용 토글 */}
            {showPrivacyDetail && (
              <div style={{
                marginTop: '14px',
                padding: '14px',
                background: '#f8fafc',
                borderRadius: '10px',
                fontSize: '0.78rem',
                color: '#475569',
                lineHeight: 1.6,
                border: '1px solid #f1f5f9'
              }}>
                <p style={{ margin: '0 0 6px' }}><strong>• 수집·이용 목적:</strong> {MARKETING_TERMS.privacy.purpose}</p>
                <p style={{ margin: '0 0 6px' }}><strong>• 수집 항목:</strong> {MARKETING_TERMS.privacy.items}</p>
                <p style={{ margin: '0 0 6px' }}><strong>• 보유 및 이용 기간:</strong> {MARKETING_TERMS.privacy.period}</p>
                <p style={{ margin: 0, color: '#64748b' }}><strong>• 동의 거부 권리:</strong> {MARKETING_TERMS.privacy.rejectionRight}</p>
              </div>
            )}
          </div>

          {/* 2. 이메일 수신 동의 */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <input
                type="checkbox"
                id="email-consent"
                checked={emailConsent}
                onChange={(e) => setEmailConsent(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '3px', accentColor: 'var(--accent, #1e3a8a)', cursor: 'pointer' }}
              />
              <div>
                <label htmlFor="email-consent" style={{ fontSize: '0.94rem', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                  {MARKETING_TERMS.email.title}
                </label>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>
                  {MARKETING_TERMS.email.desc}
                </p>
              </div>
            </div>
          </div>

          {/* 3. 문자(SMS/MMS) 수신 동의 */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <input
                type="checkbox"
                id="sms-consent"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '3px', accentColor: 'var(--accent, #1e3a8a)', cursor: 'pointer' }}
              />
              <div>
                <label htmlFor="sms-consent" style={{ fontSize: '0.94rem', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                  {MARKETING_TERMS.sms.title}
                </label>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>
                  {MARKETING_TERMS.sms.desc}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* 에러 메시지 */}
        {saveError && (
          <div style={{ 
            background: '#fee2e2', 
            color: '#b91c1c', 
            padding: '12px 16px', 
            borderRadius: '10px', 
            fontSize: '0.85rem', 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {saveError}
          </div>
        )}

        {/* 안내 문구 */}
        <div style={{ 
          fontSize: '0.8rem', 
          color: '#6b7280', 
          lineHeight: 1.6, 
          marginBottom: '28px', 
          background: '#fafafa',
          padding: '14px 18px',
          borderRadius: '12px',
          borderLeft: '3px solid #94a3b8'
        }}>
          • 본 동의는 선택 사항이며, 동의하지 않으셔도 한경 언더라인의 모든 기본 서비스(도서 구독, 도서 선택, 독서모임 등)를 제한 없이 정상적으로 이용하실 수 있습니다.<br/>
          • 수신 동의 여부는 언제든지 [마이페이지 &gt; 마케팅 수신 설정]에서 자유롭게 변경 또는 철회하실 수 있습니다.
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            style={{
              flex: 1,
              padding: '14px 20px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            동의하지 않음 (전체 거부)
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            style={{
              flex: 1.5,
              padding: '14px 20px',
              backgroundColor: 'var(--accent, #1e3a8a)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.98rem',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)'
            }}
          >
            {saving ? '저장 중...' : '동의 설정 저장하기'}
          </button>
        </div>

      </div>

      {/* 저장 완료 알림 모달 (정보통신망법 제50조 제8항 알림) */}
      {completedNotice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            padding: '32px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>
              {completedNotice.status === 'agreed' ? '✅' : 'ℹ️'}
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
              마케팅 수신 설정이 완료되었습니다
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '20px' }}>
              정보통신망 이용촉진 및 정보보호 등에 관한 법률 제50조 제7항에 따라 수신 동의 처리 결과를 안내해 드립니다.
            </p>

            <div style={{
              background: '#f8fafc',
              borderRadius: '14px',
              padding: '16px 20px',
              textAlign: 'left',
              fontSize: '0.84rem',
              marginBottom: '24px',
              border: '1px solid #e2e8f0',
              lineHeight: 1.7
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>전송자 명칭</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{completedNotice.senderName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>처리 일시</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {new Date(completedNotice.processedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>개인정보 마케팅 이용</span>
                <span style={{ fontWeight: 600, color: completedNotice.details.privacy.includes('동의') ? '#16a34a' : '#64748b' }}>
                  {completedNotice.details.privacy}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>이메일 수신 동의</span>
                <span style={{ fontWeight: 600, color: completedNotice.details.email.includes('수신동의') ? '#16a34a' : '#64748b' }}>
                  {completedNotice.details.email}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>문자(SMS) 수신 동의</span>
                <span style={{ fontWeight: 600, color: completedNotice.details.sms.includes('수신동의') ? '#16a34a' : '#64748b' }}>
                  {completedNotice.details.sms}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setCompletedNotice(null);
                router.push('/');
              }}
              style={{
                width: '100%',
                padding: '13px',
                backgroundColor: 'var(--accent, #1e3a8a)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              확인 (홈으로 이동)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
