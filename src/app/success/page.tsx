"use client";
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  
  // 토스페이먼츠 SDK v2 파라미터
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId') || searchParams.get('merchant_uid');
  const amount = searchParams.get('amount') || '45000';
  const impSuccess = searchParams.get('imp_success');
  const errorMsg = searchParams.get('error_msg') || '결제에 실패하였습니다.';
  const [selectedBooks, setSelectedBooks] = useState<any[]>([]);

  useEffect(() => {
    // 아임포트 모바일 리다이렉트 결제 실패인 경우 실패 페이지로 이동 (하위호환)
    if (impSuccess === 'false') {
      window.location.href = `/fail?code=CANCEL&message=${encodeURIComponent(errorMsg)}`;
      return;
    }

    async function recordPayment() {
      if (!orderId) return;

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // 이미 기록했는지 확인
      if (user.user_metadata?.has_paid) return;

      // 선택한 책 정보 가져오기
      const savedSelection = sessionStorage.getItem('bookSelection');
      let books: any[] = [];
      if (savedSelection) {
        const indices = JSON.parse(savedSelection);
        // Fetch books from Supabase
        const { data: cycles } = await supabase.from('cycles').select('*').eq('status', 'active').limit(1);
        if (cycles && cycles.length > 0) {
          const activeCycle = cycles[0];
          const { data: booksData } = await supabase.from('books').select('*').eq('cycle_id', activeCycle.id);
          if (booksData) {
            books = indices.map((idx: number) => booksData[idx]).filter(Boolean);
            setSelectedBooks(books);
          }
        }
      }

      try {
        const response = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount,
            books,
            user,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // 세션 강제 갱신으로 클라이언트 메타데이터 동기화 (선택사항)
          await supabase.auth.refreshSession();
          
          alert('구독 결제가 완료되었습니다.\n구독 도서를 선택해주세요.');
          window.location.href = '/books';
        } else {
          console.error('결제 승인 실패:', data.error);
          const errorCode = data.code || 'CONFIRM_FAILED';
          const errorMessage = data.error || '결제 승인에 실패했습니다.';
          window.location.href = `/fail?code=${errorCode}&message=${encodeURIComponent(errorMessage)}`;
        }
      } catch (err) {
        console.error('서버 통신 오류:', err);
        window.location.href = `/fail?code=NETWORK_ERROR&message=${encodeURIComponent('서버와의 통신에 실패했습니다.')}`;
      }
    }

    recordPayment();
  }, [orderId, amount, impSuccess, errorMsg, paymentKey]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)', padding: '80px 20px 60px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        {/* 완료 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🎉</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>결제가 완료되었습니다!</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>한경 언더라인 독서클럽에 오신 것을 환영합니다.</p>
        </div>

        {/* 주문 요약 카드 */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>주문 정보</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.88rem' }}>
            <span style={{ color: '#6b7280' }}>주문번호</span>
            <span style={{ fontWeight: 600, color: '#111', fontFamily: 'monospace', fontSize: '0.82rem' }}>{orderId}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.88rem' }}>
            <span style={{ color: '#6b7280' }}>구독 플랜</span>
            <span style={{ fontWeight: 600, color: '#111' }}>3개월권</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280' }}>결제 금액</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.05rem' }}>{Number(amount).toLocaleString()}원</span>
          </div>
        </div>

        {/* 선택 도서 목록 */}
        {selectedBooks.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>선택 도서</p>
            {selectedBooks.map((book: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '10px 0', borderBottom: idx < selectedBooks.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ width: '44px', height: '60px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#f3f4f6' }}>
                  {book.cover && <img src={book.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111', marginBottom: '2px' }}>{book.title}</p>
                  <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{book.author}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 배송 안내 */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>📦 배송 안내</p>
          <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.8 }}>
            <p>• 영업일 기준 <strong>3~5일 이내</strong> 발송됩니다.</p>
            <p>• 웰컴 굿즈가 함께 배송됩니다.</p>
            <p>• 배송 상태는 <strong>마이페이지</strong>에서 확인 가능합니다.</p>
          </div>
        </div>

        {/* 고객센터 */}
        <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '20px 28px', marginBottom: '32px', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.8 }}>
          <p style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>문의 안내</p>
          <p>이메일: hankbp@naver.com</p>
          <p>전화: 02-360-4555</p>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link href="/mypage" style={{ padding: '14px 28px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: '100px', fontWeight: 600, fontSize: '0.92rem' }}>
            마이페이지
          </Link>
          <Link href="/" style={{ padding: '14px 28px', background: '#f3f4f6', color: '#374151', textDecoration: 'none', borderRadius: '100px', fontWeight: 600, fontSize: '0.92rem' }}>
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div style={{ padding: '100px', textAlign: 'center' }}>로딩중...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
