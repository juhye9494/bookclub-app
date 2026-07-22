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
  const [isConfirming, setIsConfirming] = useState(true);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    // 아임포트 모바일 리다이렉트 결제 실패인 경우 실패 페이지로 이동 (하위호환)
    if (impSuccess === 'false') {
      window.location.href = `/fail?code=CANCEL&message=${encodeURIComponent(errorMsg)}`;
      return;
    }

    async function recordPayment() {
      if (!orderId) {
        setConfirmError('주문 번호가 누락되었습니다.');
        setIsConfirming(false);
        return;
      }
      
      console.log('[SUCCESS_PAGE] 결제 승인 프로세스 시작. orderId:', orderId);

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        console.warn('[SUCCESS_PAGE] 로그인 세션이 없습니다. 결제 승인을 중단합니다.');
        setConfirmError('로그인 세션이 만료되었습니다. 다시 로그인 후 시도해주세요.');
        setIsConfirming(false);
        return;
      }

      console.log('[SUCCESS_PAGE] 로그인 유저 확인 완료.');

      // 이미 기록했는지 확인
      if (user.user_metadata?.has_paid) {
        console.log('[SUCCESS_PAGE] 이미 유효한 구독자입니다. 마이페이지로 이동합니다.');
        window.location.href = '/mypage';
        return;
      }

      // 선택한 책 정보 가져오기
      const savedSelection = sessionStorage.getItem('bookSelection');
      let books: any[] = [];
      if (savedSelection) {
        const indices = JSON.parse(savedSelection);
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
        console.log('[SUCCESS_PAGE] 서버 Confirm API 호출 시도...');
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
          console.log('[SUCCESS_PAGE] 서버 Confirm API 성공. 세션 갱신 및 마이페이지 이동');
          // 세션 강제 갱신으로 클라이언트 메타데이터 동기화
          await supabase.auth.refreshSession();
          
          alert('결제 및 구독이 완료되었습니다.');
          window.location.href = '/mypage';
        } else {
          console.error('[SUCCESS_PAGE] 결제 승인 실패:', data.error);
          setConfirmError(data.error || '결제 승인에 실패했습니다.');
          setIsConfirming(false);
        }
      } catch (err) {
        console.error('[SUCCESS_PAGE] 서버 통신 오류:', err);
        setConfirmError('서버와의 통신에 실패했습니다.');
        setIsConfirming(false);
      }
    }

    recordPayment();
  }, [orderId, amount, impSuccess, errorMsg, paymentKey]);

  if (isConfirming) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)', padding: '80px 20px 60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>결제 승인 중입니다...</h2>
          <p style={{ color: 'var(--text-muted)' }}>잠시만 기다려주세요. 창을 닫지 마세요.</p>
        </div>
      </div>
    );
  }

  if (confirmError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)', padding: '80px 20px 60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#dc2626', marginBottom: '12px' }}>결제 승인 실패</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{confirmError}</p>
          <Link href="/books" style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', borderRadius: '100px', textDecoration: 'none', fontWeight: 600 }}>
            다시 시도하기
          </Link>
        </div>
      </div>
    );
  }

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
