"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import SelectedBooksBar from '@/components/SelectedBooksBar';
import { useRouter, useSearchParams } from 'next/navigation';

function BooksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subOrderId = searchParams.get('subOrderId');
  const [books, setBooks] = useState<any[]>([]);
  const [cycleLabel, setCycleLabel] = useState<string>('로딩중...');
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  
  const [user, setUser] = useState<any>(null);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [isBeforeStart, setIsBeforeStart] = useState(false);
  const [isSelectionPeriod, setIsSelectionPeriod] = useState(false);
  const [isAfterEnd, setIsAfterEnd] = useState(false);
  const [hasSelectedBooks, setHasSelectedBooks] = useState(false);
  
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const scrollPosRef = useRef<number>(0);
  const MAX_SELECT = 4;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      loadData(session?.user?.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadData(session?.user?.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId: string | undefined) => {
    try {
      // 1. Determine cycle
      let cycle = null;
      let orderData = null;

      if (subOrderId) {
        // Find order and cycle
        const { data: oData } = await supabase
          .from('orders')
          .select('id, payment_status, cycle_id, cycles(*), book_orders(*, book_order_items(*))')
          .eq('id', subOrderId)
          .single();
        if (oData && oData.cycles) {
          orderData = oData;
          cycle = oData.cycles;
        }
      }

      if (!cycle) {
        // Fallback to active cycle
        const { data: cycles } = await supabase
          .from('cycles')
          .select('*')
          .eq('status', 'active')
          .order('start_date', { ascending: false })
          .limit(1);
        if (cycles && cycles.length > 0) {
          cycle = cycles[0];
        }
      }

      if (!cycle) {
        setCycleLabel('준비된 시즌이 없습니다.');
        setLoadingBooks(false);
        return;
      }
      setActiveCycle(cycle);
      setCycleLabel(cycle.name || cycle.label || cycle.id);

      // Check dates
      const now = new Date();
      const orderStart = new Date(cycle.book_order_start_date);
      const orderEnd = new Date(cycle.book_order_end_date);
      
      setIsBeforeStart(now < orderStart);
      setIsAfterEnd(now > orderEnd);
      setIsSelectionPeriod(now >= orderStart && now <= orderEnd);

      // Load books
      const { data: bData } = await supabase
        .from('books')
        .select('*')
        .eq('cycle_id', cycle.id)
        .eq('is_public', true)
        .eq('is_deleted', false)
        .order('order_idx', { ascending: true });

      if (bData) {
        const colors = [
          { bg: '#3b4b72', bgDark: '#121931' }, { bg: '#c0392b', bgDark: '#7b241c' },
          { bg: '#c9a000', bgDark: '#7a6000' }, { bg: '#2ecc40', bgDark: '#1a7a26' },
          { bg: '#171717', bgDark: '#000000' }, { bg: '#605856', bgDark: '#3b3433' },
        ];
        const formatted = bData.map((b: any, i: number) => {
          const c = colors[i % colors.length];
          return {
            id: b.id, title: b.title, author: b.author, genre: b.genre,
            bg: b.bg_color || c.bg, bgDark: b.bg_color_dark || c.bgDark,
            img: b.cover, tags: b.tags || [], desc: b.description,
            is_new: b.is_new || false,
            is_orderable: b.is_orderable
          };
        });
        setBooks(formatted);
      }

      // Check user order
      if (orderData) {
        setOrder(orderData);
        setIsSubscriber(orderData.payment_status === 'DONE');
        const activeBooksCount = (orderData.book_orders || [])
          .filter((bo: any) => bo.order_status !== '주문취소')
          .reduce((sum: number, bo: any) => sum + (bo.book_order_items?.length || 0), 0);
        if (activeBooksCount >= (cycle.max_book_count || 4)) {
          setHasSelectedBooks(true);
        }
      } else if (userId) {
        const { data: doneOrders } = await supabase
          .from('orders')
          .select('id, payment_status, cycle_id, book_orders(*, book_order_items(*))')
          .eq('user_id', userId)
          .eq('payment_status', 'DONE')
          .eq('cycle_id', cycle.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (doneOrders && doneOrders.length > 0) {
          const o = doneOrders[0];
          setOrder(o);
          setIsSubscriber(true);
          const activeBooksCount = (o.book_orders || [])
            .filter((bo: any) => bo.order_status !== '주문취소')
            .reduce((sum: number, bo: any) => sum + (bo.book_order_items?.length || 0), 0);
          if (activeBooksCount >= (cycle.max_book_count || 4)) {
            setHasSelectedBooks(true);
          }
        } else {
          setIsSubscriber(false);
          setOrder(null);
        }
      } else {
        setIsSubscriber(false);
        setOrder(null);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingBooks(false);
  };

  const toggleBook = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!isSubscriber) {
      alert('구독 결제 후 9월부터 도서를 신청할 수 있습니다.');
      return;
    }
    if (isBeforeStart) {
      alert('9월부터 웰컴키트가 발송되며, 도서 신청 순서에 따라 순차 배송됩니다.');
      return;
    }
    if (isAfterEnd) {
      alert('도서 신청 기간이 종료되었습니다.');
      return;
    }
    
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else {
        if (next.size >= MAX_SELECT) { alert(`최대 ${MAX_SELECT}권까지만 선택할 수 있습니다.`); return prev; }
        const b = books.find(x => x.id === id);
        if (b && b.is_orderable === false) {
           alert('이 도서는 현재 주문할 수 없습니다.');
           return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const openDetail = (id: string) => {
    scrollPosRef.current = window.scrollY;
    setDetailId(id); setIsDetailOpen(true);
    window.history.pushState({ bookDetail: true }, '');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setTimeout(() => { window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' }); }, 0);
  };

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

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    if (!agreeTerms) {
      alert('이용약관에 동의해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('로그인 세션이 만료되었습니다.');
        setSubmitting(false);
        return;
      }
      
      const res = await fetch('/api/books/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subOrderId: order.id, bookIds: Array.from(selectedIds) })
      });

      const data = await res.json();
      if (res.ok) {
        alert('도서 주문이 완료되었습니다.');
        router.push('/mypage');
      } else {
        alert(data.error || '도서 저장에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다.');
    }
    setSubmitting(false);
  };

  const activeBook = detailId !== null ? books.find(b => b.id === detailId) : null;
  const recommendedBook = books.length > 0 ? books[0] : null;
  const otherBooks = books.slice(1);

  const getBrightness = (hex: string) => {
    if (!hex) return 0;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const isLightBg = activeBook ? getBrightness(activeBook.bg) > 130 : false;
  const textColor = isLightBg ? '#121931' : '#ffffff';
  const descColor = isLightBg ? '#3b4b72' : 'rgba(255, 255, 255, 0.8)';
  const overlayColor = isLightBg ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';

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
        <div className="book-detail-view" style={{ paddingBottom: '120px' }}>
          <div className="dv-hero" style={{ display: 'flex', flexDirection: 'column', minHeight: 'auto', padding: '0', position: 'relative' }}>
            <div className="dv-hero-bg" style={{ background: `linear-gradient(110deg, ${activeBook.bgDark} 0%, ${activeBook.bg} 100%)` }}></div>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: overlayColor, zIndex: 0 }}></div>
            
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '32px 5vw 16px' }}>
              <button className="dv-back-white" onClick={closeDetail} style={{ color: textColor, borderColor: isLightBg ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)' }}>
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                도서 목록으로
              </button>
            </div>
            <div className="dv-hero-inner" style={{ padding: '16px 5vw 64px', position: 'relative', zIndex: 1 }}>
              <div className="dv-cover"><img src={activeBook.img} alt="" /></div>
              <div className="dv-meta">
                <p className="dv-genre" style={{ color: descColor, display: 'inline-block' }}>{activeBook.genre}</p>
                <h2 className="dv-title" style={{ color: textColor }}>{activeBook.title}</h2>
                <p className="dv-author" style={{ color: descColor }}>{activeBook.author}</p>
                <div className="dv-tags">
                  {activeBook.tags.map((t: string, i: number) => (
                    <span key={i} className="dv-tag" style={{ background: isLightBg ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)', color: textColor }}>
                      {t}
                    </span>
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
            </div>
            <div className="dv-sidebar">
              <div className="dv-sidebar-card">
                <div className="dv-sidebar-duplicate-info">
                  <div className="dv-sidebar-cover"><img src={activeBook.img} alt="" /></div>
                  <p className="dv-sidebar-genre">{activeBook.genre}</p>
                  <p className="dv-sidebar-title">{activeBook.title}</p>
                  <p className="dv-sidebar-author">{activeBook.author}</p>
                  <div className="dv-sidebar-divider"></div>
                </div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>구독 플랜에 포함</p>
                <div className="plan-row"><span className="l">도서 선택</span><span className="r">최대 4권</span></div>
                <div className="book-detail-mobile-action" style={{ bottom: selectedIds.size > 0 ? '100px' : '20px' }}>
                  <button className={`dv-add-btn ${selectedIds.has(activeBook.id) ? 'added' : ''}`} onClick={() => toggleBook(activeBook.id)}>
                    {selectedIds.has(activeBook.id) ? '✓ 담겼어요' : '+ 내 목록에 담기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 5vw 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '12px' }}>BOOK CURATION</p>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700, lineHeight: 1.3, marginBottom: '16px' }}>이번 시즌 도서를<br className="mobile-br" /> 골라보세요</h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: '0' }}>총 4권의 도서를 자유롭게 선택하실 수 있습니다.</p>
          </div>

          {loadingBooks ? (
            <div style={{ textAlign: 'center', padding: '100px 0', fontSize: '1.2rem', color: '#666' }}>도서 목록을 불러오는 중입니다...</div>
          ) : (
            <>
              {recommendedBook && (
                <div className="books-page-rec" style={{ marginBottom: '64px' }}>
                  <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '6px 16px', borderRadius: '30px', zIndex: 2, boxShadow: '0 4px 12px rgba(252,102,64,0.4)' }}>✨ 이번 기수 대표 도서</div>
                  <div style={{ display: 'flex', justifyContent: 'center', zIndex: 1 }}>
                    <div style={{ perspective: '1000px' }}>
                      <div style={{ width: '220px', borderRadius: '4px 12px 12px 4px', flexShrink: 0, position: 'relative', overflow: 'hidden', boxShadow: '-6px 8px 32px rgba(0,0,0,0.35)', cursor: 'pointer' }} onClick={() => openDetail(recommendedBook.id)}>
                        <img src={recommendedBook.img} alt={recommendedBook.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                        <div style={{ content: "''", position: 'absolute', left: 0, top: 0, bottom: 0, width: '12px', background: 'rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{recommendedBook.genre}</span>
                    <h3 style={{ fontFamily: 'var(--serif)', fontSize: '2.1rem', fontWeight: 700, marginBottom: '10px', color: '#fff', lineHeight: 1.3, cursor: 'pointer' }} onClick={() => openDetail(recommendedBook.id)}>{recommendedBook.title}</h3>
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
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 4px 15px rgba(252,102,64,0.4)' }} onClick={() => openDetail(recommendedBook.id)}>상세 보기</button>
                      <button onClick={(e) => toggleBook(recommendedBook.id, e)}
                        style={{ padding: '12px 28px', fontSize: '0.9rem', fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.7)', color: selectedIds.has(recommendedBook.id) ? 'var(--text)' : '#fff', background: selectedIds.has(recommendedBook.id) ? '#fff' : 'transparent', borderRadius: '100px', cursor: 'pointer', transition: 'all 0.2s' }}
                      >{selectedIds.has(recommendedBook.id) ? '✓ 담겼어요' : '+ 담기'}</button>
                    </div>
                  </div>
                </div>
              )}

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 700, textAlign: 'left', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                도서 큐레이션 풀
              </h3>
              <div className="book-grid" id="bookShelf" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '28px 20px', marginBottom: '40px' }}>
                {otherBooks.map((book) => (
                  <div key={book.id} className={`book-card ${selectedIds.has(book.id) ? 'selected' : ''}`}>
                    <div className="book-card-inner" style={{ position: 'relative' }}>
                      {book.is_new && <div style={{ position: 'absolute', top: '-8px', left: '-8px', width: '40px', height: '40px', background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, borderRadius: '50%', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.03em', boxShadow: '0 3px 10px rgba(231,76,60,0.5)', transform: 'rotate(-12deg)' }}>NEW</div>}
                      <div className="book-cover" style={{ cursor: 'pointer' }} onClick={() => openDetail(book.id)}>
                        <img src={book.img} alt={book.title} />
                      </div>
                      <button className={`book-select-btn ${selectedIds.has(book.id) ? 'added' : ''}`} onClick={(e) => toggleBook(book.id, e)}>
                        {selectedIds.has(book.id) ? '✓ 담겼어요' : '+ 담기'}
                      </button>
                    </div>
                    <p className="book-title" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', minHeight: 'auto', marginTop: '12px', marginBottom: '2px' }}>{book.title}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '6px' }}>{book.author}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Status Bar */}
      {!isSubscriber ? (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 'min(680px, calc(100% - 32px))', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>구독 완료 후 9월부터 도서를 신청할 수 있습니다.</span>
        </div>
      ) : hasSelectedBooks ? (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 'min(680px, calc(100% - 32px))', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>모든 도서 선택이 완료되었습니다.</span>
        </div>
      ) : isBeforeStart ? (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 'min(680px, calc(100% - 32px))', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ef4444' }}>9월부터 웰컴키트가 발송되며, 도서 신청 순서에 따라 순차 배송됩니다.</span>
        </div>
      ) : isAfterEnd ? (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 'min(680px, calc(100% - 32px))', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ef4444' }}>도서 신청 기간이 종료되었습니다.</span>
        </div>
      ) : (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 5vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
          <div>
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>선택한 도서</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', marginLeft: '8px' }}>{selectedIds.size}</span>
            <span style={{ color: '#6b7280' }}> / {MAX_SELECT}권</span>
          </div>
          <button 
            onClick={() => {
              if (selectedIds.size > 0) setIsSubmitOpen(true);
              else alert('도서를 1권 이상 선택해주세요.');
            }}
            disabled={selectedIds.size === 0}
            style={{ padding: '12px 32px', background: selectedIds.size > 0 ? 'var(--accent)' : '#d1d5db', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 700, cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed' }}
          >
            선택 완료
          </button>
        </div>
      )}

      {isSubmitOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '100%' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px' }}>도서 신청 확인</h2>
            <ul style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '24px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from(selectedIds).map(id => {
                const b = books.find(x => x.id === id);
                return <li key={id} style={{ fontWeight: 600 }}>• {b?.title}</li>;
              })}
            </ul>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '32px', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ marginTop: '4px', width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: 1.5 }}>
                선택한 {selectedIds.size}권의 도서를 주문합니다. 
                주문 완료 후에는 <strong>마이페이지에서 배송 상태를 확인</strong>할 수 있습니다. 동의하십니까?
              </span>
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setIsSubmitOpen(false)} style={{ flex: 1, padding: '14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
              <button onClick={handleSubmit} disabled={!agreeTerms || submitting} style={{ flex: 2, padding: '14px', background: (agreeTerms && !submitting) ? 'var(--accent)' : '#9ca3af', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: (agreeTerms && !submitting) ? 'pointer' : 'not-allowed' }}>
                {submitting ? '처리 중...' : '최종 주문하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BooksPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: '100px', textAlign: 'center' }}>로딩 중...</div>}>
      <BooksContent />
    </Suspense>
  );
}
