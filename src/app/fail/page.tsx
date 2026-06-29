"use client";
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function FailContent() {
  const searchParams = useSearchParams();
  // 토스페이먼츠 SDK v2 실패 파라미터
  const code = searchParams.get('code') || searchParams.get('errorCode');
  const message = searchParams.get('message') || searchParams.get('errorMessage') || '결제에 실패하였습니다.';
  const orderId = searchParams.get('orderId');

  return (
    <div style={{ padding: '100px 20px', textAlign: 'center', fontFamily: 'var(--sans)' }}>
      <h1 style={{ color: '#d9534f', fontSize: '2rem', marginBottom: '16px' }}>❌ 결제에 실패했습니다</h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--text-mid)', marginBottom: '40px' }}>
        에러 메시지: {message}<br/>
        에러 코드: {code}
        {orderId && <><br/>주문번호: {orderId}</>}
      </p>
      <Link href="/books" style={{ padding: '14px 28px', background: '#333', color: '#fff', textDecoration: 'none', borderRadius: '40px', fontWeight: 600 }}>
        다시 시도하기
      </Link>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '100px', textAlign: 'center' }}>로딩중...</div>}>
      <FailContent />
    </Suspense>
  );
}
