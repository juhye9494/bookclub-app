export const dynamic = 'force-dynamic';

import React from 'react';
import LoginButton from './LoginButton';

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; status?: string }>;
}) {
  const params = await searchParams;
  const tokenHash = params?.token_hash;
  const status = params?.status;

  let content;

  if (status === 'success') {
    content = (
      <>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#1a1815' }}>이메일 인증이 완료되었습니다</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>가입한 이메일과 비밀번호로 로그인해 주세요.</p>
        <LoginButton />
      </>
    );
  } else if (status === 'error') {
    content = (
      <>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#1a1815' }}>이메일 인증을 완료하지 못했습니다</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>인증 링크가 만료되었거나 이미 사용된 링크일 수 있습니다.</p>
        <a href="/" style={{ display: 'inline-block', padding: '12px 24px', background: '#333', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 600, width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
          홈으로 이동
        </a>
      </>
    );
  } else if (tokenHash) {
    content = (
      <>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#1a1815' }}>이메일 인증</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>아래 버튼을 누르면 이메일 인증이 완료됩니다.</p>
        <form method="POST" action="/api/auth/confirm">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <button type="submit" style={{ padding: '12px 24px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            이메일 인증 완료하기
          </button>
        </form>
      </>
    );
  } else {
    content = (
      <>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#1a1815' }}>이메일 인증을 완료하지 못했습니다</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>인증 링크가 만료되었거나 이미 사용된 링크일 수 있습니다.</p>
        <a href="/" style={{ display: 'inline-block', padding: '12px 24px', background: '#333', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 600, width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
          홈으로 이동
        </a>
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f0eb', padding: '20px' }}>
      <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '400px', width: '100%' }}>
        {content}
      </div>
    </div>
  );
}
