"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import DaumPostcodeEmbed from 'react-daum-postcode';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Auth Modal State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [zonecode, setZonecode] = useState('');
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const handleOpenLogin = (e: any) => {
      setIsLoginMode(e.detail?.mode !== 'signup');
      setIsLoginOpen(true);
    };
    window.addEventListener('open-login', handleOpenLogin);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('open-login', handleOpenLogin);
    };
  }, []);

  const handleAuth = async () => {
    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { alert('로그인 실패: ' + error.message); return; }
      alert('로그인 성공!');
      setIsLoginOpen(false);
      window.dispatchEvent(new CustomEvent('auth-success'));
    } else {
      if (!name || !phone || !address || !detailAddress) {
        alert('모든 정보를 입력해주세요.');
        return;
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            name, phone, has_paid: false,
            address: `[${zonecode}] ${address} ${detailAddress}`
          }
        }
      });
      if (error) {
        alert('회원가입 실패: ' + error.message);
        return;
      }
      alert('회원가입 성공!');
      setIsLoginOpen(false);
      window.dispatchEvent(new CustomEvent('auth-success'));
    }
  };

  return (
    <>
      <nav id="main-nav" className={scrolled ? 'scrolled' : ''}>
        <Link href="/" style={{ fontFamily: 'var(--serif)', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em', textDecoration: 'none', color: 'var(--text)' }}>
          <img src="/logo.png" alt="한경 석세스 클럽" style={{ height: '19px' }} />
        </Link>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link href="/events" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', textDecoration: 'none', fontWeight: 500 }}>이벤트</Link>
          <Link href="/archive" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', textDecoration: 'none', fontWeight: 500 }}>지난 도서</Link>
          {user ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Link href="/mypage" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', textDecoration: 'none', fontWeight: 500 }}>마이페이지</Link>
              <button style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '40px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => {
                supabase.auth.signOut();
                alert('로그아웃 되었습니다.');
              }}>로그아웃</button>
            </div>
          ) : (
            <button style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '40px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setIsLoginMode(true); setIsLoginOpen(true); }}>로그인/가입</button>
          )}
        </div>
      </nav>

      {/* LOGIN MODAL */}
      <div className={`modal-overlay ${isLoginOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsLoginOpen(false); }}>
        <div className="modal">
          <button className="modal-close" onClick={() => setIsLoginOpen(false)}>✕</button>
          <div className="modal-logo"><img src="/logo.png" alt="한경 석세스 클럽" className="brand-logo" /></div>
          <h3>{isLoginMode ? '로그인' : '회원가입'}</h3>
          <p className="modal-sub">배송을 위해 {isLoginMode ? '로그인이' : '회원가입이'} 필요합니다.</p>
          <div className="form-field">
            <label>이메일</label>
            <input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-field">
            <label>비밀번호</label>
            <input type="password" placeholder="비밀번호를 입력하세요" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {!isLoginMode && (
            <>
              <div className="form-field">
                <label>이름</label>
                <input type="text" placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-field">
                <label>연락처</label>
                <input type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="form-field">
                <label>배송지 주소</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" placeholder="우편번호" value={zonecode} readOnly style={{ flex: 1, backgroundColor: '#f5f5f5' }} />
                  <button type="button" onClick={() => setIsPostcodeOpen(true)} style={{ padding: '0 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>주소 찾기</button>
                </div>
                <input type="text" placeholder="기본 주소" value={address} readOnly style={{ marginBottom: '8px', backgroundColor: '#f5f5f5' }} />
                <input type="text" placeholder="상세 주소 (동, 호수 등)" value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} />
              </div>
            </>
          )}
          <button className="modal-btn" onClick={handleAuth}>{isLoginMode ? '로그인하기' : '가입하기'}</button>
          <p className="modal-divider">
            {isLoginMode ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
            <span className="modal-link" style={{ cursor: 'pointer' }} onClick={() => setIsLoginMode(!isLoginMode)}>
              {isLoginMode ? '회원가입' : '로그인'}
            </span>
          </p>
        </div>
      </div>

      {/* POSTCODE MODAL */}
      {isPostcodeOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }} onClick={(e) => { if (e.target === e.currentTarget) setIsPostcodeOpen(false); }}>
          <div className="modal" style={{ padding: '24px', width: 'min(400px, 90vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>주소 검색</h3>
              <button type="button" onClick={() => setIsPostcodeOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <DaumPostcodeEmbed 
              onComplete={(data) => {
                setZonecode(data.zonecode);
                setAddress(data.address);
                setIsPostcodeOpen(false);
              }} 
            />
          </div>
        </div>
      )}
    </>
  );
}
