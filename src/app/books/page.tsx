"use client";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function BooksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subOrderId = searchParams.get('subOrderId');

  const [books, setBooks] = useState<any[]>([]);
  const [cycleName, setCycleName] = useState<string>('로딩중...');
  const [maxBooks, setMaxBooks] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailBook, setDetailBook] = useState<any>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadData(session.user.id);
    });
  }, [subOrderId]);

  const loadData = async (userId: string) => {
    if (!subOrderId) {
      setErrorMsg('구독 주문 번호가 필요합니다. 마이페이지에서 다시 접근해주세요.');
      setLoading(false);
      return;
    }

    try {
      // 1. 주문 확인
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('cycle_id, payment_status, user_id')
        .eq('id', subOrderId)
        .single();

      if (orderErr || !order) {
        setErrorMsg('주문 정보를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      if (order.user_id !== userId) {
        setErrorMsg('본인의 주문만 조회할 수 있습니다.');
        setLoading(false);
        return;
      }

      if (order.payment_status !== 'DONE') {
        setErrorMsg('결제가 완료되지 않은 주문입니다.');
        setLoading(false);
        return;
      }

      // 2. 기수 확인
      const { data: cycle, error: cycleErr } = await supabase
        .from('cycles')
        .select('*')
        .eq('id', order.cycle_id)
        .single();

      if (cycleErr || !cycle) {
        setErrorMsg('기수 정보를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      setCycleName(cycle.name);
      setMaxBooks(cycle.max_book_count || 4);

      const now = new Date();
      const orderStart = new Date(cycle.book_order_start_date);
      const orderEnd = new Date(cycle.book_order_end_date);

      if (now < orderStart || now > orderEnd) {
        setErrorMsg(`${cycle.name} 도서 주문은 ${orderEnd.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}까지 가능합니다.`);
        setLoading(false);
        return;
      }

      // 3. 도서 목록 불러오기
      const { data: booksData, error: booksErr } = await supabase
        .from('books')
        .select('*')
        .eq('cycle_id', order.cycle_id)
        .eq('is_public', true)
        .eq('is_deleted', false)
        .order('order_idx', { ascending: true });

      if (booksData) setBooks(booksData);
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg('데이터를 불러오는데 실패했습니다.');
    }
    setLoading(false);
  };

  const toggleBook = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= maxBooks) {
        alert(`최대 ${maxBooks}권까지만 선택할 수 있습니다.`);
        return;
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      alert('도서를 1권 이상 선택해주세요.');
      return;
    }
    if (!agreeTerms) {
      alert('필수 약관에 동의해주세요.');
      return;
    }
    
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('로그인 세션이 만료되었습니다.');
        setSubmitting(false);
        return;
      }
      const res = await fetch('/api/books/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ subOrderId, bookIds: Array.from(selectedIds) })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '주문에 실패했습니다.');
      } else {
        alert('도서 주문이 완료되었습니다.');
        router.push('/mypage');
      }
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
    setSubmitting(false);
  };

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>데이터를 불러오는 중...</div>;

  if (errorMsg) return (
    <div style={{ padding: '120px 20px', textAlign: 'center', minHeight: '60vh' }}>
      <h2 style={{ fontSize: '1.25rem', color: '#dc2626', marginBottom: '20px' }}>{errorMsg}</h2>
      <button onClick={() => router.push('/mypage')} style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>마이페이지로 돌아가기</button>
    </div>
  );

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', paddingTop: '64px', paddingBottom: '120px' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 5vw' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2.5rem', fontWeight: 700, marginBottom: '16px' }}>{cycleName} 도서 주문</h1>
        <p style={{ color: '#4b5563', marginBottom: '40px' }}>원하시는 도서를 선택해주세요. (최대 {maxBooks}권)</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {books.map(book => (
            <div 
              key={book.id} 
              style={{ 
                background: '#fff', borderRadius: '16px', overflow: 'hidden', border: selectedIds.has(book.id) ? '2px solid var(--accent)' : '2px solid transparent',
                boxShadow: selectedIds.has(book.id) ? '0 0 0 4px rgba(45, 96, 255, 0.1)' : '0 4px 12px rgba(0,0,0,0.05)',
                transition: 'all 0.2s', cursor: book.is_orderable ? 'pointer' : 'not-allowed', position: 'relative'
              }}
              onClick={() => {
                if (book.is_orderable) toggleBook(book.id);
              }}
            >
              {!book.is_orderable && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ background: '#000', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontWeight: 600 }}>주문 마감</span>
                </div>
              )}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(book.tags || []).map((t: string) => <span key={t} style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#4b5563' }}>#{t}</span>)}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', lineHeight: 1.4 }}>{book.title}</h3>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '16px' }}>{book.author}</div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDetailBook(book); setIsDetailOpen(true); }}
                  style={{ marginTop: 'auto', alignSelf: 'flex-start', background: 'none', border: '1px solid #d1d5db', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  상세보기
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 바텀 바 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 5vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
        <div>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>선택한 도서</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', marginLeft: '8px' }}>{selectedIds.size}</span>
          <span style={{ color: '#6b7280' }}> / {maxBooks}권</span>
        </div>
        <button 
          onClick={() => {
            if (selectedIds.size > 0) setIsSubmitOpen(true);
            else alert('도서를 1권 이상 선택해주세요.');
          }}
          disabled={selectedIds.size === 0}
          style={{ padding: '12px 32px', background: selectedIds.size > 0 ? 'var(--accent)' : '#d1d5db', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 700, cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed' }}
        >
          주문하기
        </button>
      </div>

      {isSubmitOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '100%' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px' }}>도서 주문 확인</h2>
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

      {isDetailOpen && detailBook && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{detailBook.title}</h2>
              <button onClick={() => setIsDetailOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ color: '#6b7280', marginBottom: '24px' }}>{detailBook.author}</div>
            <div style={{ lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-wrap' }}>{detailBook.description}</div>
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
