"use client";
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useEffect } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  
  // 토스페이먼츠 SDK v2 파라미터
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId') || searchParams.get('merchant_uid');
  const amount = searchParams.get('amount') || '45000';
  
  // 아임포트 하위호환
  const impSuccess = searchParams.get('imp_success');
  const errorMsg = searchParams.get('error_msg') || '결제에 실패하였습니다.';

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
      let selectedBooks: any[] = [];
      if (savedSelection) {
        const indices = JSON.parse(savedSelection);
        // Fetch books from Supabase
        const { data: cycles } = await supabase.from('cycles').select('*').eq('status', 'active').limit(1);
        if (cycles && cycles.length > 0) {
          const activeCycle = cycles[0];
          const { data: booksData } = await supabase.from('books').select('*').eq('cycle_id', activeCycle.id);
          if (booksData) {
            selectedBooks = indices.map((idx: number) => booksData[idx]);
          }
        }
      }

      // DB에 주문 정보 저장
      await supabase.from('orders').insert([{
        user_id: user.id,
        user_email: user.email,
        user_name: user.user_metadata?.name || 'Unknown',
        user_phone: user.user_metadata?.phone || 'Unknown',
        user_address: user.user_metadata?.address || 'Unknown',
        selected_books: selectedBooks,
        total_amount: Number(amount) || 45000,
        payment_order_id: orderId,
        payment_key: paymentKey || null,
      }]);

      // 사용자 메타데이터 업데이트
      await supabase.auth.updateUser({ data: { has_paid: true } });
    }

    recordPayment();
  }, [orderId, amount, impSuccess, errorMsg, paymentKey]);

  return (
    <div style={{ padding: '100px 20px', textAlign: 'center', fontFamily: 'var(--sans)' }}>
      <h1 style={{ color: 'var(--accent)', fontSize: '2rem', marginBottom: '16px' }}>🎉 결제가 완료되었습니다!</h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--text-mid)', marginBottom: '40px' }}>
        주문번호: {orderId}<br/>
        결제금액: {Number(amount).toLocaleString()}원
        {paymentKey && <><br/>결제키: {paymentKey}</>}
      </p>
      <Link href="/" style={{ padding: '14px 28px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: '40px', fontWeight: 600 }}>
        홈으로 돌아가기
      </Link>
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
