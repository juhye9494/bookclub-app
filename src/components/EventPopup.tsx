'use client';

import React, { useEffect, useState } from 'react';

export default function EventPopup() {
  const [visible, setVisible] = useState(false);
  const [hideToday, setHideToday] = useState(false);

  // 팝업 식별자
  const POPUP_ID = 'book_launch_event_20261016';

  useEffect(() => {
    try {
      // 한국시간(KST = UTC+9) 기준 기간 체크
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const kstDate = new Date(utcMs + 9 * 60 * 60000);

      const kstYear = kstDate.getFullYear();
      const kstMonth = kstDate.getMonth() + 1;
      const kstDay = kstDate.getDate();

      // 게시 기간: 2026년 10월 16일 ~ 10월 18일 (10월 19일 0시부터 자동 종료)
      const inPeriod = (
        kstYear === 2026 &&
        kstMonth === 10 &&
        kstDay >= 16 &&
        kstDay <= 18
      );

      if (!inPeriod) {
        setVisible(false);
        return;
      }

      // 오늘 하루 보지 않기 여부 확인
      const storageKey = `hide_${POPUP_ID}`;
      const savedDate = localStorage.getItem(storageKey);
      const todayStr = `${kstYear}-${String(kstMonth).padStart(2, '0')}-${String(kstDay).padStart(2, '0')}`;

      if (savedDate === todayStr) {
        setVisible(false);
        return;
      }

      setVisible(true);
    } catch (err) {
      console.error('EventPopup check error:', err);
    }
  }, []);

  if (!visible) return null;

  const handleClose = () => {
    if (hideToday) {
      try {
        const now = new Date();
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const kstDate = new Date(utcMs + 9 * 60 * 60000);
        const todayStr = `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
        localStorage.setItem(`hide_${POPUP_ID}`, todayStr);
      } catch (e) {
        console.error(e);
      }
    }
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="relative bg-white w-full max-w-[420px] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100"
        style={{ maxHeight: 'calc(100vh - 32px)' }}
      >
        {/* 이미지 영역 (원본 비율 유지 및 길면 내부 스크롤) */}
        <div className="overflow-y-auto flex-1 min-h-0 -webkit-overflow-scrolling-touch">
          <a
            href="https://forms.gle/j9cFBg8ZUkqGDFSM8"
            target="_blank"
            rel="noopener noreferrer"
            className="block cursor-pointer focus:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/uploads/event-popup-oct2026.png"
              alt="출간 이벤트 — 궤도에 투자하라"
              className="w-full h-auto block select-none"
            />
          </a>
        </div>

        {/* 하단 바: 오늘 하루 보지 않기 + 닫기 버튼 */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
          <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideToday}
              onChange={(e) => setHideToday(e.target.checked)}
              className="w-4 h-4 rounded text-[#fc6640] accent-[#fc6640] cursor-pointer"
            />
            오늘 하루 보지 않기
          </label>

          <button
            onClick={handleClose}
            className="text-xs sm:text-sm font-semibold text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            닫기 ✕
          </button>
        </div>
      </div>
    </div>
  );
}
