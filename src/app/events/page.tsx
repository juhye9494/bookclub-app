"use client";
import React, { useEffect, useState, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

function EventQueryHandler({ events, onSelect }: { events: any[], onSelect: (e: any) => void }) {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const handledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id || events.length === 0) return;
    if (handledIdRef.current === id) return;

    handledIdRef.current = id;

    const target = events.find(e => String(e.id) === id);
    if (target) {
      onSelect(target);
    }
  }, [id, events, onSelect]);

  return null;
}

const MOCK_EVENTS = [
  {
    id: 'mock-ev-1',
    title: '[저자강연] 정경자 대표의 "공간 정리로 인생 바꾸기" 특강',
    category: '저자강연',
    date: '2026-06-15 (월) 19:30',
    location: '한국경제신문사 18층 다산홀 (오프라인 & 온라인 병행)',
    cover: '/uploads/author_lecture_event.png',
    description: '인생 정리 전문가 정경자 대표가 제안하는 공간 경영 및 정리 노하우 특강입니다.<br/><br/><strong>[강연 핵심 내용]</strong><br/>• 복잡한 생각과 물건을 비우는 \'비움의 미학\'<br/>• 생활주기별 공간 수납 설계 팁<br/>• 시간과 정서적 에너지를 회복하는 힐링 세션<br/><br/><strong>[회원 전용 혜택]</strong><br/>• 정리수납 1:1 현장 상담 (선착순 5명)<br/>• 정리 체크리스트 및 가이드북 PDF 제공',
    status: '모집중',
    order_idx: 0
  },
  {
    id: 'mock-ev-2',
    title: '한경 언더라인 2026 네트워킹 디너 "Success Night"',
    category: '패밀리행사',
    date: '2026-07-10 (금) 18:30',
    location: '포시즌스 호텔 서울 그랜드볼룸',
    cover: '/uploads/networking_dinner_event.png',
    description: '한경 언더라인의 우수 멤버 및 오피니언 리더들이 함께 모여 인사이트를 나누고 네트워크를 형성하는 연례 네트워킹 행사입니다.<br/><br/><strong>[행사 구성]</strong><br/>• Part 1: 2026 하반기 경제 트렌드 스페셜 강연<br/>• Part 2: 멤버십 갈라 디너 및 네트워킹 세션<br/>• Part 3: 행운권 추첨 및 특별 기념품 증정',
    status: '진행예정',
    order_idx: 1
  },
  {
    id: 'mock-ev-3',
    title: '[멤버십 혜택] 예술의전당 "베르나르 뷔페" 특별초대전 티켓 제공',
    category: '문화제휴',
    date: '2026-05-01 ~ 2026-06-30',
    location: '예술의전당 한가람미술관',
    cover: '/uploads/art_exhibition_event.png',
    description: '20세기 현대 미술의 거장, 베르나르 뷔페의 대형 회고전에 한경 언더라인 회원 여러분을 무료 초대합니다.<br/><br/><strong>[제공 혜택]</strong><br/>• 골드/프리미엄 멤버: 전시 무료 관람권 2매 증정<br/>• 일반 멤버: 현장 티켓 30% 특별 할인<br/>• 오디오 가이드 모바일 쿠폰 무료 배포',
    status: '모집중',
    order_idx: 2
  }
];

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('전체');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const closeDetail = () => {
    setSelectedEvent(null);
    const params = new URLSearchParams(window.location.search);
    if (params.has('id')) {
      router.replace('/events', { scroll: false });
    }
  };
  const [user, setUser] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [appliedEventIds, setAppliedEventIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 신청 상태 확인 (로그인 시)
  useEffect(() => {
    if (!user) return;
    async function checkApplied() {
      const { data } = await supabase.from('event_participants').select('event_id').eq('user_id', user.id);
      if (data) {
        setAppliedEventIds(new Set(data.map((d: any) => d.event_id)));
      }
    }
    checkApplied();
  }, [user]);

  const handleEventApply = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } }));
      return;
    }
    if (!selectedEvent) return;
    setApplying(true);
    try {
      if (appliedEventIds.has(selectedEvent.id)) {
        // 신청 취소 — 해당 이벤트의 모든 레코드 삭제
        await supabase.from('event_participants').delete().eq('event_id', selectedEvent.id).eq('user_id', user.id);
        const newSet = new Set(appliedEventIds);
        newSet.delete(selectedEvent.id);
        setAppliedEventIds(newSet);
        alert('이벤트 신청이 취소되었습니다.');
      } else {
        // 신청 전 DB 중복 체크 — 이미 있으면 삭제 후 재삽입
        const { data: existing } = await supabase.from('event_participants').select('id').eq('event_id', selectedEvent.id).eq('user_id', user.id);
        if (existing && existing.length > 0) {
          await supabase.from('event_participants').delete().eq('event_id', selectedEvent.id).eq('user_id', user.id);
        }
        await supabase.from('event_participants').insert([{
          event_id: selectedEvent.id,
          user_id: user.id,
          user_email: user.email,
          user_name: user.user_metadata?.name || user.email,
          event_title: selectedEvent.title,
        }]);
        const newSet = new Set(appliedEventIds);
        newSet.add(selectedEvent.id);
        setAppliedEventIds(newSet);
        alert('이벤트 참여가 성공적으로 접수되었습니다.\n자세한 진행 사항은 마이페이지 <활동내역>에서 확인 가능합니다.');
      }
    } catch (err) {
      alert('신청 중 오류가 발생했습니다.');
    }
    setApplying(false);
  };

  useEffect(() => {
    async function fetchEvents() {
      try {
        // Try fetching from events table
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('order_idx', { ascending: true });

        if (error || !data || data.length === 0) {
          // Fallback to mock data if table is not created yet or empty
          console.log('No events table or no data found, using premium fallback mock events.');
          setEvents(MOCK_EVENTS);
        } else {
          setEvents(data);
        }
      } catch (err) {
        console.error('Error fetching events from DB, falling back:', err);
        setEvents(MOCK_EVENTS);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const categories = ['전체', '저자강연', '패밀리행사', '문화제휴'];

  const filteredEvents = activeTab === '전체'
    ? events
    : events.filter(e => e.category === activeTab);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '모집중': return { bg: 'rgba(252, 102, 64, 0.1)', text: '#fc6640' };
      case '진행예정': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' };
      case '종료': return { bg: 'rgba(154, 148, 142, 0.1)', text: '#9a948e' };
      default: return { bg: 'rgba(154, 148, 142, 0.1)', text: '#9a948e' };
    }
  };

  return (
    <div style={{ background: 'var(--bg-warm)', minHeight: '100vh', fontFamily: 'var(--sans)', color: 'var(--text)', paddingTop: '64px' }}>
      
      <Suspense fallback={null}>
        <EventQueryHandler events={events} onSelect={setSelectedEvent} />
      </Suspense>

      {/* Dynamic Embedded Styles for Premium Animations & Micro interactions */}
      <style>{`
        .category-tab {
          padding: 10px 24px;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-mid);
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 40px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .category-tab.active {
          color: #ffffff;
          background: var(--text);
          border-color: var(--text);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(26,23,20,0.12);
        }
        .category-tab:hover:not(.active) {
          background: #f3ede2;
          transform: translateY(-1px);
        }
        .event-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid var(--border);
          overflow: hidden;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }
        .event-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.06);
          border-color: rgba(252, 102, 64, 0.2);
        }
        .event-card img {
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .event-card:hover img {
          transform: scale(1.04);
        }
        .modal-body-content ul {
          margin-left: 20px;
          margin-top: 8px;
          margin-bottom: 8px;
        }
        .modal-body-content li {
          margin-bottom: 6px;
        }
        @media (max-width: 768px) {
          .modal-inner {
            flex-direction: column !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
          }
          .modal-poster-wrap {
            width: 100% !important;
            height: 280px !important;
          }
        }
      `}</style>

      {/* Hero Header Section */}
      <section style={{ padding: '90px 5vw 48px', textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px' }}>Exclusive Privileges</p>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(2.2rem, 5vw, 3.2rem)', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.03em', marginBottom: '20px' }}>
          멤버십 이벤트 & 혜택
        </h1>
        <p style={{ color: 'var(--text-mid)', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '600px', margin: '0 auto' }}>
          저자 강연회, 네트워킹 파티, 한경 아르떼 문화 공연까지.<br />한경 언더라인 독서클럽 회원을 위한 프리미엄 혜택을 제공합니다.
        </p>
      </section>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', padding: '0 5vw', marginBottom: '48px' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`category-tab ${activeTab === cat ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Listing Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 5vw 120px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>로딩 중...</div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '16px', background: '#fff' }}>
            등록된 이벤트 정보가 없습니다.
          </div>
        ) : (
          <div className="events-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '32px' }}>
            {filteredEvents.map(ev => {
              const colors = getStatusColor(ev.status || '모집중');
              const hasCover = !!ev.cover;
              return (
                <div key={ev.id} className="event-card" onClick={() => setSelectedEvent(ev)}>
                  {/* Poster wrapper */}
                  <div style={{ aspectRatio: '16/10', background: 'var(--border)', overflow: 'hidden', relative: 'position' } as any}>
                    {hasCover ? (
                      <img
                        src={ev.cover}
                        alt={ev.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f6e6d9 0%, #ecd7c8 100%)', color: 'var(--text-mid)', fontWeight: 600, fontSize: '1.2rem', padding: '24px', textAlign: 'center' }}>
                        {ev.title}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {/* Badge and Tag */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', tracking: '0.05em' } as any}>
                          {ev.category}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', background: colors.bg, color: colors.text }}>
                          {ev.status || '모집중'}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.45, marginBottom: '16px', color: 'var(--text)' }}>
                        {ev.title}
                      </h3>
                    </div>

                    {/* Meta info */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-mid)' }}>
                        <span>📅</span>
                        <span>{ev.date}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-mid)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <span>📍</span>
                        <span>{ev.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* DETAIL OVERLAY MODAL */}
      {selectedEvent && (
        <div 
          className="modal-overlay open" 
          style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
        >
          <div 
            className="modal-inner"
            style={{ 
              background: '#ffffff', 
              borderRadius: '24px', 
              width: 'min(900px, 95vw)', 
              maxHeight: '85vh', 
              display: 'flex', 
              overflow: 'hidden', 
              position: 'relative',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              animation: 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => closeDetail()}
              style={{ position: 'absolute', top: '16px', right: '20px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
            >
              ✕
            </button>

            {/* Poster column */}
            <div 
              className="modal-poster-wrap"
              style={{ width: '40%', position: 'relative', background: '#222' }}
            >
              {selectedEvent.cover ? (
                <img 
                  src={selectedEvent.cover} 
                  alt={selectedEvent.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1714 0%, #3a322c 100%)', color: '#fff', padding: '40px', textAlign: 'center', fontSize: '1.3rem', fontFamily: 'var(--serif)' }}>
                  {selectedEvent.title}
                </div>
              )}
            </div>

            {/* Content column */}
            <div style={{ width: '60%', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '85vh', overflow: 'hidden' } as any}>
              <div style={{ padding: '36px', overflowY: 'auto', flex: 1 }}>
                
                {/* Category & Status */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    {selectedEvent.category}
                  </span>
                  <span style={{ height: '4px', width: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', background: getStatusColor(selectedEvent.status || '모집중').bg, color: getStatusColor(selectedEvent.status || '모집중').text }}>
                    {selectedEvent.status || '모집중'}
                  </span>
                </div>

                {/* Title */}
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.4, color: 'var(--text)', marginBottom: '24px' }}>
                  {selectedEvent.title}
                </h2>

                {/* Event Schedule Info */}
                <div style={{ background: 'var(--bg-warm)', padding: '20px', borderRadius: '12px', marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, width: '60px', color: 'var(--text-mid)' }}>일시</span>
                    <span style={{ color: 'var(--text)' }}>{selectedEvent.date}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, width: '60px', color: 'var(--text-mid)' }}>장소</span>
                    <span style={{ color: 'var(--text)' }}>{selectedEvent.location}</span>
                  </div>
                  {selectedEvent.capacity && (
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, width: '60px', color: 'var(--text-mid)' }}>인원</span>
                      <span style={{ color: 'var(--text)' }}>{selectedEvent.capacity}</span>
                    </div>
                  )}
                  {selectedEvent.announcement_date && (
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, width: '60px', color: 'var(--text-mid)' }}>발표</span>
                      <span style={{ color: 'var(--text)' }}>{selectedEvent.announcement_date}</span>
                    </div>
                  )}
                </div>

                {/* Detailed Description */}
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-mid)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>
                    상세 내용
                  </h4>
                  <div 
                    className="modal-body-content"
                    style={{ fontSize: '0.9rem', lineHeight: '1.75', color: 'var(--text-mid)' }}
                    dangerouslySetInnerHTML={{ __html: selectedEvent.description || '이벤트 설명이 준비 중입니다.' }}
                  />
                </div>
              </div>

              {/* Sticky Apply Button Bar */}
              <div style={{ padding: '24px 36px', borderTop: '1px solid var(--border)', background: '#fff', display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => closeDetail()}
                  style={{ flex: 1, padding: '14px 20px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', borderRadius: '12px', fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  닫기
                </button>
                {selectedEvent.status !== '종료' ? (
                  appliedEventIds.has(selectedEvent.id) ? (
                    <button 
                      onClick={handleEventApply}
                      disabled={applying}
                      style={{ flex: 2, padding: '14px 20px', border: '1.5px solid var(--accent)', background: 'rgba(252,102,64,0.06)', color: 'var(--accent)', borderRadius: '12px', fontSize: '0.92rem', fontWeight: 600, cursor: applying ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: applying ? 0.7 : 1 }}
                    >
                      {applying ? '취소 중...' : '✔ 신청완료 · 취소하기'}
                    </button>
                  ) : (
                    <button 
                      onClick={handleEventApply}
                      disabled={applying}
                      style={{ flex: 2, padding: '14px 20px', border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: '12px', fontSize: '0.92rem', fontWeight: 600, cursor: applying ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: applying ? 0.7 : 1 }}
                    >
                      {applying ? '신청 중...' : '이벤트 참여 신청하기'}
                    </button>
                  )
                ) : (
                  <button 
                    disabled
                    style={{ flex: 2, padding: '14px 20px', border: 'none', background: 'var(--text-muted)', color: '#fff', borderRadius: '12px', fontSize: '0.92rem', fontWeight: 600, cursor: 'not-allowed' }}
                  >
                    종료된 이벤트입니다
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
