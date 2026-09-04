'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApologyPopup() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // 팝업 ID
  const POPUP_ID = 'apology_popup_20260904';

  useEffect(() => {
    try {
      const storageKey = `hide_${POPUP_ID}`;
      const hideDate = localStorage.getItem(storageKey);
      const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
      
      if (hideDate !== today) {
        setVisible(true);
      }
    } catch (err) {
      console.error('Popup status check error:', err);
      setVisible(true);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading || !visible) return null;

  const handleClose = () => {
    setVisible(false);
  };

  const handleHideToday = () => {
    const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    const storageKey = `hide_${POPUP_ID}`;
    localStorage.setItem(storageKey, today);
    setVisible(false);
  };

  const handleInquiry = () => {
    router.push('/inquiry');
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
        className="relative bg-[#faf9f7] w-full max-w-[500px] rounded-2xl shadow-2xl border border-gray-200/50 flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <button 
          onClick={handleClose}
          className="absolute text-gray-400 hover:text-gray-700 transition-colors bg-white rounded-full p-1.5 z-10 shadow-sm"
          style={{ top: '16px', right: '16px' }}
          aria-label="닫기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="w-full flex flex-col items-center text-center box-border flex-shrink-0" style={{ paddingTop: '56px', paddingBottom: '28px', paddingLeft: '24px', paddingRight: '24px' }}>
          <span className="text-xs font-bold tracking-widest text-[#fc6640]" style={{ marginBottom: '16px' }}>
            NOTICE
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-keep" style={{ lineHeight: '1.4' }}>
            도서 오배송에 대한 사과 및<br/>후속 조치 안내
          </h2>
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-hide text-left box-border" style={{ paddingTop: '8px', paddingBottom: '40px', paddingLeft: '24px', paddingRight: '24px' }}>
          <div className="flex flex-col text-[14px] sm:text-[15px] leading-[1.7] text-gray-700 break-keep" style={{ gap: '18px' }}>
            <p>
              안녕하세요, 한경 언더라인 북클럽입니다.
            </p>
            <p>
              먼저, 저희 북클럽을 믿고 첫걸음을 함께해 주신 멤버 여러분께 큰 실망과 불편을 드려 진심으로 고개 숙여 사과드립니다.
            </p>
            <p>
              이번 도서 발송 과정에서 포장 및 분류 오류가 발생하여, 다수의 멤버님께 선택하신 것과 다른 도서가 배송되었습니다. 기대하며 책을 기다리셨을 멤버님들께 큰 실망과 불편을 드려 대단히 죄송합니다.
            </p>
            
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm mt-3 w-full box-border" style={{ padding: '20px' }}>
              <p className="font-bold text-gray-900 mb-2">■ 정상 도서 긴급 재발송 (9월 7일 월요일)</p>
              <p className="text-gray-600">
                멤버님께서 원래 선택하셨던 정상 도서는 오는 월요일(9/7)에 택배를 통해 전량 긴급 재발송하겠습니다.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm w-full box-border" style={{ padding: '20px' }}>
              <p className="font-bold text-gray-900 mb-2">■ 오배송 도서 안내 (회수 진행 안 함)</p>
              <p className="text-gray-600">
                잘못 받으신 도서는 번거롭게 반송하지 않으셔도 됩니다. 당사의 미숙함으로 발생한 실수인 만큼 너그러운 마음으로 양해해 주시기를 조심스럽게 부탁드립니다. 해당 도서는 주변의 좋은 분들께 선물하시거나 직접 읽어보시며, 저희가 만든 또 다른 책의 즐거움을 발견해 주시면 진심으로 감사하겠습니다.
              </p>
              <p className="text-gray-600 mt-3">
                단, 도서 처리가 곤란하여 회수를 원하시는 경우 <strong className="text-gray-800">‘1:1 게시판’</strong>에 글을 남겨주시면 당사 택배사를 통해 무료로 수거하겠습니다.
              </p>
            </div>

            <p className="mt-3">
              첫 진행부터 미숙한 모습을 보여드린 점 다시 한번 깊이 반성합니다. 배송 검수 시스템을 전면 개편하여 다시는 이런 일이 발생하지 않도록 철저히 관리하겠습니다.
            </p>
            <p className="font-medium text-right mt-4">
              한경 언더라인 북클럽 드림
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col items-center flex-shrink-0 border-t border-gray-100 box-border" style={{ marginTop: '8px', paddingTop: '28px', paddingBottom: '40px', paddingLeft: '24px', paddingRight: '24px' }}>
          <div className="flex gap-3 w-full">
            <button 
              onClick={handleClose}
              className="flex-1 py-[16px] bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold text-base hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
            <button 
              onClick={handleInquiry}
              className="flex-1 py-[16px] bg-gray-900 text-white rounded-xl font-semibold text-base shadow-md hover:bg-gray-800 transition-colors"
            >
              1:1 문의하기
            </button>
          </div>
          
          <button 
            onClick={handleHideToday}
            className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-4 transition-colors mt-6"
          >
            오늘 하루 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
