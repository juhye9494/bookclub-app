"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import DaumPostcodeEmbed from 'react-daum-postcode';

const REVIEWS = [
  { stars:'★★★★★', quote:'"책을 고르는 재미가 생겼어요."', author:'30대 직장인, 서울' },
  { stars:'★★★★★', quote:'"한경이라 믿고 시작했는데, 기대 이상이에요."', author:'40대 자영업자, 부산' },
  { stars:'★★★★★', quote:'"선물하기로도 딱이에요."', author:'50대 주부, 인천' },
  { stars:'★★★★★', quote:'"하루 30분, 독서 습관이 자리잡혔어요."', author:'20대 대학생, 대전' },
  { stars:'★★★★★', quote:'"저자 강연이 정말 알찼습니다."', author:'40대 회사원, 경기' },
  { stars:'★★★★★', quote:'"매달 책을 받는 설렘이 있어요."', author:'30대 워킹맘, 서울' },
  { stars:'★★★★★', quote:'"큐레이션의 폭이 넓어 좋아요."', author:'50대 임원, 서울' },
  { stars:'★★★★★', quote:'"가족 모두가 함께 읽고 있어요."', author:'40대 학부모, 광주' },
  { stars:'★★★★★', quote:'"한경의 신뢰감이 책에도 느껴져요."', author:'60대 은퇴자, 부산' },
  { stars:'★★★★★', quote:'"독서 노트가 의외로 너무 좋아요."', author:'30대 디자이너, 서울' }
];

const MAX_SELECT = 4;

export default function Home() {
  const [books, setBooks] = useState<any[]>([]);
  const [cycleLabel, setCycleLabel] = useState<string>('로딩중...');
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [zonecode, setZonecode] = useState('');
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePayment = async () => {
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_oEjb0gm23P55WYjKGQpnVpGwBJn5';
      const tossPayments = await loadTossPayments(clientKey);

      await tossPayments.requestPayment('카드', {
        amount: 60000,
        orderId: `order_${new Date().getTime()}`,
        orderName: "한경 석세스 클럽 6개월권",
        customerName: name || "홍길동",
        successUrl: `${window.location.origin}/success`,
        failUrl: `${window.location.origin}/fail`,
      });
    } catch (err) {
      console.error(err);
      alert('결제창을 띄우는 데 실패했습니다.');
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    
    if (!isLoginMode && (!name || !phone || !address || !detailAddress)) {
      alert('배송을 위해 이름, 연락처, 상세 주소를 모두 입력해주세요.');
      return;
    }

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert('로그인 실패: ' + error.message);
        return;
      }
      alert('로그인 성공!');
      setIsLoginOpen(false);
      if (selected.size === MAX_SELECT) {
        if (data.user?.user_metadata?.has_paid) {
          alert('이미 결제가 완료된 계정입니다. 첫 번째 배송을 준비중입니다!');
        } else {
          setIsPaymentOpen(true);
        }
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            name,
            phone,
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
      if (selected.size === MAX_SELECT) setIsPaymentOpen(true);
    }
  };

  useEffect(() => {
    async function loadBooks() {
      const { data: cycles } = await supabase.from('cycles').select('*').eq('status', 'active').order('start_date', { ascending: false }).limit(1);
      if (cycles && cycles.length > 0) {
        const cycle = cycles[0];
        setCycleLabel(cycle.label);
        const { data: bData } = await supabase.from('books').select('*').eq('cycle_id', cycle.id);
        if (bData) {
          const formatted = bData.map((b: any, i: number) => {
            const colors = [
              { bg: '#0d1b6e', bgDark: '#070e3a' },
              { bg: '#c0392b', bgDark: '#7b241c' },
              { bg: '#c9a000', bgDark: '#7a6000' },
              { bg: '#2ecc40', bgDark: '#1a7a26' },
              { bg: '#171717', bgDark: '#000000' },
              { bg: '#605856', bgDark: '#3b3433' },
            ];
            const c = colors[i % colors.length];
            return {
              id: b.id,
              title: b.title,
              author: b.author,
              genre: b.genre,
              color: `book-${(i % 6) + 1}`,
              bg: c.bg,
              bgDark: c.bgDark,
              img: b.cover,
              tags: b.tags || [],
              desc: b.description,
              lecture: b.lecture,
              benefit: b.lecture ? '+ 저자 강연권' : ''
            };
          });
          setBooks(formatted);
        }
      } else {
        setCycleLabel('준비된 시즌이 없습니다.');
      }
      setLoadingBooks(false);
    }
    loadBooks();

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    
    const saved = sessionStorage.getItem('bookSelection');
    if (saved) {
      setSelected(new Set(JSON.parse(saved)));
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleBook = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        if (next.size >= MAX_SELECT) {
          alert('이미 4권을 선택하셨어요. 다른 책을 빼고 담아주세요.');
          return prev;
        }
        next.add(idx);
      }
      sessionStorage.setItem('bookSelection', JSON.stringify([...next]));
      return next;
    });
  };

  const openDetail = (idx: number) => {
    setDetailIdx(idx);
    setIsDetailOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    document.body.style.overflow = '';
  };

  const activeBook = detailIdx !== null ? books[detailIdx] : null;

  return (
    <>
      {/* NAV */}
      <nav id="main-nav" className={scrolled ? 'scrolled' : ''}>
        <div className="nav-logo"><img src="/logo.svg" alt="한경 석세스 클럽" className="brand-logo" /></div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a href="/archive.html" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', textDecoration: 'none', fontWeight: 500 }}>지난 도서</a>
          {user ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <a href="/mypage" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', textDecoration: 'none', fontWeight: 500 }}>마이페이지</a>
              <button className="nav-cta" style={{ background: '#333' }} onClick={() => {
                supabase.auth.signOut();
                alert('로그아웃 되었습니다.');
              }}>로그아웃</button>
            </div>
          ) : (
            <button className="nav-cta" onClick={() => { setIsLoginMode(true); setIsLoginOpen(true); }}>로그인/가입</button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <h1 className="hero-headline">성장을 위한 제안,<br /><em>당신의 선택을 더하세요.</em></h1>
        <p className="hero-sub">6개월 동안 새롭게 선별되는 도서 중에서 원하는 4권을 선택해보세요.<br />한경 석세스 클럽과 함께하면, 독서가 달라집니다.</p>

        {/* BOOK GRID */}
        {loadingBooks ? (
          <div style={{ textAlign: 'center', padding: '100px 0', fontSize: '1.2rem', color: '#666' }}>도서 목록을 불러오는 중입니다...</div>
        ) : (
        <div id="books" className="book-grid-wrap show-benefit reveal visible">
          <div className="book-grid" id="bookShelf">
            {books.map((book, i) => (
              <div key={i} className={`book-card ${selected.has(i) ? 'selected' : ''}`}>
                <div className="book-card-inner">
                  <div className="book-cover" style={{ cursor: 'pointer' }} onClick={() => openDetail(i)}>
                    {book.tags.includes('강연 포함') && <div className="book-lecture-badge">강연 포함</div>}
                    <img src={book.img} alt={book.title} />
                  </div>
                  <button
                    className={`book-select-btn ${selected.has(i) ? 'added' : ''}`}
                    onClick={(e) => toggleBook(i, e)}
                  >
                    {selected.has(i) ? '✓ 담겼어요' : '+ 담기'}
                  </button>
                </div>
                <p className="book-title">{book.title}</p>
                <p className="book-benefit">{book.benefit}</p>
              </div>
            ))}
          </div>

          <div className="shelf-footer">
            <p className="shelf-hint">원하는 책 4권을 골라보세요</p>
            <div className="shelf-counter">
              <div className="counter-dots">
                {[0, 1, 2, 3].map((dot) => (
                  <div key={dot} className={`counter-dot ${dot < selected.size ? 'filled' : ''}`}></div>
                ))}
              </div>
              <span>{selected.size} / 4권</span>
            </div>
            <button
              className={`btn-delivery ${selected.size === MAX_SELECT ? 'visible' : ''}`}
              onClick={() => {
                if (user) {
                  setIsPaymentOpen(true);
                } else {
                  setIsLoginMode(true);
                  setIsLoginOpen(true);
                }
              }}
            >
              선택한 {selected.size}권 무료로 시작하기
            </button>
          </div>
        </div>
        )}
      </section>

      {/* DETAIL VIEW */}
      <div id="detail-view" className={isDetailOpen ? 'open' : ''}>
        {activeBook && (
          <>
            <div className="dv-nav">
              <button className="dv-back" onClick={closeDetail}>
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                도서 목록으로
              </button>
              <div className="dv-nav-title"><img src="/logo.svg" alt="한경 석세스 클럽" className="brand-logo" /></div>
              <div style={{ width: '100px' }}></div>
            </div>

            <div className="dv-hero">
              <div className="dv-hero-bg" style={{ background: `linear-gradient(160deg, ${activeBook.bgDark} 0%, ${activeBook.bg} 100%)` }}></div>
              <div className="dv-hero-inner">
                <div className="dv-cover"><img src={activeBook.img} alt="" /></div>
                <div className="dv-meta">
                  <p className="dv-genre">{activeBook.genre}</p>
                  <h2 className="dv-title">{activeBook.title}</h2>
                  <p className="dv-author">{activeBook.author}</p>
                  <div className="dv-tags">
                    {activeBook.tags.map((t: string, i: number) => (
                      <span key={i} className={`dv-tag ${t === '강연 포함' ? 'lecture' : ''}`}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="dv-body">
              <div className="dv-main">
                <div className="dv-section">
                  <p className="dv-label">책 소개</p>
                  <div className="dv-text" dangerouslySetInnerHTML={{ __html: (activeBook.desc || '').replace(/\n/g, '<br/>') }} />
                </div>
                  
                {activeBook.lecture && (
                  <div className="dv-section">
                    <p className="dv-label">저자 강연</p>
                    <div className="dv-lecture-card">
                      <div className="dv-lecture-header">
                        <span className="dv-lecture-icon">🎙</span>
                        <span className="dv-lecture-title">저자 온라인 강연 포함</span>
                        <span className="dv-lecture-badge">무료 제공</span>
                      </div>
                      <p className="dv-lecture-desc">{activeBook.lecture.desc}</p>
                      <ul className="dv-lecture-perks">
                        {activeBook.lecture.perks.map((p: string, i: number) => (
                          <li key={i}><span className="dv-perk-dot"></span>{p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="dv-sidebar">
                <div className="dv-sidebar-card">
                  <div className="dv-sidebar-cover"><img src={activeBook.img} alt="" /></div>
                  <p className="dv-sidebar-genre">{activeBook.genre}</p>
                  <p className="dv-sidebar-title">{activeBook.title}</p>
                  <p className="dv-sidebar-author">{activeBook.author}</p>
                  <div className="dv-sidebar-divider"></div>
                  <p style={{ fontFamily: 'var(--serif)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>구독 플랜에 포함</p>
                  <div className="dv-plan-row"><span className="l">구독권</span><span className="r">6개월권</span></div>
                  <div className="dv-plan-row"><span className="l">도서 선택</span><span className="r">6개월간 4권</span></div>
                  <div className="dv-plan-row"><span className="l">구독 금액</span><span className="r" style={{ color: 'var(--accent)' }}>60,000원</span></div>
                  <button
                    className={`dv-add-btn ${detailIdx !== null && selected.has(detailIdx) ? 'added' : ''}`}
                    onClick={() => detailIdx !== null && toggleBook(detailIdx)}
                  >
                    {detailIdx !== null && selected.has(detailIdx) ? '✓ 담겼어요' : '+ 내 목록에 담기'}
                  </button>
                </div>
              </div>
            </div>

            <div className="dv-other">
              <div className="dv-other-inner">
                <p className="dv-other-label">다른 도서</p>
                <h3 className="dv-other-title">6개월간 4권을 골라보세요</h3>
                <div className="dv-other-grid">
                  {books.map((b, i) => (
                    <div key={i} className={`dv-other-card ${i === detailIdx ? 'active' : ''}`} onClick={() => openDetail(i)}>
                      <div className="dv-other-cover"><img src={b.img} alt={b.title} /></div>
                      <p className="dv-other-name">{b.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* LOGIN MODAL */}
      <div className={`modal-overlay ${isLoginOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsLoginOpen(false); }}>
        <div className="modal">
          <button className="modal-close" onClick={() => setIsLoginOpen(false)}>✕</button>
          <div className="modal-logo"><img src="/logo.svg" alt="한경 석세스 클럽" className="brand-logo" /></div>
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

      {/* PAYMENT MODAL */}
      <div className={`modal-overlay ${isPaymentOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsPaymentOpen(false); }}>
        <div className="modal">
          <button className="modal-close" onClick={() => setIsPaymentOpen(false)}>✕</button>
          <div className="modal-logo"><img src="/logo.svg" alt="한경 석세스 클럽" className="brand-logo" /></div>
          <h3>구독 신청</h3>
          <p className="modal-sub">선택하신 4권이 담겼습니다. 구독을 시작하시면 배송됩니다.</p>
          <div className="selected-books-preview">
            {Array.from(selected).map((idx) => (
              <div key={idx} className="preview-book" style={{ background: books[idx].bg }}>
                <img src={books[idx].img} alt={books[idx].title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
          <div className="plan-detail">
            <div className="plan-row"><span className="label">구독 플랜</span><span className="value">6개월권</span></div>
            <div className="plan-row"><span className="label">도서 4권</span><span className="value">포함</span></div>
            <div className="plan-row"><span className="label">웰컴 키트</span><span className="value">무료 증정</span></div>
            <div className="plan-row"><span className="label">저자 강연권</span><span className="value">포함</span></div>
            <div className="plan-row total"><span className="label">합계</span><span className="value">60,000원</span></div>
          </div>
          
          <button className="modal-btn" onClick={handlePayment} style={{ marginTop: '16px' }}>60,000원 결제하기</button>
        </div>
      </div>

      {/* SERVICE SECTION */}
      <section className="service-section" style={{ background: 'var(--bg)' }}>
        <div className="service-inner">
          <div className="service-header reveal visible">
            <p className="section-label">북클럽 소개</p>
            <h2 className="section-title">하루 30분,<br />삶이 바뀌는 독서 루틴</h2>
            <p className="service-lead">한경 석세스 클럽</p>
            <p className="section-desc">당신의 30분은 어디에 쓰이나요?<br />이 짧은 시간이 쌓이면 세상을 바라보는 생각과 시선,<br />그리고 삶이 달라집니다.<br /><br />'책'을 통해 나를 만들어가는 시간 —<br />오늘의 30분이 내일의 당신을 만듭니다.</p>
          </div>
        </div>
      </section>

      {/* SERVICE */}
      <section className="service-section">
        <div className="service-inner">
          <div className="service-header reveal visible">
            <p className="section-label">가입 혜택</p>
            <h2 className="section-title">다양한 혜택으로<br />책 읽는 즐거움이 커집니다.</h2>
          </div>
          <div className="service-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="service-card reveal visible" style={{ transitionDelay: '0.1s' }}>
              <div className="card-icon">🎁</div>
              <p className="card-tag">가입 즉시</p>
              <h3 className="card-title">웰컴 키트</h3>
              <p className="card-desc">30분을 기록할 수 있는 모래시계와 독서를 더욱 풍성하게 해줄 독서노트, 가죽 북커버까지 모두 드립니다. (가입 시, 최초 1회 무료 증정)</p>
            </div>
            <div className="service-card reveal visible" style={{ transitionDelay: '0.2s' }}>
              <div className="card-icon">🎙</div>
              <p className="card-tag">선택 도서별</p>
              <h3 className="card-title">저자 특별 프로그램</h3>
              <p className="card-desc">선택 도서에 따라 저자 유료 강연권, 스페셜 PDF 자료집 등 특별한 혜택을 함께 받아보실 수 있습니다.</p>
            </div>
            <div className="service-card reveal visible" style={{ transitionDelay: '0.3s' }}>
              <div className="card-icon">📱</div>
              <p className="card-tag">언제 어디서나</p>
              <h3 className="card-title">전자책 3종</h3>
              <p className="card-desc">더 많은 책을 경험하실 수 있도록 전자책 콘텐츠를 함께 제공합니다. (한경 전체 도서 중 택 3권)</p>
            </div>
            <div className="service-card reveal visible" style={{ transitionDelay: '0.4s' }}>
              <div className="card-icon">🎼</div>
              <p className="card-tag">한경 패밀리</p>
              <h3 className="card-title">한경 패밀리 행사 초청</h3>
              <p className="card-desc">한경 아르떼 필아모닉, 미술 전시회 등 품격 있는 문화 경험의 기회를 제공합니다. (상시 이벤트 진행 예정)</p>
            </div>
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className="flow-section">
        <div className="flow-inner">
          <div className="flow-header reveal visible">
            <p className="section-label">가입 플로우</p>
            <h2 className="section-title">시작은 간단합니다</h2>
            <p className="section-desc">4단계로 완성되는 나만의 독서 생활</p>
          </div>
          <div className="flow-steps">
            <div className="flow-step reveal visible" style={{ transitionDelay: '0.05s' }}>
              <div className="step-circle">01</div>
              <p className="step-num">STEP 1</p>
              <h4 className="step-title">북클럽 가입</h4>
              <p className="step-desc">상시 가입 가능</p>
            </div>
            <div className="flow-step reveal visible" style={{ transitionDelay: '0.15s' }}>
              <div className="step-circle">02</div>
              <p className="step-num">STEP 2</p>
              <h4 className="step-title">웰컴 키트 수령</h4>
              <p className="step-desc">가입 즉시<br />집으로 배송</p>
            </div>
            <div className="flow-step reveal visible" style={{ transitionDelay: '0.25s' }}>
              <div className="step-circle">03</div>
              <p className="step-num">STEP 3</p>
              <h4 className="step-title">도서 선택</h4>
              <p className="step-desc">6개월간 총 4권<br />자유 선택</p>
            </div>
            <div className="flow-step reveal visible" style={{ transitionDelay: '0.35s' }}>
              <div className="step-circle">04</div>
              <p className="step-num">STEP 4</p>
              <h4 className="step-title">집으로 배송</h4>
              <p className="step-desc">도서를 선택한 달에 배송</p>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="review-section">
        <div className="review-inner">
          <div className="review-header reveal visible">
            <p className="section-label">고객 후기</p>
            <h2 className="section-title">회원들이 직접<br />전하는 이야기</h2>
          </div>
          <div className="review-marquee reveal visible">
            <div className="marquee-track">
              {[...REVIEWS, ...REVIEWS].map((r, i) => (
                <div key={i} className="review-card mini">
                  <p className="review-stars">{r.stars}</p>
                  <p className="review-quote">{r.quote}</p>
                  <p className="review-author">{r.author}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PLAN */}
      <section className="plan-section" id="plan">
        <div className="plan-inner">
          <p className="section-label plan-label reveal visible">구독 플랜</p>
          <h2 className="section-title plan-title reveal visible">지금, 한경 석세스 클럽을<br />시작하세요.</h2>
          <div className="plan-card reveal visible">
            <p className="plan-name">한경 석세스 클럽 6개월권</p>
            <p className="plan-price">60,000<span>원</span></p>
            <p className="plan-period">6개월 구독 · 일시납</p>
            <button className="plan-btn" style={{ marginTop: '24px' }} onClick={() => {
              if (user) {
                if (user.user_metadata?.has_paid) {
                  alert('이미 결제가 완료된 계정입니다. 첫 번째 배송을 준비중입니다!');
                } else {
                  setIsPaymentOpen(true);
                }
              } else {
                setIsLoginMode(false); setIsLoginOpen(true);
              }
            }}>지금 구독 신청하기</button>
            <p className="plan-note">* 가입 후 7일 이내 서비스 이용 내역이 없는 경우 전액 환불 가능합니다.<br />* 7일 이내라도 발송된 사은품 및 배송된 도서를 훼손한 경우 해당 비용을 제합니다.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-logo"><img src="/logo.svg" alt="한경 석세스 클럽" className="brand-logo" /></div>
          </div>
          <div className="footer-company">
            <div><strong>대표이사</strong>서정환</div>
            <div><strong>주소</strong>04505 서울시 중구 청파로 463 한국경제신문사 6층</div>
            <div><strong>사업자번호</strong>104-81-47761</div>
          </div>
          <div className="footer-contact">
            📞 02-360-4555<br />
            📧 bp@hankyung.com
            <div style={{ marginTop: '14px' }}>
              <button type="button" className="footer-policy-btn" onClick={() => setIsPrivacyOpen(true)}>개인정보처리방침</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-legal">© 한경매거진앤북</p>
          <a href="/admin" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'none', opacity: 0.6 }}>관리자</a>
        </div>
      </footer>

      {/* PRIVACY MODAL */}
      <div className={`privacy-modal ${isPrivacyOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsPrivacyOpen(false); }}>
        <div className="privacy-card">
          <div className="privacy-head">
            <h3>개인정보처리방침</h3>
            <button type="button" className="privacy-close" onClick={() => setIsPrivacyOpen(false)}>×</button>
          </div>
          <div className="privacy-body">
            <h4>1. 개인정보의 수집 및 이용 목적</h4>
            <p>한국경제매거진앤북(이하 '회사')은 다음의 목적을 위하여 개인정보를 처리합니다.</p>
            <ul>
              <li>회원 가입 및 관리, 본인 확인</li>
              <li>도서 구독 서비스 제공 및 배송</li>
              <li>웰컴 키트 및 사은품 발송</li>
              <li>행사 초청 및 고지사항 안내</li>
            </ul>
            <h4>2. 수집하는 개인정보 항목</h4>
            <ul>
              <li>필수: 이름, 연락처, 이메일, 배송지</li>
              <li>선택: 생년월일, 관심 분야</li>
              <li>결제 정보: 결제수단 정보(안전하게 암호화 처리)</li>
            </ul>
            <h4>3. 개인정보의 보유 및 이용 기간</h4>
            <p>회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만, 관계법령에 의해 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.</p>
            <h4>4. 개인정보의 제3자 제공</h4>
            <p>회사는 이용자의 개인정보를 명시한 범위를 초과하여 이용하거나 제3자에게 제공하지 않습니다. 다만, 이용자의 사전 동의를 얻거나 법령의 규정에 의거한 경우에는 예외로 합니다.</p>
            <h4>5. 개인정보처리 책임자</h4>
            <p>한국경제매거진앤북 개인정보 보호책임자<br />
            이메일: bp@hankyung.com<br />
            전화: 02-360-4555</p>
            <h4>6. 이용자의 권리</h4>
            <p>이용자는 언제든지 등록되어 있는 본인의 개인정보를 조회하거나 수정할 수 있으며 가입해지 또는 삭제를 요청할 수도 있습니다.</p>
            <p style={{ marginTop: '24px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>본 방침은 2026년 1월 1일부터 적용됩니다.</p>
          </div>
        </div>
      </div>
    </>
  );
}
