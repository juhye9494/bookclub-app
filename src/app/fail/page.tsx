"use client";
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');

  return (
    <div style={{ padding: '100px 20px', textAlign: 'center', fontFamily: 'var(--sans)' }}>
      <h1 style={{ color: '#d9534f', fontSize: '2rem', marginBottom: '16px' }}>❌ 결제에 실패했습니다</h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--text-mid)', marginBottom: '40px' }}>
        에러 메시지: {message}<br/>
        에러 코드: {code}
      </p>
      <Link href="/" style={{ padding: '14px 28px', background: '#333', color: '#fff', textDecoration: 'none', borderRadius: '40px', fontWeight: 600 }}>
        홈으로 돌아가기
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
