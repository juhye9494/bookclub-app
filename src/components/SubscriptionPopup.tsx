'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SubscriptionPopup() {
  const router = useRouter();
  const [status, setStatus] = useState<'none' | 'closing' | 'closed'>('none');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // 대상 기수 하드코딩
  const TARGET_CYCLE_ID = 'cycle-2026-h1';

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/cycles/subscribers-count`);
        if (!res.ok) throw new Error('Failed to fetch');
        
        const data = await res.json();
        const currentStatus = data.status;
        setStatus(currentStatus);

        if (currentStatus === 'closing' || currentStatus === 'closed') {
          // 상태별 독립적인 localStorage 키 사용
          const storageKey = `hide_subscription_popup_${TARGET_CYCLE_ID}_${currentStatus}`;
          const hideDate = localStorage.getItem(storageKey);
          const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
          
          if (hideDate !== today) {
            setVisible(true);
          }
        }
      } catch (err) {
        console.error('Popup status fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  if (loading || !visible || status === 'none') return null;

  const isClosed = status === 'closed';

  const handleClose = () => {
    setVisible(false);
  };

  const handleHideToday = () => {
    const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    const storageKey = `hide_subscription_popup_${TARGET_CYCLE_ID}_${status}`;
    localStorage.setItem(storageKey, today);
    setVisible(false);
  };

  const handleSubscribe = () => {
    router.push('/payment');
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className="relative bg-[#faf9f7] w-full max-w-[500px] rounded-2xl shadow-2xl border border-gray-200/50"
        style={{ height: 'auto', maxHeight: '95vh', overflowY: 'auto' }}
      >
        <button 
          onClick={handleClose}
          className="absolute text-gray-400 hover:text-gray-700 transition-colors bg-white rounded-full p-1.5 z-10"
          style={{ top: '16px', right: '16px' }}
          aria-label="닫기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="w-full flex flex-col items-center text-center box-border" style={{ padding: '36px 28px 30px' }}>
          <span className="text-xs font-bold tracking-widest text-[#fc6640]" style={{ marginBottom: '8px' }}>
            {isClosed ? 'MEMBERSHIP CLOSED' : 'MEMBERSHIP'}
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-keep" style={{ marginBottom: '16px', padding: '0 8px' }}>
            {isClosed 
              ? '한경 언더라인 1기 모집 마감' 
              : '멤버십 모집 마감이 임박했습니다'}
          </h2>

          {isClosed ? (
            <div className="flex flex-col text-[15px] sm:text-base leading-[1.8] text-gray-600 break-keep w-full" style={{ gap: '26px' }}>
              <p>
                안녕하세요.<br/>
                예상보다 많은 관심을 보내주셔서<br/>
                준비된 모집 인원이 모두 마감되었습니다.
              </p>
              <p>
                한경 언더라인에 보내주신 관심에 진심으로 감사드리며,<br/>
                다음 기수 모집 소식은<br/>
                한경 언더라인 홈페이지를 통해 안내해 드리겠습니다.
              </p>
              <p className="font-medium">
                감사합니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-col text-[15px] sm:text-base leading-[1.8] text-gray-600 break-keep w-full" style={{ gap: '26px' }}>
              <p>
                안녕하세요.<br/>
                한경 언더라인에 보내주신 관심에 감사드립니다.
              </p>
              <p>
                많은 분들께서 함께해 주신 덕분에<br/>
                멤버십 가입 가능 정원이 얼마 남지 않았습니다.
              </p>
              <p>
                정원 마감 시 모집이 종료될 예정이니,<br/>
                서둘러 신청해 주세요.
              </p>
              <p>
                지금, 한경 언더라인과 함께<br/>
                즐거운 독서 여정을 시작해보시길 바랍니다.
              </p>
              <p className="font-medium">
                감사합니다.
              </p>
            </div>
          )}

          <div className="flex flex-col" style={{ width: '90%', marginTop: '30px' }}>
            {!isClosed ? (
              <button 
                onClick={handleSubscribe}
                className="w-full py-[14px] bg-[#fc6640] text-white rounded-xl font-semibold text-base shadow-lg shadow-[#fc6640]/30 hover:bg-[#e55a36] hover:-translate-y-0.5 transition-all"
              >
                멤버십 신청하기
              </button>
            ) : (
              <button 
                onClick={handleClose}
                className="w-full py-[14px] bg-gray-900 text-white rounded-xl font-semibold text-base hover:bg-gray-800 transition-colors"
              >
                확인
              </button>
            )}
            
            <button 
              onClick={handleHideToday}
              className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-4 transition-colors"
              style={{ marginTop: '16px' }}
            >
              오늘 하루 보지 않기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
