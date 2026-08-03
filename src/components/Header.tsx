"use client";
import { getAuthErrorMessage } from "@/utils/authErrorMessage";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import DaumPostcodeEmbed from 'react-daum-postcode';

const AUTH_METADATA_CLEANUP_KEY = 'auth_metadata_cleanup_2026_08_v1';

let authMetadataRefreshInProgress = false;
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

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
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
const [changingPw, setChangingPw] = useState(false);
const [passwordResetSent, setPasswordResetSent] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);

      if (
        session &&
        localStorage.getItem(AUTH_METADATA_CLEANUP_KEY) !== 'done' &&
        !authMetadataRefreshInProgress
      ) {
        authMetadataRefreshInProgress = true;

        window.setTimeout(() => {
          void (async () => {
            try {
              const {
                data: refreshData,
                error: refreshError,
              } = await supabase.auth.refreshSession();

              if (refreshError || !refreshData.session) {
                console.warn('[Auth] One-time session refresh failed');
                return;
              }

              setUser(refreshData.session.user);
              localStorage.setItem(AUTH_METADATA_CLEANUP_KEY, 'done');
            } catch {
              console.warn('[Auth] One-time session refresh failed');
            } finally {
              authMetadataRefreshInProgress = false;
            }
          })();
        }, 0);
      }
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
      if (error) {
        alert(getAuthErrorMessage(error));
        return;
      }
      alert('로그인 성공!');
      setIsLoginOpen(false);
      window.dispatchEvent(new CustomEvent('auth-success'));
      router.replace('/');
      router.refresh();
    } else {
      if (!name || !phone || !address || !detailAddress) {
        alert('모든 정보를 입력해주세요.');
        return;
      }
      const profileSetupToken = crypto.randomUUID();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            profile_setup_token: profileSetupToken
          }
        }
      });
      if (error) {
        alert(getAuthErrorMessage(error));
        return;
      }
      if (!data.user) {
        alert('회원가입 정보를 확인하지 못했습니다. 다시 시도해주세요.');
        return;
      }
      try {
        const res = await fetch('/api/auth/finalize-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: data.user.id,
            profileSetupToken,
            name,
            phone,
            address: `[${zonecode}] ${address} ${detailAddress}`.trim()
          })
        });
        if (!res.ok) {
          alert('회원가입 처리가 완전히 끝나지 않았습니다. 다시 시도해주세요.');
          return;
        }
      } catch (e) {
        console.error('Finalize profile error:', e);
        alert('회원가입 처리가 완전히 끝나지 않았습니다. 다시 시도해주세요.');
        return;
      }
      if (data.user && !data.user.confirmed_at) {
        setVerificationEmail(email);
        setIsLoginOpen(false);
        setEmailVerificationSent(true);
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
        setAddress('');
        setDetailAddress('');
        setZonecode('');
      } else {
        alert('회원가입 성공!');
        setIsLoginOpen(false);
        window.dispatchEvent(new CustomEvent('auth-success'));
      }
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      alert('이메일을 입력해주세요.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`
    });
    if (error) {
      alert(getAuthErrorMessage(error));
      return;
    }
    alert('비밀번호 재설정 링크가 이메일로 발송되었습니다.\\n이메일을 확인해주세요.');
    setIsResetMode(false);
    setResetEmail('');
  };

  const handleLogout = async (event?: React.MouseEvent) => {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error);
    alert(getAuthErrorMessage(error));
    return;
  }
  // Clear user state immediately
  setUser(null);
  // Removed localStorage.clear() to preserve non-auth data like bookclub_groups, selections, etc.
  alert('로그아웃 되었습니다.');
  router.replace('/');
  router.refresh();
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
  setMobileMenuOpen(false);
};
  const handlePasswordChange = async () => {
    if (!user?.email) {
      alert('이메일 정보를 확인할 수 없습니다.');
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + '/mypage?tab=profile',
    });
    setChangingPw(false);
    if (error) {
      alert(getAuthErrorMessage(error));
      return;
    }
    setPasswordResetSent(true);
    alert('✉️ 비밀번호 재설정 링크가 이메일로 발송되었습니다.\\n이메일을 확인해주세요.');
  };

  return (
    <>
      <style>{`\
        .nav-link {\
          font-size: 0.85rem;\
          color: var(--text-mid);\
          text-decoration: none;\
          font-weight: 500;\
          transition: color 0.2s, transform 0.15s;\
          position: relative;\
          padding: 4px 0;\
        }\
        .nav-link:hover {\
          color: var(--accent);\
          transform: translateY(-1px);\
        }\
        .nav-link::after {\
          content: '';\
          position: absolute;\
          bottom: -2px;\
          left: 0;\
          width: 0;\
          height: 2px;\
          background: var(--accent);\
          transition: width 0.25s ease;\
        }\
        .nav-link:hover::after {\
          width: 100%;\
        }\
        .nav-btn-logout {\
          background: #333; color: #fff; border: none; padding: 8px 16px;\
          border-radius: 40px; font-size: 0.8rem; cursor: pointer;\
          transition: background 0.2s, transform 0.15s;\
        }\
        .nav-btn-logout:hover {\
          background: var(--accent); transform: translateY(-1px);\
        }\
          .login-modal-btn {\n            background: var(--accent); color: #fff; border: none; padding: 8px 16px;\n            border-radius: 40px; font-size: 0.8rem; font-weight: 600; cursor: pointer;\n            transition: background 0.2s, transform 0.15s;\n          }\n          .login-modal-btn:hover {\n            background: var(--accent-dark); transform: translateY(-1px);\n          }\
        .hamburger-btn { display: none; background: none; border: none; cursor: pointer; padding: 4px; z-index: 1001; }\
        .hamburger-btn span { display: block; width: 22px; height: 2px; background: var(--text-dark, #222); border-radius: 2px; transition: transform 0.3s ease, opacity 0.3s ease; margin: 5px 0; }\
        .hamburger-btn.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }\
        .hamburger-btn.active span:nth-child(2) { opacity: 0; }\
        .hamburger-btn.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }\
        .nav-links-desktop { display: flex; gap: 24px; align-items: center; }\
        .mobile-menu-overlay { display: none; }\
        @media (max-width: 768px) {\
          .hamburger-btn { display: block; }\
          .nav-links-desktop { display: none; }\
          .mobile-menu-overlay { display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 999; opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease; }\
          .mobile-menu-overlay.open { opacity: 1; visibility: visible; }\
          .mobile-nav-dropdown { position: fixed; top: 0; right: 0; width: min(280px, 80vw); height: 100vh; background: #fff; z-index: 1000; padding: 80px 24px 32px; display: flex; flex-direction: column; gap: 8px; transform: translateX(100%); transition: transform 0.3s ease; box-shadow: -4px 0 20px rgba(0,0,0,0.1); overflow-y: auto; }\
          .mobile-nav-dropdown.open { transform: translateX(0); }\
          .mobile-nav-dropdown .nav-link { font-size: 1rem; padding: 12px 0; border-bottom: 1px solid #f0f0f0; display: block; }\
          .mobile-nav-dropdown .nav-link::after { display: none; }\
          .mobile-nav-dropdown .mobile-auth-area { margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 12px; }\
          .mobile-nav-dropdown .nav-btn-login, .mobile-nav-dropdown .nav-btn-logout { width: 100%; padding: 12px 16px; font-size: 0.9rem; text-align: center; }\
        }\
      `}</style>
      <nav id="main-nav" className={scrolled ? 'scrolled' : ''}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src="/uploads/underline_logo.svg" alt="한경 언더라인 독서클럽" style={{ height: '22px', display: 'block' }} />
        </Link>
        <div className="nav-links-desktop">
          <Link href="/books" className="nav-link" onClick={() => window.dispatchEvent(new Event('close-book-detail'))}>도서 선택</Link>
          <Link href="/insight" className="nav-link">플러스 인사이트</Link>
          <Link href="/groups" className="nav-link">독서모임</Link>
          <Link href="/events" className="nav-link">이벤트</Link>
          {user ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Link href="/mypage" className="nav-link">마이페이지</Link>
              <button className="nav-btn-logout" onClick={handleLogout}>로그아웃</button>
            </div>
          ) : (
            <button className="login-modal-btn" onClick={() => { setIsLoginMode(true); setIsLoginOpen(true); }}>로그인/가입</button>
          )}
        </div>
        <button className={`hamburger-btn${mobileMenuOpen ? ' active' : ''}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="메뉴 열기">
          <span /><span /><span />
        </button>
      </nav>
      <div className={`mobile-menu-overlay${mobileMenuOpen ? ' open' : ''}`} onClick={() => setMobileMenuOpen(false)} />
      <div className={`mobile-nav-dropdown${mobileMenuOpen ? ' open' : ''}`}>
        <Link href="/books" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.dispatchEvent(new Event('close-book-detail')); }}>도서 선택</Link>
        <Link href="/insight" className="nav-link" onClick={() => setMobileMenuOpen(false)}>플러스 인사이트</Link>
        <Link href="/groups" className="nav-link" onClick={() => setMobileMenuOpen(false)}>독서모임</Link>
        <Link href="/events" className="nav-link" onClick={() => setMobileMenuOpen(false)}>이벤트</Link>
        <div className="mobile-auth-area">
          {user ? (
            <>\
              <Link href="/mypage" className="nav-link" onClick={() => setMobileMenuOpen(false)}>마이페이지</Link>
              <button className="nav-btn-logout" onClick={handleLogout}>로그아웃</button>\
            </>
          ) : (
            <button className="nav-btn-login" onClick={() => { setIsLoginMode(true); setIsLoginOpen(true); setMobileMenuOpen(false); }}>로그인/가입</button>
          )}
        </div>
      </div>

      {/* LOGIN MODAL */}
      <div className={`modal-overlay ${isLoginOpen ? 'open' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) setIsLoginOpen(false); }}>
        <div className="modal">
          <button className="modal-close" onClick={() => setIsLoginOpen(false)}>✕</button>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}><img src="/uploads/underline_logo.svg" alt="한경 언더라인 독서클럽" style={{ height: '24px' }} /></div>
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
            <>\
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
                  <input placeholder="우편번호" value={zonecode} readOnly style={{ flex: 1, backgroundColor: '#f5f5f5' }} />
                  <button type="button" onClick={() => setIsPostcodeOpen(true)} style={{ padding: '0 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>주소 찾기</button>
                </div>
                <input placeholder="기본 주소" value={address} readOnly style={{ marginBottom: '8px', backgroundColor: '#f5f5f5' }} />
                <input placeholder="상세 주소 (동, 호수 등)" value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} />
              </div>
            </>
          )}
          <button className="modal-btn" onClick={handleAuth}>{isLoginMode ? '로그인하기' : '가입하기'}</button>
          {isLoginMode && (
            <p style={{ textAlign: 'center', margin: '12px 0 0', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setIsResetMode(true); setResetEmail(email); }}>비밀번호를 잊으셨나요?</span>
            </p>
          )}
          <p className="modal-divider">
            {isLoginMode ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
            <span className="modal-link" style={{ cursor: 'pointer' }} onClick={() => setIsLoginMode(!isLoginMode)}>
              {isLoginMode ? '회원가입' : '로그인'}
            </span>
          </p>
        </div>
      </div>

      {/* PASSWORD RESET MODAL */}
      <div className={`modal-overlay ${isResetMode ? 'open' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) setIsResetMode(false); }}>
        <div className="modal">
          <button className="modal-close" onClick={() => setIsResetMode(false)}>✕</button>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}><img src="/uploads/underline_logo.svg" alt="한경 언더라인 독서클럽" style={{ height: '24px' }} /></div>
          <h3>비밀번호 재설정</h3>
          <p className="modal-sub">가입 시 사용한 이메일을 입력하시면<br/>비밀번호 재설정 링크를 보내드립니다.</p>
          <div className="form-field">
            <label>이메일</label>
            <input type="email" placeholder="example@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
          </div>
          <button className="modal-btn" onClick={handleResetPassword}>재설정 링크 발송</button>
          <p className="modal-divider">
            <span className="modal-link" style={{ cursor: 'pointer' }} onClick={() => { setIsResetMode(false); setIsLoginOpen(true); setIsLoginMode(true); }}>로그인으로 돌아가기</span>
          </p>
        </div>
      </div>

      {/* EMAIL VERIFICATION MODAL */}
      <div className={`modal-overlay ${emailVerificationSent ? 'open' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) setEmailVerificationSent(false); }}>
        <div className="modal">
          <button className="modal-close" onClick={() => setEmailVerificationSent(false)}>✕</button>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}><img src="/uploads/underline_logo.svg" alt="한경 언더라인 독서클럽" style={{ height: '24px' }} /></div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>✉️</div>
            <h3 style={{ marginBottom: '12px' }}>이메일 인증을 완료해주세요</h3>
            <p className="modal-sub" style={{ lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--accent)' }}>{verificationEmail}</strong> 으로<br/>인증 메일을 발송했습니다.<br/><br/>인증 링크를 클릭하시면 회원가입이 완료됩니다.
            </p>
          </div>
          <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '16px', marginBottom: '20px', fontSize: '0.82rem', color: '#666', lineHeight: 1.6 }}>💡 메일이 보이지 않으면 스팸함을 확인해주세요.</div>
          <button className="modal-btn" onClick={() => { setEmailVerificationSent(false); setIsLoginOpen(true); setIsLoginMode(true); }}>로그인하러 가기</button>
        </div>
      </div>

      {/* POSTCODE MODAL */}
      {isPostcodeOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setIsPostcodeOpen(false); }}>
          <div className="modal" style={{ padding: '24px', width: 'min(400px, 90vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>주소 검색</h3>
              <button type="button" onClick={() => setIsPostcodeOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <DaumPostcodeEmbed onComplete={(data) => { setZonecode(data.zonecode); setAddress(data.address); setIsPostcodeOpen(false); }} />
          </div>
        </div>
      )}
    </>
  );
}
