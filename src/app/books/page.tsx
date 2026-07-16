"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const MAX_SELECT = 4;

export default function BooksPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [cycleLabel, setCycleLabel] = useState<string>('로딩중...');
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const scrollPosRef = useRef<number>(0);
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    const handleAuthSuccess = () => {
      if (selected.size === MAX_SELECT) setIsPaymentOpen(true);
    };
    window.addEventListener('auth-success', handleAuthSuccess);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('auth-success', handleAuthSuccess);
    };
  }, []);

  const handlePayment = async () => {
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_oEjb0gm23P55WYjKGQpnVpGwBJn5';
      
      if (typeof (window as any).TossPayments === 'undefined') {
        alert('결제 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      
      const tossPayments = await (window as any).TossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: user?.id || 'ANONYMOUS' });
      
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: 45000 },
        orderId: `order_${new Date().getTime()}`,
        orderName: '한경 언더라인 독서클럽 3개월권',
        successUrl: `${window.location.origin}/success`,
        failUrl: `${window.location.origin}/fail`,
        customerEmail: user?.email || '',
        customerName: user?.user_metadata?.name || '구독자',
        customerMobilePhone: (user?.user_metadata?.phone || '').replace(/-/g, ''),
      });
    } catch (err: any) {
      if (err?.code === 'PAY_PROCESS_CANCELED' || err?.code === 'USER_CANCEL') {
        console.log('결제가 취소되었습니다.');
        return;
      }
      console.error(err);
      alert('결제창을 띄우는 데 실패했습니다.');
    }
  };

  useEffect(() => {
    async function loadBooks() {
      const { data: cycles } = await supabase.from('cycles').select('*').eq('status', 'active').order('start_date', { ascending: false }).limit(1);
      if (cycles && cycles.length > 0) {
        const cycle = cycles[0];
        setCycleLabel(cycle.label);
        const { data: bData } = await supabase.from('books').select('*').eq('cycle_id', cycle.id);
        if (bData) {
          const sortedBooks = [...bData].sort((a, b) => (a.order_idx || 0) - (b.order_idx || 0)).slice(0, 25);
          const colors = [
            { bg: '#3b4b72', bgDark: '#121931' }, { bg: '#c0392b', bgDark: '#7b241c' },
            { bg: '#c9a000', bgDark: '#7a6000' }, { bg: '#2ecc40', bgDark: '#1a7a26' },
            { bg: '#171717', bgDark: '#000000' }, { bg: '#605856', bgDark: '#3b3433' },
          ];
          const formatted = sortedBooks.map((b: any, i: number) => {
            const c = colors[i % colors.length];
            return {
              id: b.id, title: b.title, author: b.author, genre: b.genre,
              color: `book-${(i % 6) + 1}`, bg: b.bg || c.bg, bgDark: b.bgDark || c.bgDark,
              img: b.cover, tags: b.tags || [], desc: b.description, lecture: b.lecture,
              ebook_url: b.ebook_url || '', benefit: b.lecture ? '+ 저자 강연권' : '',
              is_new: b.is_new || false
            };
          });
          setBooks(formatted);
        }
      } else { setCycleLabel('준비된 시즌이 없습니다.'); }
      setLoadingBooks(false);
    }
    loadBooks();
    const saved = sessionStorage.getItem('bookSelection');
    if (saved) setSelected(new Set(JSON.parse(saved)));
  }, []);

  const toggleBook = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); }
      else {
        if (next.size >= MAX_SELECT) { alert('이미 4권을 선택하셨어요. 다른 책을 빼고 담아주세요.'); return prev; }
        next.add(idx);
      }
      sessionStorage.setItem('bookSelection', JSON.stringify([...next]));
      return next;
    });
  };

  const openDetail = (idx: number) => {
    scrollPosRef.current = window.scrollY;
    setDetailIdx(idx); setIsDetailOpen(true);
    window.history.pushState({ bookDetail: true }, '');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setTimeout(() => { window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' }); }, 0);
  };

  // 브라우저 뒤로가기 시 상세 뷰 닫기
  useEffect(() => {
    const handlePopState = () => {
      if (isDetailOpen) {
        setIsDetailOpen(false);
        setTimeout(() => { window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' }); }, 0);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDetailOpen]);

  const activeBook = detailIdx !== null ? books[detailIdx] : null;

  // Find recommended
  const recommendedIdx = books.findIndex(b => b.tags.includes('대표 도서') || b.tags.includes('추천 도서'));
  const finalRecIdx = recommendedIdx !== -1 ? recommendedIdx : 0;
  const recommendedBook = books[finalRecIdx];
  const otherBooks = books.map((book, originalIdx) => ({ book, originalIdx })).filter((_, idx) => idx !== finalRecIdx).slice(0, 20);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--sans)', paddingTop: '64px' }}>
      <style>{`
        .books-page-rec {
          display: grid; grid-template-columns: 330px 1fr; gap: 56px;
          width: 100%; max-width: 980px; margin: 0 auto;
          background: linear-gradient(135deg, rgba(20,20,20,0.92) 0%, rgba(45,45,45,0.92) 100%);
          border: 1px solid rgba(252, 102, 64, 0.25); border-radius: 28px; padding: 56px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.3), 0 0 40px rgba(252, 102, 64, 0.08);
          color: #fff; text-align: left; align-items: center; position: relative; overflow: hidden;
          backdrop-filter: blur(12px); transition: transform 0.4s, border-color 0.4s, box-shadow 0.4s;
        }
        .books-page-rec::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(252,102,64,0.08) 0%, transparent 60%); pointer-events: none; z-index: 0; }
        .books-page-rec:hover { transform: translateY(-4px); box-shadow: 0 35px 70px rgba(0,0,0,0.35), 0 0 50px rgba(252,102,64,0.15); border-color: rgba(252,102,64,0.4); }
        .books-page-rec .dv-cover { width: 240px !important; height: 340px !important; border-radius: 6px 16px 16px 6px !important; box-shadow: -12px 16px 36px rgba(0,0,0,0.6) !important; transition: transform 0.4s, box-shadow 0.4s !important; transform: rotateY(-5deg) rotateX(2deg); }
        .books-page-rec .dv-cover:hover { transform: scale(1.04) rotateY(0deg) rotateX(0deg) !important; box-shadow: -16px 24px 48px rgba(0,0,0,0.7), 0 0 25px rgba(252,102,64,0.4) !important; }
        @media (max-width: 768px) {
          .books-page-rec { grid-template-columns: 1fr !important; padding: 48px 24px !important; gap: 32px !important; text-align: center !important; }
          .books-page-rec .dv-cover { width: 200px !important; height: 284px !important; margin: 0 auto !important; transform: none !important; }
        }
      `}</style>

      {isDetailOpen && activeBook ? (
        /* ===== DETAIL VIEW ===== */
        <div id="detail-view">
          <div className="dv-hero" style={{ display: 'flex', flexDirection: 'column', minHeight: 'auto', padding: '0' }}>
            <div className="dv-hero-bg" style={{ background: `linear-gradient(160deg, ${activeBook.bgDark} 0%, ${activeBook.bg} 100%)` }}></div>
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '32px 5vw 16px' }}>
              <button className="dv-back-white" onClick={closeDetail}>
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                도서 목록으로
              </button>
            </div>
            <div className="dv-hero-inner" style={{ padding: '16px 5vw 64px' }}>
              <div className="dv-cover"><img src={activeBook.img} alt="" /></div>
              <div className="dv-meta">
                <p className="dv-genre">{activeBook.genre}</p>
                <h2 className="dv-title">{activeBook.title}</h2>
                <p className="dv-author">{activeBook.author}</p>
                <div className="dv-tags">
                  {activeBook.tags.map((t: string, i: number) => (
                    <span key={i} className={`dv-tag ${t === '강연 포함' ? 'lecture' : ''}`}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="dv-body">
            <div className="dv-main">
              <div className="dv-section">
                <p className="dv-label">책 소개</p>
                <div className="dv-text" dangerouslySetInnerHTML={{ __html: (activeBook.desc || '').replace(/\n/g, '<br/>') }} />
              </div>
              {activeBook.lecture && (
                <div className="dv-section">
                  <p className="dv-label">저자 강연</p>
                  <div className="dv-lecture-card">
                    <div className="dv-lecture-header">
                      <span className="dv-lecture-icon">🎙</span>
                      <span className="dv-lecture-title">저자 온라인 강연 포함</span>
                      <span className="dv-lecture-badge">무료 제공</span>
                    </div>
                    <p className="dv-lecture-desc">{activeBook.lecture.desc}</p>
                    <ul className="dv-lecture-perks">
                      {activeBook.lecture.perks.map((p: string, i: number) => (
                        <li key={i}><span className="dv-perk-dot"></span>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="dv-sidebar">
              <div className="dv-sidebar-card">
                <div className="dv-sidebar-cover"><img src={activeBook.img} alt="" /></div>
                <p className="dv-sidebar-genre">{activeBook.genre}</p>
                <p className="dv-sidebar-title">{activeBook.title}</p>
                <p className="dv-sidebar-author">{activeBook.author}</p>
                <div className="dv-sidebar-divider"></div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>구독 플랜에 포함</p>
                <div className="plan-row"><span className="l">구독권</span><span className="r">3개월권</span></div>
                <div className="plan-row"><span className="l">도서 선택</span><span className="r">3개월간 4권</span></div>
                <div className="plan-row"><span className="l">구독 금액</span><span className="r" style={{ color: 'var(--accent)' }}>45,000원</span></div>
                <button className={`dv-add-btn ${detailIdx !== null && selected.has(detailIdx) ? 'added' : ''}`} onClick={() => detailIdx !== null && toggleBook(detailIdx)}>
                  {detailIdx !== null && selected.has(detailIdx) ? '✓ 담겼어요' : '+ 내 목록에 담기'}
                </button>
              </div>
            </div>
          </div>

          <div className="dv-other">
            <div className="dv-other-inner">
              <p className="dv-other-label">다른 도서</p>
              <h3 className="dv-other-title">3개월간 4권을 골라보세요</h3>
              <div className="dv-other-grid">
                {books.map((b, i) => (
                  <div key={i} className={`dv-other-card ${i === detailIdx ? 'active' : ''}`} onClick={() => openDetail(i)}>
                    <div className="dv-other-cover"><img src={b.img} alt={b.title} /></div>
                    <p className="dv-other-name">{b.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===== BOOK LIST VIEW ===== */
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 5vw 80px' }}>

          {/* FLOATING CART BAR — 하단 고정 */}
          {selected.size > 0 && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, pointerEvents: 'none', animation: 'cartSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
              <style>{`
                @keyframes cartSlideUp {
                  from { opacity: 0; transform: translateY(20px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .cart-x-btn:hover { transform: scale(1.2); }
              `}</style>
              <div style={{ pointerEvents: 'auto', background: 'rgba(26,24,21,0.96)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px max(20px, 4vw) max(16px, env(safe-area-inset-bottom, 16px))' }}>
                <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* 장바구니 아이콘 + 카운트 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '1.3rem' }}>📚</span>
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{selected.size}<span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}> / 4</span></span>
                  </div>
                  {/* 구분선 */}
                  <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                  {/* 선택 도서 썸네일 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, padding: '6px 4px' }}>
                    {Array.from(selected).map((idx) => books[idx] && (
                      <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: '42px', height: '58px', borderRadius: '4px 7px 7px 4px', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.2)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                          <img src={books[idx].img} alt={books[idx].title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <button
                          className="cart-x-btn"
                          onClick={(e) => { e.stopPropagation(); toggleBook(idx); }}
                          style={{ position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px', borderRadius: '50%', background: '#fff', color: '#333', border: '1.5px solid rgba(0,0,0,0.08)', fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', transition: 'transform 0.15s' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                  {/* 신청 버튼 */}
                  <button onClick={() => {
                    if (user) { setIsPaymentOpen(true); }
                    else { window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } })); }
                  }} style={{ padding: '13px 30px', background: 'linear-gradient(135deg, var(--accent), #e8553a)', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 18px rgba(252,102,64,0.45)', flexShrink: 0 }}>
                    신청하기
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Page Header */}
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '12px' }}>BOOK CURATION</p>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700, lineHeight: 1.3, marginBottom: '16px' }}>이번 시즌 도서를<br className="mobile-br" /> 골라보세요</h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: '0' }}>3개월간 총 4권의 도서를<br className="mobile-br" /> 자유롭게 선택하실 수 있습니다.</p>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'center' }}>
              <p style={{ margin: 0 }}>• 도서는 4권을 한 번에 신청하시거나,<br className="mobile-br" /> 1권씩 나누어 신청하실 수 있습니다.</p>
              <p style={{ margin: 0 }}>• 도서는 신청 시점에 맞춰<br className="mobile-br" /> 순차적으로 발송되며, 주 1회 진행됩니다.</p>
              <p style={{ margin: 0 }}>• 신간 도서는 매월 초<br className="mobile-br" /> 홈페이지를 통해 업데이트됩니다.</p>
            </div>
          </div>

          {loadingBooks ? (
            <div style={{ textAlign: 'center', padding: '100px 0', fontSize: '1.2rem', color: '#666' }}>도서 목록을 불러오는 중입니다...</div>
          ) : (
            <>
              {/* Recommended Book */}
              {recommendedBook && (
                <div className="books-page-rec" style={{ marginBottom: '64px' }}>
                  <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '6px 16px', borderRadius: '30px', zIndex: 2, boxShadow: '0 4px 12px rgba(252,102,64,0.4)' }}>★ 이번 기수 대표 도서</div>
                  <div style={{ display: 'flex', justifyContent: 'center', zIndex: 1 }}>
                    <div style={{ perspective: '1000px' }}>
                      <div style={{ width: '220px', borderRadius: '4px 12px 12px 4px', flexShrink: 0, position: 'relative', overflow: 'hidden', boxShadow: '-6px 8px 32px rgba(0,0,0,0.35)', cursor: 'pointer' }} onClick={() => openDetail(finalRecIdx)}>
                        <img src={recommendedBook.img} alt={recommendedBook.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                        <div style={{ content: "''", position: 'absolute', left: 0, top: 0, bottom: 0, width: '12px', background: 'rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{recommendedBook.genre}</span>
                    <h3 style={{ fontFamily: 'var(--serif)', fontSize: '2.1rem', fontWeight: 700, marginBottom: '10px', color: '#fff', lineHeight: 1.3, cursor: 'pointer' }} onClick={() => openDetail(finalRecIdx)}>{recommendedBook.title}</h3>
                    <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', marginBottom: '18px' }}>{recommendedBook.author}</p>
                    <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.8', marginBottom: '24px', wordBreak: 'keep-all', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' as any }}>
                      {(recommendedBook.desc || '').replace(/<[^>]*>/g, '').split('\n').filter((line: string) => line.trim()).slice(0, 5).map((line: string, i: number) => (
                        <span key={i}>{line.trim()}{i < 4 && <br/>}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '28px' }}>
                      {recommendedBook.tags.map((t: string) => (
                        <span key={t} style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: '20px', color: 'rgba(255,255,255,0.85)' }}>{t}</span>
                      ))}
                      {recommendedBook.lecture && <span style={{ fontSize: '0.72rem', background: 'var(--accent)', padding: '4px 12px', borderRadius: '20px', color: '#fff', fontWeight: 600 }}>🎙 저자 강연 포함</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 4px 15px rgba(252,102,64,0.4)' }} onClick={() => openDetail(finalRecIdx)}>상세 보기</button>
                      <button onClick={(e) => toggleBook(finalRecIdx, e)}
                        style={{ padding: '12px 28px', fontSize: '0.9rem', fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.7)', color: selected.has(finalRecIdx) ? 'var(--text)' : '#fff', background: selected.has(finalRecIdx) ? '#fff' : 'transparent', borderRadius: '100px', cursor: 'pointer', transition: 'all 0.2s' }}
                      >{selected.has(finalRecIdx) ? '✓ 담겼어요' : '+ 담기'}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Books Grid */}
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 700, textAlign: 'left', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                도서 큐레이션 풀
              </h3>
              <div className="book-grid" id="bookShelf" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '28px 20px', marginBottom: '40px' }}>
                {otherBooks.map(({ book, originalIdx }) => (
                  <div key={book.id} className={`book-card ${selected.has(originalIdx) ? 'selected' : ''}`}>
                    <div className="book-card-inner" style={{ position: 'relative' }}>
                      {book.is_new && <div style={{ position: 'absolute', top: '-8px', left: '-8px', width: '40px', height: '40px', background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, borderRadius: '50%', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.03em', boxShadow: '0 3px 10px rgba(231,76,60,0.5)', transform: 'rotate(-12deg)' }}>NEW</div>}
                      <div className="book-cover" style={{ cursor: 'pointer' }} onClick={() => openDetail(originalIdx)}>
                        {book.tags.includes('강연 포함') && <div className="book-lecture-badge">강연 포함</div>}
                        <img src={book.img} alt={book.title} />
                      </div>
                      <button className={`book-select-btn ${selected.has(originalIdx) ? 'added' : ''}`} onClick={(e) => toggleBook(originalIdx, e)}>
                        {selected.has(originalIdx) ? '✓ 담겼어요' : '+ 담기'}
                      </button>
                    </div>
                    <p className="book-title" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', minHeight: 'auto', marginTop: '12px', marginBottom: '2px' }}>{book.title}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '6px' }}>{book.author}</p>
                    <p className="book-benefit">{book.benefit}</p>
                  </div>
                ))}
              </div>

              {/* Footer / Selection bar */}
              <div className="shelf-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '32px', marginTop: '24px' }}>
                <p className="shelf-hint">{selected.size === 0 ? '원하는 책을 골라보세요 (최대 4권)' : `${selected.size}권이 담겼어요!`}</p>
                <div className="shelf-counter">
                  <div className="counter-dots">
                    {[0, 1, 2, 3].map((dot) => (<div key={dot} className={`counter-dot ${dot < selected.size ? 'filled' : ''}`}></div>))}
                  </div>
                  <span>{selected.size} / 4권</span>
                </div>
                <button className={`btn-delivery ${selected.size > 0 ? 'visible' : ''}`} onClick={() => {
                  if (user) { setIsPaymentOpen(true); }
                  else { window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } })); }
                }}>선택한 {selected.size}권 신청하기</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* PAYMENT MODAL */}
      <div className={`modal-overlay ${isPaymentOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsPaymentOpen(false); }}>
        <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <button className="modal-close" onClick={() => setIsPaymentOpen(false)}>✕</button>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}><img src="/uploads/underline_logo.svg" alt="한경 언더라인 독서클럽" style={{ height: '22px' }} /></div>
          <h3>구독 신청</h3>
          <p className="modal-sub">선택하신 {selected.size}권이 담겼습니다.{selected.size < 4 && ` (나머지 ${4 - selected.size}권은 나중에 추가 선택 가능)`}</p>
          <div className="selected-books-preview">
            {Array.from(selected).map((idx) => books[idx] && (
              <div key={idx} className="preview-book" style={{ background: books[idx].bg }}>
                <img src={books[idx].img} alt={books[idx].title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
          <div className="plan-detail">
            <div className="plan-row"><span className="label">구독 플랜</span><span className="value">3개월권</span></div>
            <div className="plan-row"><span className="label">선택 도서</span><span className="value">{selected.size}권 (최대 4권)</span></div>
            <div className="plan-row"><span className="label">웰컴 굿즈</span><span className="value">무료 증정</span></div>
            <div className="plan-row"><span className="label">저자 강연권</span><span className="value">포함</span></div>
            <div className="plan-row total"><span className="label">합계</span><span className="value">45,000원</span></div>
          </div>

          {/* 배송/환불 안내 */}
          <div style={{ margin: '16px 0', padding: '14px 16px', background: '#f9fafb', borderRadius: '10px', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.7 }}>
            <p style={{ fontWeight: 600, color: '#374151', marginBottom: '6px' }}>📦 배송 안내</p>
            <p>• 결제 완료 후 영업일 기준 3~5일 이내 발송됩니다.</p>
            <p>• 웰컴 굿즈는 최초 1회 무료 배송됩니다.</p>
            <p style={{ fontWeight: 600, color: '#374151', marginTop: '10px', marginBottom: '6px' }}>↩️ 환불 안내</p>
            <p>• 결제일로부터 7일 이내 청약철회 시 전액 환불 가능</p>
            <p>• 도서/굿즈 발송 후에는 제공된 혜택 차감 후 환불</p>
            <p>• 환불 문의: hankbp@naver.com</p>
          </div>

          {/* 약관 동의 */}
          <div style={{ margin: '12px 0 16px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--accent)', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                <strong style={{ color: 'var(--text)' }}>[필수]</strong>{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); window.open('javascript:void(0)'); /* Footer의 약관 참조 */ }}>이용약관</span>,{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>개인정보처리방침</span>,{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>환불규정</span>에 동의합니다.
              </span>
            </label>
          </div>

          <button
            className="modal-btn"
            onClick={handlePayment}
            disabled={!agreeTerms}
            style={{ marginTop: '4px', opacity: agreeTerms ? 1 : 0.5, cursor: agreeTerms ? 'pointer' : 'not-allowed' }}
          >
            45,000원 결제하기
          </button>
          {!agreeTerms && <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#ef4444', marginTop: '8px' }}>약관에 동의해주세요.</p>}
        </div>
      </div>
    </div>
  );
}
