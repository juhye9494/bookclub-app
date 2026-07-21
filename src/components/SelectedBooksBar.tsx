"use client";
import React from 'react';

interface SelectedBooksBarProps {
  selected: Set<number>;
  books: any[];
  toggleBook: (idx: number, e?: React.MouseEvent) => void;
  onApply: () => void;
}

export default function SelectedBooksBar({ selected, books, toggleBook, onApply }: SelectedBooksBarProps) {
  if (selected.size === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, pointerEvents: 'none', animation: 'cartSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)', width: 'min(680px, calc(100% - 32px))' }}>
      <style>{`
        @keyframes cartSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .cart-x-btn:hover { transform: scale(1.2); }
      `}</style>
      <div style={{ pointerEvents: 'auto', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', padding: '14px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* 장바구니 아이콘 + 카운트 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '1.2rem' }}>📚</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700 }}>{selected.size}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / 4</span></span>
          </div>
          {/* 구분선 */}
          <div style={{ width: '1px', height: '32px', background: 'rgba(0,0,0,0.1)', flexShrink: 0 }} />
          {/* 선택 도서 썸네일 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, padding: '4px 2px', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
            <style>{`.hide-scroll::-webkit-scrollbar { display: none; }`}</style>
            <div className="hide-scroll" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '2px', flex: 1 }}>
              {Array.from(selected).map((idx) => books[idx] && (
                <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '40px', height: '55px', borderRadius: '4px 7px 7px 4px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <img src={books[idx].img} alt={books[idx].title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <button
                    className="cart-x-btn"
                    onClick={(e) => { e.stopPropagation(); toggleBook(idx, e); }}
                    style={{ position: 'absolute', top: '-7px', right: '-7px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', color: '#999', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.55rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', transition: 'transform 0.15s, color 0.15s' }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
          {/* 신청 버튼 */}
          <button onClick={onApply} style={{ padding: '12px 28px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(252,102,64,0.35)', flexShrink: 0 }}>
            신청하기
          </button>
        </div>
      </div>
    </div>
  );
}
