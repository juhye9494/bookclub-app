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
    const isLocalTestPopup =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.localStorage.getItem('__test_enable_marketing_popup') === '1';

    if (!ENABLE_GLOBAL_POPUP && !isLocalTestPopup) {
      setIsOpen(false);
      setLoading(false);
      return;
    }

    // 동의 페이지나 관리자 페이지에서는 팝업 노출 안 함
    if (pathname === '/consent' || pathname?.startsWith('/admin')) {
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

        // 미응답(unanswered) 회원에게만 팝업 표시
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

  // '동의 여부 설정하기' 클릭 시: 동의 페이지로 이동
  const handleGoToSettings = () => {
    setIsOpen(false);
    router.push('/consent');
  };

  // 단순 닫기: 미응답 유지
  const handleClose = () => {
    setIsOpen(false);
  };

  const isLocalTestPopup =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.localStorage.getItem('__test_enable_marketing_popup') === '1';

  if ((!ENABLE_GLOBAL_POPUP && !isLocalTestPopup) || !isOpen || loading) return null;

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
        padding: '20px',
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
          maxWidth: '440px',
          width: '100%',
          padding: '32px 28px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          position: 'relative',
          fontFamily: 'var(--sans)',
          textAlign: 'center'
        }}
      >
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px'
          }}
          aria-label="닫기"
        >
          ✕
        </button>

        <div style={{ fontSize: '38px', marginBottom: '14px' }}>🎁</div>

        <h3 style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '10px',
          lineHeight: 1.4
        }}>
          한경 언더라인의 새로운 소식과<br/>독서 혜택을 받아보시겠어요?
        </h3>

        <p style={{
          fontSize: '0.92rem',
          color: '#4b5563',
          lineHeight: 1.6,
          marginBottom: '20px'
        }}>
          새로운 도서 라인업, 북토크 초대권, 기수 할인 등 회원 전용 혜택을 놓치지 않도록 안내해 드립니다.
        </p>

        <div style={{
          background: '#f9fafb',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '0.8rem',
          color: '#6b7280',
          textAlign: 'left',
          lineHeight: 1.5,
          border: '1px solid #f3f4f6'
        }}>
          💡 <strong>안내:</strong> 동의 여부와 무관하게 기존 독서클럽 서비스는 정상적으로 자유롭게 이용하실 수 있습니다.
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handlePostpone}
            style={{
              flex: 1,
              padding: '13px 16px',
              backgroundColor: '#f3f4f6',
              color: '#4b5563',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            나중에 (7일간 안보기)
          </button>
          <button
            onClick={handleGoToSettings}
            style={{
              flex: 1.2,
              padding: '13px 16px',
              backgroundColor: 'var(--accent, #1e3a8a)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)',
              transition: 'opacity 0.2s'
            }}
          >
            동의 여부 설정하기
          </button>
        </div>
      </div>
    </div>
  );
}
