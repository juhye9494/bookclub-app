"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';



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

export default function Home() {
  const [books, setBooks] = useState<any[]>([]);
  const [cycleLabel, setCycleLabel] = useState<string>('로딩중...');
  const [loadingBooks, setLoadingBooks] = useState(true);

  useEffect(() => {
    async function loadBooks() {
      const { data: cycles } = await supabase.from('cycles').select('*').eq('status', 'active').order('start_date', { ascending: false }).limit(1);
      if (cycles && cycles.length > 0) {
        const cycle = cycles[0];
        setCycleLabel(cycle.label);
        const { data: bData } = await supabase.from('books').select('*').eq('cycle_id', cycle.id);
        if (bData) {
          const sortedBooks = [...bData].sort((a, b) => (a.order_idx || 0) - (b.order_idx || 0)).slice(0, 25);
          const formatted = sortedBooks.map((b: any, i: number) => {
            const colors = [
              { bg: '#3b4b72', bgDark: '#121931' }, // CES 2026 (블루)
              { bg: '#c0392b', bgDark: '#7b241c' }, // 정리 (레드)
              { bg: '#c9a000', bgDark: '#7a6000' }, // 리츠 (골드)
              { bg: '#2ecc40', bgDark: '#1a7a26' }, // 퍼지키즈 (그린)
              { bg: '#171717', bgDark: '#000000' }, // 철학 (다크)
              { bg: '#605856', bgDark: '#3b3433' }, // 투자 (그레이)
            ];
            const c = colors[i % colors.length];
            return {
              id: b.id,
              title: b.title,
              author: b.author,
              genre: b.genre,
              color: `book-${(i % 6) + 1}`,
              bg: b.bg || c.bg,
              bgDark: b.bgDark || c.bgDark,
              img: b.cover,
              tags: b.tags || [],
              desc: b.description,
              lecture: b.lecture,
              ebook_url: b.ebook_url || '',
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
  }, []);


  return (
    <>
        <>
          {/* HERO */}
          <section className="hero" style={{ paddingBottom: '40px' }}>
            <div className="hero-title-container">
              <p className="hero-slogan">한 권의 책, 한 줄의 밑줄이 당신의 경험을 더 넓혀줍니다.</p>
              <h1 className="hero-underline-title">
                <span className="underline-draw"></span>
                <span className="text-reveal-container">
                  {'언더라인'.split('').map((char, i) => (
                    <span key={i} className="char-reveal" style={{ animationDelay: `${0.5 + i * 0.35}s` }}>{char}</span>
                  ))}
                </span>
              </h1>
            </div>
             <p className="hero-sub hero-sub-animate" style={{ maxWidth: '640px', marginTop: '40px' }}>
              하루 딱 30분, 3개월<br />
              경제·경영·인문·예술을 넘나드는 즐거운 독서 경험을 만나보세요.<br />
              한경 언더라인 독서클럽이 성장의 여정을 함께합니다.
            </p>

            {/* CSS styles for Hero animation and preview */}
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap');
              .hero-title-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-bottom: 24px;
                padding-top: 48px;
              }
              .hero-slogan {
                font-size: 1.15rem;
                font-weight: 500;
                color: var(--text-mid);
                margin-bottom: 16px;
                opacity: 0;
                transform: translateY(12px);
                animation: fadeUpSlogan 0.8s 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
              }
              .hero-underline-title {
                position: relative;
                font-family: 'Gowun Batang', var(--serif);
                font-size: clamp(2.8rem, 6vw, 4.2rem);
                font-weight: 700;
                color: var(--text);
                line-height: 1.2;
                padding-bottom: 10px;
                display: inline-block;
                letter-spacing: -0.01em;
              }
              .underline-draw {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 6px;
                background-color: var(--accent);
                transform: scaleX(0);
                transform-origin: left;
                animation: drawLine 1.8s 0.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
              }
              .text-reveal-container {
                display: inline-block;
              }
              .char-reveal {
                display: inline-block;
                opacity: 0;
                animation: charRevealAnim 0.6s ease forwards;
              }
              @keyframes charRevealAnim {
                from { opacity: 0; }
                to   { opacity: 1; }
              }
              .hero-sub-animate {
                opacity: 0;
                transform: translateY(12px);
                animation: fadeUpSub 0.8s 2.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards !important;
              }
              .book-preview-wrap {
                opacity: 0;
                animation: fadeUp 0.8s 3.0s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards !important;
              }
              @keyframes drawLine { to { transform: scaleX(1); } }
              @keyframes revealText { to { opacity: 1; transform: translateY(0); } }
              @keyframes fadeUpSlogan { to { opacity: 1; transform: translateY(0); } }
              @keyframes fadeUpSub { to { opacity: 1; transform: translateY(0); } }

              .preview-book-card {
                text-align: center;
                cursor: pointer;
                transition: transform 0.3s;
              }
              .preview-book-card:hover {
                transform: translateY(-8px);
              }
              .preview-book-card .book-cover {
                width: 100%;
                aspect-ratio: 2/3;
                border-radius: 4px 10px 10px 4px;
                position: relative;
                overflow: hidden;
                box-shadow: -4px 6px 20px rgba(0,0,0,0.2);
                margin-bottom: 12px;
              }
              .preview-book-card .book-cover img {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              }
              .see-more-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 16px 40px;
                background: var(--accent);
                color: #fff;
                border: none;
                border-radius: 100px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(252,102,64,0.35);
                transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
                text-decoration: none;
              }
              .see-more-btn:hover {
                background: var(--accent-dark);
                transform: translateY(-2px);
                box-shadow: 0 8px 28px rgba(252,102,64,0.4);
              }
            `}</style>

            {/* BOOK PREVIEW */}
            {loadingBooks ? (
              <div style={{ textAlign: 'center', padding: '60px 0', fontSize: '1rem', color: '#999' }}>도서 목록을 불러오는 중...</div>
            ) : books.length > 0 && (
              <div className="book-preview-wrap" style={{ maxWidth: '960px', width: '100%', marginTop: '72px' }}>
                {/* Preview Grid: show up to 5 books */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '24px 18px', marginBottom: '48px' }}>
                  {books.slice(0, 5).map((book, i) => (
                    <Link key={book.id} href="/books" className="preview-book-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="book-cover">
                        <img src={book.img} alt={book.title} />
                      </div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: '2px' }}>{book.title}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{book.author}</p>
                    </Link>
                  ))}
                </div>

                {/* CTA Button */}
                <div style={{ textAlign: 'center' }}>
                  <Link href="/books" className="see-more-btn">
                    전체 도서 보러가기 →
                  </Link>
                  <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'center' }}>
                    3개월 동안 3권의 도서를 자유롭게 선택하세요<br />
                    <span style={{ fontSize: '0.78rem' }}>(신규 도서는 매월 초 업데이트 됩니다)</span>
                  </p>
                </div>
              </div>
            )}
          </section>
        </>

      {/* SERVICE SECTION */}
      <section className="service-section" style={{ background: 'var(--bg)' }}>
        <div className="service-inner">
          <div className="service-header reveal visible">
            <p className="section-label">북클럽 소개</p>
            <h2 className="section-title">하루 30분,<br />삶이 바뀌는 독서 루틴</h2>
            <p className="service-lead">한경 언더라인 독서클럽</p>
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
              <div className="card-icon"><img src="/uploads/benefit_welcome.png" alt="웰컴 굿즈" /></div>
              <p className="card-tag">독서 습관을 만드는</p>
              <h3 className="card-title">웰컴 굿즈</h3>
              <p className="card-desc">30분을 기록할 수 있는 모래시계와 독서노트, 편집자 레터를 드립니다.<br />(가입 시, 최초 1회 무료 배송)</p>
            </div>
            <div className="service-card reveal visible" style={{ transitionDelay: '0.2s' }}>
              <div className="card-icon"><img src="/uploads/benefit_booktalk.png" alt="북토크" /></div>
              <p className="card-tag">시즌 대표 도서</p>
              <h3 className="card-title">무료 북토크 초대</h3>
              <p className="card-desc">월 1회 진행되는 오프라인 저자 북토크에 회원 우선 혜택으로 무료 초청해 드립니다.</p>
            </div>
            <div className="service-card reveal visible" style={{ transitionDelay: '0.3s' }}>
              <div className="card-icon"><img src="/uploads/benefit_ebook.png" alt="전자책" /></div>
              <p className="card-tag">언제 어디서나</p>
              <h3 className="card-title">전자책 3종</h3>
              <p className="card-desc">제공되는 한경 전자책 중 원하는 3종을 선택하여 무료로 이용하실 수 있습니다.</p>
            </div>
            <div className="service-card reveal visible" style={{ transitionDelay: '0.4s' }}>
              <div className="card-icon"><img src="/uploads/benefit_arte.jpg" alt="아르떼/필" /></div>
              <p className="card-tag">품격 있는 문화 생활</p>
              <h3 className="card-title">한경 아르떼/필 티켓</h3>
              <p className="card-desc">아르떼 전시회 및 한경필하모닉오케스트라 공연 티켓을 추첨을 통해 무료로 증정해 드립니다.</p>
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
              <p className="step-desc">시즌별 가입 진행</p>
            </div>
            <div className="flow-step reveal visible" style={{ transitionDelay: '0.15s' }}>
              <div className="step-circle">02</div>
              <p className="step-num">STEP 2</p>
              <h4 className="step-title">웰컴 굿즈 수령</h4>
              <p className="step-desc">가입 즉시<br />집으로 배송</p>
            </div>
            <div className="flow-step reveal visible" style={{ transitionDelay: '0.25s' }}>
              <div className="step-circle">03</div>
              <p className="step-num">STEP 3</p>
              <h4 className="step-title">도서 선택</h4>
              <p className="step-desc">3개월간 총 3권<br />자유 선택</p>
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
          <h2 className="section-title plan-title reveal visible">지금, 한경 언더라인 독서클럽을<br />시작하세요.</h2>
          <div className="plan-card reveal visible">
            <p className="plan-name">한경 언더라인 독서클럽 3개월권</p>
            <p className="plan-price">45,000<span>원</span></p>
            <p className="plan-period">3개월 구독 · 일시납</p>
            <Link href="/books" className="plan-btn" style={{ marginTop: '24px', display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>도서 선택하고 구독 신청하기</Link>

          </div>
        </div>
      </section>
    </>
  );
}
