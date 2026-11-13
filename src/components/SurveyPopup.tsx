"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ENABLE_SURVEY_POPUP } from '@/lib/config';

const SURVEY_URL = 'https://forms.gle/AbYtecJjhD7KsaQ28';
const SURVEY_POSTPONE_KEY = 'survey_popup_202611_postponed';

export default function SurveyPopup() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ENABLE_SURVEY_POPUP) {
      setIsOpen(false);
      setLoading(false);
      return;
    }

    // 관리자 페이지에서는 팝업 노출 안 함
    if (pathname?.startsWith('/admin')) {
      setIsOpen(false);
      setLoading(false);
      return;
    }

    try {
      // 설문 팝업 전용 '나중에' 유예 기간(7일) 체크
      const postponedUntil = localStorage.getItem(SURVEY_POSTPONE_KEY);
      if (postponedUntil && parseInt(postponedUntil, 10) > Date.now()) {
        setIsOpen(false);
        setLoading(false);
        return;
      }

      // 로그인 여부 및 마케팅 동의 여부와 관계없이 모든 방문자/회원에게 즉시 노출
      setIsOpen(true);
    } catch (err) {
      console.error('Survey popup check failed:', err);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  // '나중에' 클릭 시: 7일간 미표시
  const handlePostpone = () => {
    try {
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem(SURVEY_POSTPONE_KEY, String(Date.now() + sevenDaysInMs));
    } catch {}
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!ENABLE_SURVEY_POPUP || !isOpen || loading) return null;

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

        {/* 언더라인 주황색 제목 (굵게) */}
        <h3
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 'clamp(1.25rem, 4.5vw, 1.5rem)',
            fontWeight: 700,
            color: 'var(--accent, #fc6640)',
            margin: '0 0 22px',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            wordBreak: 'keep-all'
          }}
        >
          한경 언더라인 설문조사 안내
        </h3>

        {/* 본문: 일반 문장은 fontWeight 400, 선물 안내 문장만 fontWeight 700(굵게) */}
        <div
          style={{
            fontSize: 'clamp(0.92rem, 3.6vw, 1.02rem)',
            color: '#222222',
            lineHeight: 1.75,
            marginBottom: '28px',
            wordBreak: 'keep-all',
            fontWeight: 400
          }}
        >
          <p style={{ margin: '0 0 16px', fontWeight: 400 }}>
            한경 언더라인 1기에<br />
            함께해 주셔서 감사합니다.
          </p>
          <p style={{ margin: '0 0 16px', fontWeight: 400 }}>
            더 나은 2기를 준비하기 위해<br />
            여러분의 의견을 듣고자 합니다.
          </p>
          <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>
            <strong>
              설문에 끝까지 참여하신 모든 분께는<br />
              특별한 선물이 준비되어 있습니다.
            </strong>
          </p>
        </div>

        {/* 설문 참여하기 버튼 (언더라인 주황색, 새 탭 열기) */}
        <a
          href={SURVEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setIsOpen(false)}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 20px',
            backgroundColor: 'var(--accent, #fc6640)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(252, 102, 64, 0.35)',
            transition: 'opacity 0.2s',
            marginBottom: '12px',
            textDecoration: 'none',
            boxSizing: 'border-box'
          }}
        >
          설문 참여하기
        </a>

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
