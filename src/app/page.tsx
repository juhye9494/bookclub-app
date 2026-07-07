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
              <p className="hero-slogan">한 권의 책, 하나의 밑줄이 당신의 경험을 더 넓혀줍니다.</p>
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

            {/* CSS styles for Hero animation */}
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
              @keyframes drawLine { to { transform: scaleX(1); } }
              @keyframes revealText { to { opacity: 1; transform: translateY(0); } }
              @keyframes fadeUpSlogan { to { opacity: 1; transform: translateY(0); } }
              @keyframes fadeUpSub { to { opacity: 1; transform: translateY(0); } }
            `}</style>

            {/* HERO BOOK ROLLING */}
            {books.length > 0 && (
              <div className="hero-book-rolling" style={{ maxWidth: '960px', width: '100%', marginTop: '60px', opacity: 0, animation: 'fadeUpHeroBooks 0.8s 2.8s ease forwards' }}>
                <style>{`
                  @keyframes fadeUpHeroBooks {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  .hero-book-rolling {
                    overflow: hidden;
                    -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%);
                    mask-image: linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%);
                  }
                  .hero-rolling-track {
                    display: flex;
                    gap: 24px;
                    width: max-content;
                    animation: heroBookScroll 40s linear infinite;
                  }
                  @keyframes heroBookScroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                  .hero-rolling-item {
                    flex-shrink: 0;
                    width: 120px;
                    text-align: center;
                    pointer-events: none;
                    user-select: none;
                  }
                  .hero-rolling-cover {
                    width: 120px;
                    height: 180px;
                    border-radius: 4px 10px 10px 4px;
                    overflow: hidden;
                    box-shadow: -3px 5px 16px rgba(0,0,0,0.15);
                    margin-bottom: 10px;
                  }
                  .hero-rolling-cover img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                  }
                  .hero-rolling-title {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--text);
                    line-height: 1.35;
                    margin-bottom: 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                  .hero-rolling-author {
                    font-size: 0.65rem;
                    color: var(--text-muted);
                  }
                  @media (max-width: 600px) {
                    .hero-rolling-item { width: 100px; }
                    .hero-rolling-cover { width: 100px; height: 150px; }
                    .hero-rolling-track { gap: 16px; }
                  }
                `}</style>
                <div className="hero-rolling-track">
                  {[...books.slice(0, 10), ...books.slice(0, 10)].map((book, i) => (
                    <div key={i} className="hero-rolling-item">
                      <div className="hero-rolling-cover">
                        <img src={book.img} alt={book.title} />
                      </div>
                      <p className="hero-rolling-title">{book.title}</p>
                      <p className="hero-rolling-author">{book.author}</p>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                  <Link href="/books" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 36px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(252,102,64,0.35)', textDecoration: 'none', transition: 'all 0.2s' }}>
                    전체 도서 보러가기 →
                  </Link>
                </div>
              </div>
            )}
          </section>
        </>

      {/* 가입 혜택 */}
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

      {/* 북클럽 소개 */}
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

          {/* 유의사항 */}
          <div style={{ marginTop: '36px', padding: '28px 32px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', textAlign: 'left' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⓘ 유의사항
            </p>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.85, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p>※ 한경 언더라인 독서클럽은 3개월 단위의 시즌제 멤버십 서비스로 운영됩니다.</p>
              <p>※ 구독 문의 : 이메일 hankbp@naver.com (운영시간 10:00 ~ 16:00, 주말·공휴일·점심시간 제외)</p>
              
              <p style={{ marginTop: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                ── 중도해약 및 환불 안내 ──
              </p>
              <p><strong style={{ color: 'rgba(255,255,255,0.55)' }}>청약철회 (전액 환불):</strong> 결제일로부터 7일 이내에 요청 시 전액 환불이 가능합니다. 단, 지류 도서 및 웰컴굿즈가 이미 발송되었거나 e-book 등 디지털 콘텐츠를 다운로드·열람한 경우에는 청약철회가 제한될 수 있습니다.</p>
              <p><strong style={{ color: 'rgba(255,255,255,0.55)' }}>중도 해지 환불 공식:</strong> 결제 개시 후 중도 해지 시에는 총 결제금액에서 이미 제공된 리워드의 실제 판매가와 발생한 배송비를 공제한 후 차액을 환불해 드립니다.</p>
              <p style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
                환불금액 = 총 결제금액 - 기제공 혜택 상당액(지류도서/웰컴굿즈/e-book 등) - 발생 배송비
              </p>
              <p>차감 금액의 총합이 결제 금액을 초과하는 경우 추가 비용은 청구되지 않으며 환불 금액은 없는 것으로 합니다.</p>
              <p><strong style={{ color: 'rgba(255,255,255,0.55)' }}>디지털 콘텐츠 기준:</strong> e-book 및 PDF 다운로드 또는 열람이 개시된 경우 해당 콘텐츠는 이미 이용된 것으로 간주하여 환불 금액 산정 시 정가 차감됩니다.</p>
              <p><strong style={{ color: 'rgba(255,255,255,0.55)' }}>신용카드 결제 시:</strong> 환불은 카드취소로만 가능하며, 카드 결제 요금을 부분 취소하기 어려운 경우는 전액 취소 후 차액 납입을 요청할 수 있습니다.</p>
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
