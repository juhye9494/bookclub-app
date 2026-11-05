"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ENABLE_GLOBAL_POPUP } from '@/lib/config';

export default function MarketingConsentPopup() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!ENABLE_GLOBAL_POPUP) {
      setIsOpen(false);
      setLoading(false);
      return;
    }

    // 동의 페이지나 관리자 페이지에서는 팝업 노출 안 함
    if (pathname === '/consent' || pathname?.startsWith('/admin')) {
      setIsOpen(false);
      setLoading(false);
      return;
    }

    async function checkConsentStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          setIsOpen(false);
          setLoading(false);
          return;
        }

        const userId = session.user.id;
        setCurrentUserId(userId);

        // 계정별 '나중에' 유예 기간(7일) 체크 (계정 간 간섭 방지)
        const postponedUntil = localStorage.getItem(`marketing_consent_postponed_${userId}`);
        if (postponedUntil && parseInt(postponedUntil, 10) > Date.now()) {
          setIsOpen(false);
          setLoading(false);
          return;
        }

        // 현재 회원의 마케팅 동의 상태 확인
        const res = await fetch('/api/me/marketing-consent', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data = await res.json();
        const consent = data.consent;

        // 이미 명시적으로 동의(agreed), 거부(rejected), 철회(withdrawn)한 회원은 팝업을 노출하지 않음
        if (consent && (consent.status === 'agreed' || consent.status === 'rejected' || consent.status === 'withdrawn')) {
          setIsOpen(false);
          setLoading(false);
          return;
        }

        // 미응답(unanswered) 회원에게만 팝업 표시 (유료 구독 여부와 무관)
        setIsOpen(true);
      } catch (err) {
        console.error('Marketing consent check failed:', err);
      } finally {
        setLoading(false);
      }
    }

    checkConsentStatus();

    // 로그인 이벤트 발생 시에도 재확인
    const handleAuthSuccess = () => {
      checkConsentStatus();
    };

    window.addEventListener('auth-success', handleAuthSuccess);
    return () => {
      window.removeEventListener('auth-success', handleAuthSuccess);
    };
  }, [pathname]);

  // '나중에' 클릭 시: 계정별로 7일간 재노출하지 않고 닫기 (미응답 상태 유지)
  const handlePostpone = () => {
    if (currentUserId) {
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem(`marketing_consent_postponed_${currentUserId}`, String(Date.now() + sevenDaysInMs));
    }
    setIsOpen(false);
  };

  // '신청하기' 클릭 시: 동의 설정 페이지(/consent)로 이동 (클릭만으로 동의 저장하지 않음)
  const handleGoToSettings = () => {
    setIsOpen(false);
    router.push('/consent');
  };

  // 단순 닫기: 미응답 유지
  const handleClose = () => {
    setIsOpen(false);
  };

  if (!ENABLE_GLOBAL_POPUP || !isOpen || loading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.25s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '420px',
          width: '100%',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          padding: 'clamp(28px, 6vw, 40px) clamp(20px, 5vw, 32px) clamp(24px, 5vw, 32px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
          position: 'relative',
          fontFamily: 'var(--sans)',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '18px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1
          }}
          aria-label="닫기"
        >
          ✕
        </button>

        {/* 골드색 제목: Notice */}
        <h3
          style={{
            fontFamily: 'var(--serif, Georgia, serif)',
            fontSize: 'clamp(1.6rem, 5vw, 2rem)',
            fontWeight: 700,
            color: '#c59b27',
            margin: '0 0 22px',
            letterSpacing: '0.02em',
            lineHeight: 1.25
          }}
        >
          Notice
        </h3>

        {/* 본문 */}
        <div
          style={{
            fontSize: 'clamp(0.92rem, 3.6vw, 1.02rem)',
            color: '#222222',
            lineHeight: 1.75,
            marginBottom: '28px',
            wordBreak: 'keep-all'
          }}
        >
          <p style={{ margin: '0 0 18px' }}>
            한경언더라인에서는 회원 여러분께<br />
            신간 출간 소식과 다양한 이벤트,<br />
            특별 혜택 등 유익한 정보를<br />
            빠르게 전해드리고자 합니다.
          </p>
          <p style={{ margin: 0, fontWeight: 500 }}>
            반가운 소식이 닿을 수 있도록,<br />
            지금 신청해 주세요.
          </p>
        </div>

        {/* 신청하기 버튼 (골드색) */}
        <button
          type="button"
          onClick={handleGoToSettings}
          style={{
            width: '100%',
            padding: '14px 20px',
            backgroundColor: '#c59b27',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(197, 155, 39, 0.3)',
            transition: 'opacity 0.2s',
            marginBottom: '12px'
          }}
        >
          신청하기
        </button>

        {/* 나중에 / 닫기 보조 액션 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '4px'
          }}
        >
          <button
            type="button"
            onClick={handlePostpone}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px',
              textDecoration: 'underline',
              textUnderlineOffset: '3px'
            }}
          >
            나중에 (7일간 안보기)
          </button>
          <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>|</span>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
