"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase는 리다이렉트 URL의 해시에 토큰을 포함시킴
  // 페이지 로드 시 자동으로 세션이 설정됨

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      alert('비밀번호 변경 실패: ' + error.message);
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--sans)' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>비밀번호가 변경되었습니다</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>새 비밀번호로 로그인해주세요.</p>
          <Link href="/" style={{
            display: 'inline-block', padding: '14px 40px', background: 'var(--accent)', color: '#fff',
            borderRadius: '100px', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem'
          }}>홈으로 이동</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--sans)' }}>
      <div style={{ width: 'min(420px, 90vw)', background: '#fff', borderRadius: '20px', padding: '48px 36px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/uploads/underline_logo.svg" alt="한경 언더라인 독서클럽" style={{ height: '24px' }} />
        </div>
        <h2 style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>새 비밀번호 설정</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '32px' }}>새로 사용할 비밀번호를 입력해주세요.</p>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>새 비밀번호</label>
          <input
            type="password"
            placeholder="6자 이상 입력"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>비밀번호 확인</label>
          <input
            type="password"
            placeholder="비밀번호를 다시 입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button
          onClick={handleReset}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: '100px', fontSize: '0.95rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, fontFamily: 'var(--sans)'
          }}
        >
          {loading ? '변경 중...' : '비밀번호 변경하기'}
        </button>
      </div>
    </div>
  );
}
