"use client";
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useEffect } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');

  useEffect(() => {
    if (orderId) {
      supabase.auth.updateUser({ data: { has_paid: true } });
    }
  }, [orderId]);

  return (
    <div style={{ padding: '100px 20px', textAlign: 'center', fontFamily: 'var(--sans)' }}>
      <h1 style={{ color: 'var(--accent)', fontSize: '2rem', marginBottom: '16px' }}>🎉 결제가 완료되었습니다!</h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--text-mid)', marginBottom: '40px' }}>
        주문번호: {orderId}<br/>
        결제금액: {Number(amount).toLocaleString()}원
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
