"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import './groups.css';

const INITIAL_GROUPS = [
  {
    id: 'group-1',
    title: '직장인 경제 전망 & 재테크 공부방',
    desc: '매주 목요일 저녁, 이번 시즌 선정 도서인 [사이클 투자 법칙]을 필두로 거시 경제 지표 분석 및 투자 스터디를 함께 나눕니다.',
    book: '사이클 투자 법칙 (조윤남 지음)',
    leader: '김민준 (3년차 직장인)',
    membersCount: 6,
    maxMembers: 8,
    status: '모집중',
    tags: ['재테크', '경제학', '직장인'],
    perks: ['커피값 지원 대상', '모임 지원비 대상']
  },
  {
    id: 'group-2',
    title: '미술관 기행 & 예술 도서 독서모임',
    desc: '한가람 미술관 전시회 일정에 맞춰 오프라인 투어를 함께하고, 아르떼/인문 예술 관련 도서를 깊이 있게 읽으며 예술적 안목을 넓히는 소규모 모임입니다.',
    book: '덜 멍청하게 살기 위한 최소한의 철학 (라르스 스벤젠)',
    leader: '이지은 (인문학 강사)',
    membersCount: 4,
    maxMembers: 6,
    status: '모집중',
    tags: ['인문학', '전시회', '예술'],
    perks: ['아르떼 티켓 우선권', '굿즈 증정 대상']
  },
  {
    id: 'group-3',
    title: 'CES 2026 테크 트렌드 분석 모임',
    desc: 'CES 2026 도서를 읽고 실리콘밸리 트렌드, 생성형 AI의 다음 스텝, 글로벌 하드웨어 신기술 정보를 공유하며 실천 과제를 발굴해 봅니다.',
    book: 'CES 2026 (한국경제신문 엮음)',
    leader: '최용호 (테크 마케터)',
    membersCount: 8,
    maxMembers: 8,
    status: '모집마감',
    tags: ['테크', 'AI', '비즈니스'],
    perks: ['저자 온라인 스페셜 코칭']
  }
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRequestAuthorOpen, setIsRequestAuthorOpen] = useState(false);
  const [myMemberships, setMyMemberships] = useState<Set<string>>(new Set());
  const [myCreatedGroups, setMyCreatedGroups] = useState<Set<string>>(new Set());
  // Admin email whitelist for group deletion
  const adminEmails = ['shchoi@hankyung.com', 'mwd101@hankyung.com', 'mama0707@hankyung.com', 'pdh0109@hankyung.com', 'parkjh@hankyung.com', 'lygin729@hankyung.com', 'ess0317@hankyung.com', 'xn940@naver.com'];
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBook, setNewBook] = useState('');
  const [newLeader, setNewLeader] = useState('');
  const [newMax, setNewMax] = useState('8');
  const [newTags, setNewTags] = useState('');
  const [newPlace, setNewPlace] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newIntro, setNewIntro] = useState('');

  const [authorName, setAuthorName] = useState('');
  const [authorBook, setAuthorBook] = useState('');
  const [authorReason, setAuthorReason] = useState('');

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);
  // Selected group for detail view modal
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const closeDetail = () => setSelectedGroup(null);

  useEffect(() => {
    const saved = localStorage.getItem('bookclub_groups');
    if (saved) {
      setGroups(JSON.parse(saved));
    } else {
      setGroups(INITIAL_GROUPS);
      localStorage.setItem('bookclub_groups', JSON.stringify(INITIAL_GROUPS));
    }

    const savedMemberships = localStorage.getItem('group_memberships');
    if (savedMemberships) {
      setMyMemberships(new Set(JSON.parse(savedMemberships)));
    }

    const savedCreated = localStorage.getItem('my_created_groups');
    if (savedCreated) {
      setMyCreatedGroups(new Set(JSON.parse(savedCreated)));
    }
  }, []);

  const handleJoin = async (groupId: string) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } }));
      return;
    }
    const targetGroup = groups.find(g => g.id === groupId);
    if (!targetGroup) return;

    if (myMemberships.has(groupId)) {
      // Leave
      const updatedMemberships = new Set(myMemberships);
      updatedMemberships.delete(groupId);
      setMyMemberships(updatedMemberships);
      localStorage.setItem('group_memberships', JSON.stringify(Array.from(updatedMemberships)));

      const updatedGroups = groups.map(g => {
        if (g.id === groupId) {
          return { ...g, membersCount: Math.max(g.membersCount - 1, 0), status: '모집중' };
        }
        return g;
      });
      setGroups(updatedGroups);
      localStorage.setItem('bookclub_groups', JSON.stringify(updatedGroups));
      await supabase.from('group_participants').delete().eq('group_id', groupId).eq('user_id', user.id);
      alert('독서모임 탈퇴가 완료되었습니다.');
    } else {
      // Join
      if (targetGroup.membersCount >= targetGroup.maxMembers) {
        alert('이미 정원이 초과되어 참가 신청할 수 없습니다.');
        return;
      }

      const updatedMemberships = new Set(myMemberships);
      updatedMemberships.add(groupId);
      setMyMemberships(updatedMemberships);
      localStorage.setItem('group_memberships', JSON.stringify(Array.from(updatedMemberships)));

      const updatedGroups = groups.map(g => {
        if (g.id === groupId) {
          const newCount = g.membersCount + 1;
          return { ...g, membersCount: newCount, status: newCount >= g.maxMembers ? '모집마감' : '모집중' };
        }
        return g;
      });
      setGroups(updatedGroups);
      localStorage.setItem('bookclub_groups', JSON.stringify(updatedGroups));
      await supabase.from('group_participants').insert([{
        group_id: groupId,
        user_id: user.id,
        user_email: user.email,
        user_name: user.user_metadata?.name || user.email,
        role: 'member',
        group_title: targetGroup.title,
      }]);
      alert('독서모임 참가 신청이 완료되었습니다! 마이페이지에서 접수 내역을 확인하실 수 있습니다.');
    }
  };

  const handleCreateGroup = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } }));
      return;
    }
    if (!newTitle || !newDesc || !newBook || !newLeader) {
      alert('모든 필수 정보를 입력해 주세요.');
      return;
    }

    const newGroup = {
      id: 'group-' + Date.now(),
      title: newTitle,
      desc: newDesc,
      book: newBook,
      leader: newLeader,
      membersCount: 1,
      maxMembers: parseInt(newMax) || 8,
      status: '모집중',
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      perks: ['커피값 지원 신청가능'],
      place: newPlace,
      time: newTime,
      intro: newIntro,
    };

    const updated = [newGroup, ...groups];
    setGroups(updated);
    localStorage.setItem('bookclub_groups', JSON.stringify(updated));

    // Automatically join as leader
    const updatedMemberships = new Set(myMemberships);
    updatedMemberships.add(newGroup.id);
    setMyMemberships(updatedMemberships);
    localStorage.setItem('group_memberships', JSON.stringify(Array.from(updatedMemberships)));

    // Track created groups
    const updatedCreated = new Set(myCreatedGroups);
    updatedCreated.add(newGroup.id);
    setMyCreatedGroups(updatedCreated);
    localStorage.setItem('my_created_groups', JSON.stringify(Array.from(updatedCreated)));

    // DB에 방장으로 저장
    await supabase.from('group_participants').insert([{
      group_id: newGroup.id,
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.name || user.email,
      role: 'leader',
      group_title: newGroup.title,
    }]);

    // Reset forms
    setNewTitle(''); setNewDesc(''); setNewBook(''); setNewLeader('');
    setNewMax('8'); setNewTags(''); setNewPlace(''); setNewTime(''); setNewIntro('');
    setIsCreateOpen(false);

    alert('나만의 독서모임이 성공적으로 생성되었습니다! 한경 심사 후 가이드가 메일로 안내됩니다.');
  };

  const handleEditGroup = () => {
    if (!editingGroup) return;
    const updated = groups.map(g => {
      if (g.id === editingGroup.id) {
        return { ...editingGroup, title: newTitle, desc: newDesc, book: newBook, leader: newLeader, maxMembers: parseInt(newMax) || 8, tags: newTags.split(',').map((t: string) => t.trim()).filter(Boolean), place: newPlace, time: newTime, intro: newIntro };
      }
      return g;
    });
    setGroups(updated);
    localStorage.setItem('bookclub_groups', JSON.stringify(updated));
    setEditingGroup(null);
    setNewTitle(''); setNewDesc(''); setNewBook(''); setNewLeader('');
    setNewMax('8'); setNewTags(''); setNewPlace(''); setNewTime(''); setNewIntro('');
    setIsCreateOpen(false);
    alert('독서모임 정보가 수정되었습니다.');
  };

  const openEditGroup = (group: any) => {
    setEditingGroup(group);
    setNewTitle(group.title);
    setNewDesc(group.desc);
    setNewBook(group.book);
    setNewLeader(group.leader);
    setNewMax(String(group.maxMembers));
    setNewTags(group.tags.join(', '));
    setNewPlace(group.place || '');
    setNewTime(group.time || '');
    setNewIntro(group.intro || '');
    setIsCreateOpen(true);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('이 독서모임을 삭제하시겠습니까?')) return;
    // Delete related data from Supabase
    const { error: partError } = await supabase.from('group_participants').delete().eq('group_id', groupId);
    const { error: commentError } = await supabase.from('group_comments').delete().eq('group_id', groupId);
    const { error: groupError } = await supabase.from('groups').delete().eq('id', groupId);
    if (partError || commentError || groupError) {
      console.error(partError || commentError || groupError);
      alert('삭제 중 오류가 발생했습니다.');
      return;
    }
    const updated = groups.filter(g => g.id !== groupId);
    setGroups(updated);
    localStorage.setItem('bookclub_groups', JSON.stringify(updated));
    const updatedCreated = new Set(myCreatedGroups);
    updatedCreated.delete(groupId);
    setMyCreatedGroups(updatedCreated);
    localStorage.setItem('my_created_groups', JSON.stringify(Array.from(updatedCreated)));
    alert('독서모임이 삭제되었습니다.');
  };

  const handleRequestAuthor = () => {
    if (!authorName || !authorBook || !authorReason) {
      alert('모든 건의 정보를 채워주세요.');
      return;
    }
    alert(`[저자 섭외 요청 완료]\n\n요청 작가: ${authorName} 저자\n도서: ${authorBook}\n\n회원님의 요청을 검토하여 북토크 정례화 기획 시 우선 추진하도록 하겠습니다. 감사합니다!`);
    setAuthorName('');
    setAuthorBook('');
    setAuthorReason('');
    setIsRequestAuthorOpen(false);
  };

  return (
    <div style={{ background: 'var(--bg-warm)', minHeight: '100vh', fontFamily: 'var(--sans)', color: 'var(--text)', paddingTop: '64px' }}>
      
      {/* Styles */}
      <style>{`
        .group-banner {
          background: linear-gradient(135deg, #121931 0%, #303b5b 100%);
          color: #fff;
          padding: 80px 5vw;
          text-align: center;
        }
        .benefits-summary {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 24px;
          max-width: 800px;
          margin: 32px auto 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 600px) {
          .benefits-summary {
            grid-template-columns: 1fr !important;
            gap: 12px;
          }
        }
        .group-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 8px 16px rgba(0,0,0,0.03);
        }
        .group-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 32px rgba(0,0,0,0.06);
          border-color: var(--accent);
        }
      `}</style>

      {/* Hero Banner */}
      <div className="group-banner">
        <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase' }}>
          Hankyung Underline Community
        </span>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2.8rem', fontWeight: 700, marginTop: '12px', marginBottom: '16px' }}>
          독서모임 지원 센터
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.8, maxWidth: '600px', margin: '0 auto' }}>
          회원들이 직접 독서모임을 만들고 운영해보세요.<br />
          한경 언더라인은 더 풍성한 독서 경험을 위한<br />
          다양한 모임 활동을 함께 지원합니다.
        </p>

        {/* Benefits Summary Grid */}
        <div className="benefits-summary">
          <div style={{ minHeight: '80px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>👑</div>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '2px' }}>방장 활동비 지원</strong>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>독서모임 방장에게<br />활동비 5만원 지원 (매월 3팀 한정)</span>
          </div>
          <div style={{ minHeight: '80px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🎙</div>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '2px' }}>저자 섭외 지원</strong>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>모임 내 저자 섭외 요청 시<br />한경 내부 검토 후 조율</span>
          </div>
          <div style={{ minHeight: '80px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>⚠️</div>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '2px' }}>운영 안내</strong>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>영업·광고 목적 참여 시<br />강퇴 조치될 수 있습니다.</span>
          </div>
        </div>

        {/* 내용 자세히 보기 버튼 */}
        <button onClick={() => setIsDetailOpen(true)} style={{ marginTop: '20px', padding: '10px 28px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '100px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(4px)' }}>
          +내용 자세히 보기
        </button>
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 5vw 120px' }}>
        
        {/* Buttons Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            현재 가입 가능한 독서모임 목록 ({groups.length}개)
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link 
              href="/inquiry?category=저자 섭외 문의"
              style={{ padding: '12px 24px', background: '#fff', border: '1.5px solid var(--border)', color: 'var(--text-mid)', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none' }}
            >
              🎙 저자 섭외 건의하기
            </Link>
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '12px 28px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(252,102,64,0.3)' }}
            >
              ＋ 독서모임 만들기
            </button>
          </div>
        </div>

        {/* Groups Grid */}
        <div className="groups-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
          {groups.map(group => {
            const isMember = myMemberships.has(group.id);
            const isFull = group.membersCount >= group.maxMembers;
            
            return (
              <div key={group.id} className="group-card" onClick={() => setSelectedGroup(group)}>
                <div>
                  {/* Status & tags */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {group.tags.map((t: string) => (
                        <span key={t} style={{ fontSize: '0.7rem', background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>#{t}</span>
                      ))}
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: group.status === '모집중' ? 'var(--accent)' : '#8c8c8c' }}>
                      ● {group.status}
                    </span>
                  </div>

                  {/* Title & Desc */}
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text)', lineHeight: 1.35 }}>
                    {group.title}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: '20px' }}>
                    {group.desc}
                  </p>

                  {/* Metadata fields */}
                  <div style={{ background: 'var(--bg-warm)', padding: '14px 18px', borderRadius: '10px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div>📖 <strong>도서 :</strong> {group.book}</div>
                    <div>👑 <strong>인원 :</strong> <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{group.membersCount}명</span> / {group.maxMembers}명</div>
                    {group.place && <div>📍 <strong>장소 :</strong> {group.place}</div>}
                    {group.time && <div>🕒 <strong>시간 :</strong> {group.time}</div>}
                  </div>

                  {/* 방장 소개글 */}
                  {group.intro && (
                    <div style={{ padding: '16px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.85rem', lineHeight: 1.75, color: '#374151', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                      {group.intro}
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="group-actions">
<button
  onClick={(e) => { e.stopPropagation(); handleJoin(group.id); }}
  disabled={!isMember && isFull}
  className="group-button join-btn"
>
                    {isMember ? '✓ 가입됨 (참가 취소하기)' : (isFull ? '정원 마감' : '독서모임 참가 신청')}
                  </button>
                  {adminEmails.includes(user?.email) && (
                    <div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditGroup(group); }}
                      style={{ padding: '12px 16px', borderRadius: '10px', border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text-mid)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      ✏️ 수정
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                      style={{ padding: '12px 16px', borderRadius: '10px', border: '1.5px solid #fecaca', background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      🗑 삭제
                    </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </main>

      {/* CREATE GROUP MODAL */}
      {isCreateOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsCreateOpen(false); }}>
          <div className="modal" style={{ width: 'min(520px, 92vw)' }}>
            <button className="modal-close" onClick={() => setIsCreateOpen(false)}>✕</button>
            <h3>{editingGroup ? '독서모임 정보 수정' : '새 독서모임 개설 신청'}</h3>
            <p className="modal-sub">{editingGroup ? '독서모임 정보를 수정합니다.' : '한경 언더라인 회원들과 함께 나눌 새로운 공간을 만듭니다.'}</p>

            <div className="form-field">
              <label>독서모임 명칭 *</label>
              <input type="text" placeholder="예: CES 2026 테크 트렌드 분석 모임" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            
            <div className="form-field">
              <label>모임 소개 *</label>
              <input type="text" placeholder="예: 매주 화요일 밤, 미래 기술 방향을 함께 토론합니다." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>

            <div className="form-field">
              <label>읽을 책 *</label>
              <input type="text" placeholder="이번 기수 도서명 (예: 사이클 투자 법칙)" value={newBook} onChange={(e) => setNewBook(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-field">
                <label>개설 방장 이름 *</label>
                <input type="text" placeholder="홍길동" value={newLeader} onChange={(e) => setNewLeader(e.target.value)} />
              </div>
              <div className="form-field">
                <label>모집 정원 (명)</label>
                <select value={newMax} onChange={(e) => setNewMax(e.target.value)} style={{ width: '100%', padding: '12px', border: '1.5px solid var(--border)', borderRadius: '12px', outline: 'none', background: '#fff', fontSize: '0.92rem' }}>
                  <option value="4">4명</option>
                  <option value="6">6명</option>
                  <option value="8">8명 (기본)</option>
                  <option value="10">10명</option>
                  <option value="12">12명</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-field">
                <label>장소</label>
                <input type="text" placeholder="예: 송파구 가락투구" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} />
              </div>
              <div className="form-field">
                <label>시간</label>
                <input type="text" placeholder="예: 8.8(토) 오전 10:00" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>

            <div className="form-field">
              <label>독서모임 태그 (쉼표로 구분)</label>
              <input type="text" placeholder="예: 재테크, 직장인, 강남역" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
            </div>

            {/* 소개글 작성 */}
            <div className="form-field">
              <label>방장 소개글</label>
              <div style={{ background: '#f9fafb', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.7 }}>
                <p style={{ fontWeight: 700, color: '#374151', marginBottom: '6px' }}>✍️ 작성 안내</p>
                <p>1. 독서모임의 주제와 운영 방식, 활동 계획 등을 자유롭게 소개해 주세요.</p>
                <p>2. 방장님께서는 회원 간 원활한 소통을 위해 카카오톡 오픈채팅방을 개설해 주세요. 개설한 오픈채팅방 URL은 소개글 하단에 기재해 주시고, 신청한 회원들과 자유롭게 소통해 주세요.</p>
                <p>3. 원활한 모임 운영을 위해 광고성 게시물이나 영업 목적의 글은 별도 안내 없이 삭제될 수 있습니다.</p>
              </div>
              <textarea 
                placeholder="독서모임을 소개하는 글을 작성해 주세요.

ex.
안녕하세요.
8월 매주 토요일 오전 <사이클 투자 법칙>으로 독서모임을 진행하려 합니다.

이런 분들이면 모두 환영합니다!
다같이 모여 책을 읽고 이야기하는 시간을 가지면 좋을 것 같습니다." 
                value={newIntro} 
                onChange={(e) => setNewIntro(e.target.value)} 
                rows={8}
                style={{ width: '100%', padding: '14px 16px', border: '1.5px solid var(--border)', borderRadius: '12px', outline: 'none', fontSize: '0.92rem', lineHeight: 1.7, resize: 'vertical', fontFamily: 'var(--sans)', boxSizing: 'border-box' }} 
              />
            </div>

            <button className="modal-btn" onClick={editingGroup ? handleEditGroup : handleCreateGroup} style={{ marginTop: '16px' }}>{editingGroup ? '수정 완료' : '독서모임 방 만들기'}</button>
          </div>
        </div>)}


      {/* REQUEST AUTHOR MODAL */}
      {isRequestAuthorOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsRequestAuthorOpen(false); }}>
          <div className="modal" style={{ width: 'min(500px, 92vw)' }}>
            <button className="modal-close" onClick={() => setIsRequestAuthorOpen(false)}>✕</button>
            <h3>저자 섭외 요청하기</h3>
            <p className="modal-sub">독서모임에서 함께 읽고 소통하고 싶은 작가가 있으신가요? 한경에 섭외 의견을 제안하세요.</p>

            <div className="form-field">
              <label>저자 이름 *</label>
              <input type="text" placeholder="예: 조윤남 저자" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
            </div>
            
            <div className="form-field">
              <label>해당 도서명 *</label>
              <input type="text" placeholder="예: 사이클 투자 법칙" value={authorBook} onChange={(e) => setAuthorBook(e.target.value)} />
            </div>

            <div className="form-field">
              <label>섭외 건의 사유 및 바라는 점 *</label>
              <input type="text" placeholder="예: 모임원들과 함께 저자의 투자 방향에 대한 직접 질의를 하고 싶습니다." value={authorReason} onChange={(e) => setAuthorReason(e.target.value)} />
            </div>

            <button className="modal-btn" onClick={handleRequestAuthor} style={{ marginTop: '16px' }}>섭외 건의서 전송</button>
          </div>
        </div>
      )}</div>







  );
}
