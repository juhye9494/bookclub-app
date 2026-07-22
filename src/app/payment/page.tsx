"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function PaymentPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 선택한 책 정보 가져오기
    async function loadSelectedBooks() {
      const saved = sessionStorage.getItem('bookSelection');
      if (saved) {
        const indices = JSON.parse(saved);
        const { data: cycles } = await supabase.from('cycles').select('*').eq('status', 'active').limit(1);
        if (cycles && cycles.length > 0) {
          const { data: booksData } = await supabase.from('books').select('*').eq('cycle_id', cycles[0].id);
          if (booksData) {
            const sortedBooks = [...booksData].sort((a: any, b: any) => (a.order_idx || 0) - (b.order_idx || 0));
            const selected = indices.map((idx: number) => sortedBooks[idx]).filter(Boolean);
            setSelectedBooks(selected);
          }
        }
      }
    }
    loadSelectedBooks();
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_oEjb0gm23P55WYjKGQpnVpGwBJn5';
      
      if (typeof (window as any).TossPayments === 'undefined') {
        alert('결제 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      
      const tossPayments = await (window as any).TossPayments(clientKey);
      
      // 1. 서버에 주문 초기화 (PENDING) 및 고유 orderId 발급 요청
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const initRes = await fetch('/api/payments/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ books: selectedBooks }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.orderId) {
        alert('주문 생성에 실패했습니다. 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      
      const payment = tossPayments.payment({ customerKey: user?.id || 'ANONYMOUS' });
      
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: initData.amount },
        orderId: initData.orderId,
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
        setLoading(false);
        return;
      }
      console.error(err);
      alert('결제창을 띄우는 데 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)', 
      paddingTop: '64px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start'
    }}>
      <div style={{ 
        width: '100%', maxWidth: '560px', margin: '48px auto', padding: '48px 36px',
        background: '#fff', borderRadius: '24px', 
        boxShadow: '0 4px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)',
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
            marginBottom: '20px', boxShadow: '0 4px 12px rgba(252,102,64,0.3)'
          }}>
            <span style={{ fontSize: '1.6rem' }}>📚</span>
          </div>
          <h1 style={{ 
            fontFamily: 'var(--serif)', fontSize: '1.6rem', fontWeight: 700, 
            marginBottom: '8px', color: 'var(--text)' 
          }}>
            구독 결제
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            한경 언더라인 독서클럽 3개월 구독권
          </p>
        </div>

        {/* 선택한 도서 */}
        {selectedBooks.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '12px' }}>
              선택하신 도서 ({selectedBooks.length}권)
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {selectedBooks.map((book, i) => (
                <div key={i} style={{
                  width: '80px', height: '110px', borderRadius: '6px', overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  <img src={book.cover} alt={book.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 결제 정보 */}
        <div style={{ 
          background: 'var(--bg-warm)', borderRadius: '16px', padding: '24px', marginBottom: '28px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-mid)' }}>구독 플랜</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>3개월권</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-mid)' }}>도서 3권</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>포함</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-mid)' }}>웰컴 굿즈</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>무료 증정</span>
          </div>

          <div style={{ 
            borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
          }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>합계</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>45,000원</span>
          </div>
        </div>

        {/* 결제 버튼 */}
        <button 
          onClick={handlePayment} 
          disabled={loading}
          style={{
            width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
            background: loading 
              ? '#ccc' 
              : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
            color: '#fff', fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--sans)',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(252,102,64,0.4)',
            transition: 'all 0.3s ease',
            marginBottom: '16px',
          }}
        >
          {loading ? '결제 처리중...' : '45,000원 결제하기'}
        </button>

        {/* 안내 텍스트 */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '12px' }}>
            결제 시 <Link href="/terms" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>이용약관</Link> 및{' '}
            <Link href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>개인정보처리방침</Link>에 동의하게 됩니다.
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            결제는 토스페이먼츠를 통해 안전하게 처리됩니다.
          </p>
        </div>

        {/* 토스페이먼츠 로고 */}
        <div style={{ 
          textAlign: 'center', marginTop: '24px', paddingTop: '20px', 
          borderTop: '1px solid var(--border)' 
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Powered by 토스페이먼츠
          </span>
        </div>
      </div>
    </div>
  );
}
