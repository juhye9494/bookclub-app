"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
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
  const adminEmails = ['shchoi@hankyung.com', 'mwd101@hankyung.com', 'mama0707@hankyung.com', 'pdh0109@hankyung.com', 'parkjh@hankyung.com', 'lygin729@hankyung.com', 'ess0317@hankyung.com', 'xn940@naver.com'];
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

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

  // Auth state handling
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Escape key to close detail modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailOpen(false);
        setSelectedGroup(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Load persisted data
  useEffect(() => {
    const saved = localStorage.getItem('bookclub_groups');
    if (saved) {
      setGroups(JSON.parse(saved));
    } else {
      setGroups(INITIAL_GROUPS);
      localStorage.setItem('bookclub_groups', JSON.stringify(INITIAL_GROUPS));
    }
    const savedMemberships = localStorage.getItem('group_memberships');
    if (savedMemberships) setMyMemberships(new Set(JSON.parse(savedMemberships)));
    const savedCreated = localStorage.getItem('my_created_groups');
    if (savedCreated) setMyCreatedGroups(new Set(JSON.parse(savedCreated)));
  }, []);

  const handleJoin = async (groupId: string) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } }));
      return;
    }
    const targetGroup = groups.find(g => g.id === groupId);
    if (!targetGroup) return;

    if (myMemberships.has(groupId)) {
      const updatedMemberships = new Set(myMemberships);
      updatedMemberships.delete(groupId);
      setMyMemberships(updatedMemberships);
      localStorage.setItem('group_memberships', JSON.stringify(Array.from(updatedMemberships)));
      const updatedGroups = groups.map(g => g.id === groupId ? { ...g, membersCount: Math.max(g.membersCount - 1, 0), status: '모집중' } : g);
      setGroups(updatedGroups);
      localStorage.setItem('bookclub_groups', JSON.stringify(updatedGroups));
      await supabase.from('group_participants').delete().eq('group_id', groupId).eq('user_id', user.id);
      alert('독서모임 탈퇴가 완료되었습니다.');
    } else {
      if (targetGroup.membersCount >= targetGroup.maxMembers) {
        alert('이미 정원이 초과되어 참가 신청할 수 없습니다.');
        return;
      }
      const updatedMemberships = new Set(myMemberships);
      updatedMemberships.add(groupId);
      setMyMemberships(updatedMemberships);
      localStorage.setItem('group_memberships', JSON.stringify(Array.from(updatedMemberships)));
      const updatedGroups = groups.map(g => g.id === groupId ? { ...g, membersCount: g.membersCount + 1, status: g.membersCount + 1 >= g.maxMembers ? '모집마감' : '모집중' } : g);
      setGroups(updatedGroups);
      localStorage.setItem('bookclub_groups', JSON.stringify(updatedGroups));
      await supabase.from('group_participants').insert([{ group_id: groupId, user_id: user.id, user_email: user.email, user_name: user.user_metadata?.name || user.email, role: 'member', group_title: targetGroup.title }]);
      alert('독서모임 참가 신청이 완료되었습니다!');
    }
  };

  const handleCreateGroup = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } }));
      return;
    }
    if (!newTitle || !newDesc || !newBook || !newLeader) { alert('모든 필수 정보를 입력해 주세요.'); return; }
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
      intro: newIntro
    };
    const updated = [newGroup, ...groups];
    setGroups(updated);
    localStorage.setItem('bookclub_groups', JSON.stringify(updated));
    const updatedMemberships = new Set(myMemberships);
    updatedMemberships.add(newGroup.id);
    setMyMemberships(updatedMemberships);
    localStorage.setItem('group_memberships', JSON.stringify(Array.from(updatedMemberships)));
    await supabase.from('group_participants').insert([{ group_id: newGroup.id, user_id: user.id, user_email: user.email, user_name: user.user_metadata?.name || user.email, role: 'leader', group_title: newGroup.title }]);
    setIsCreateOpen(false);
    alert('나만의 독서모임이 생성되었습니다.');
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

  const handleEditGroup = () => {
    if (!editingGroup) return;
    const updated = groups.map(g => g.id === editingGroup.id ? { ...editingGroup, title: newTitle, desc: newDesc, book: newBook, leader: newLeader, maxMembers: parseInt(newMax) || 8, tags: newTags.split(',').map((t: string) => t.trim()).filter(Boolean), place: newPlace, time: newTime, intro: newIntro } : g);
    setGroups(updated);
    localStorage.setItem('bookclub_groups', JSON.stringify(updated));
    setEditingGroup(null);
    setIsCreateOpen(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('이 독서모임을 삭제하시겠습니까?')) return;
    await supabase.from('group_participants').delete().eq('group_id', groupId);
    const updated = groups.filter(g => g.id !== groupId);
    setGroups(updated);
    localStorage.setItem('bookclub_groups', JSON.stringify(updated));
  };

  const handleRequestAuthor = () => {
    alert('저자 섭외 요청이 접수되었습니다.');
    setIsRequestAuthorOpen(false);
  };

  return (
    <div style={{ background: 'var(--bg-warm)', minHeight: '100vh', fontFamily: 'var(--sans)', color: 'var(--text)', paddingTop: '64px' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 5vw' }}>
        <div className="group-grid">
          {groups.map(group => {
            const isMember = myMemberships.has(group.id);
            const isFull = group.membersCount >= group.maxMembers;
            return (
              <div className="group-card" onClick={() => { setSelectedGroup(group); setIsDetailOpen(true); }}>
                <h3>{group.title}</h3>
                <p>{group.desc}</p>
                <div style={{ background: '#f9fafb', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.7 }}>{group.intro}</div>
                <div className="group-actions">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleJoin(group.id); }}
                    disabled={!isMember && isFull}
                    className="group-button join-btn"
                  >
                    {isMember ? '✓ 가입됨 (참가 취소하기)' : (isFull ? '정원 마감' : '독서모임 참가 신청')}
                  </button>
                  {adminEmails.includes(user?.email) && (
                    <div className="group-admin-actions">
                      <button onClick={(e) => { e.stopPropagation(); openEditGroup(group); }} className="edit">✏️ 수정</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} className="delete">🗑 삭제</button>
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
            <div className="form-field"><label>독서모임 명칭 *</label><input type="text" placeholder="예: CES 2026 테크 트렌드 분석 모임" value={newTitle} onChange={e => setNewTitle(e.target.value)} /></div>
            <div className="form-field"><label>모임 소개 *</label><input type="text" placeholder="예: 매주 화요일 밤, 미래 기술 방향을 함께 토론합니다." value={newDesc} onChange={e => setNewDesc(e.target.value)} /></div>
            <div className="form-field"><label>읽을 책 *</label><input type="text" placeholder="예: 이번 기수 도서명 (예: 사이클 투자 법칙)" value={newBook} onChange={e => setNewBook(e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-field"><label>개설 방장 이름 *</label><input type="text" placeholder="홍길동" value={newLeader} onChange={e => setNewLeader(e.target.value)} /></div>
              <div className="form-field"><label>모집 정원 (명)</label>
                <select value={newMax} onChange={e => setNewMax(e.target.value)} style={{ width: '100%', padding: '12px', border: '1.5px solid var(--border)', borderRadius: '12px', outline: 'none', background: '#fff', fontSize: '0.92rem' }}>
                  <option value="4">4명</option>
                  <option value="6">6명</option>
                  <option value="8">8명 (기본)</option>
                  <option value="10">10명</option>
                  <option value="12">12명</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-field"><label>장소</label><input type="text" placeholder="예: 송파구 가락투구" value={newPlace} onChange={e => setNewPlace(e.target.value)} /></div>
              <div className="form-field"><label>시간</label><input type="text" placeholder="예: 8.8(토) 오전 10:00" value={newTime} onChange={e => setNewTime(e.target.value)} /></div>
            </div>
            <div className="form-field"><label>독서모임 태그 (쉼표로 구분)</label><input type="text" placeholder="예: 재테크, 직장인, 강남역" value={newTags} onChange={e => setNewTags(e.target.value)} /></div>
            <div className="form-field"><label>추가 소개 (옵션)</label><input type="text" placeholder="예: 커피값 지원 등" value={newIntro} onChange={e => setNewIntro(e.target.value)} /></div>
            <button className="modal-btn" onClick={editingGroup ? handleEditGroup : handleCreateGroup} style={{ marginTop: '16px' }}>{editingGroup ? '수정하기' : '생성하기'}</button>
          </div>
        </div>
      )}

      {/* REQUEST AUTHOR MODAL */}
      {isRequestAuthorOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsRequestAuthorOpen(false); }}>
          <div className="modal" style={{ width: 'min(500px, 92vw)' }}>
            <button className="modal-close" onClick={() => setIsRequestAuthorOpen(false)}>✕</button>
            <h3>저자 섭외 요청하기</h3>
            <p className="modal-sub">독서모임에서 함께 읽고 소통하고 싶은 작가가 있으신가요? 한경에 섭외 의견을 제안하세요.</p>
            <div className="form-field"><label>저자 이름 *</label><input type="text" placeholder="예: 조윤남 저자" value={authorName} onChange={e => setAuthorName(e.target.value)} /></div>
            <div className="form-field"><label>해당 도서명 *</label><input type="text" placeholder="예: 사이클 투자 법칙" value={authorBook} onChange={e => setAuthorBook(e.target.value)} /></div>
            <div className="form-field"><label>섭외 건의 사유 및 바라는 점 *</label><input type="text" placeholder="예: 모임원들과 함께 저자의 투자 방향에 대한 직접 질의를 하고 싶습니다." value={authorReason} onChange={e => setAuthorReason(e.target.value)} /></div>
            <button className="modal-btn" onClick={handleRequestAuthor} style={{ marginTop: '16px' }}>섭외 건의서 전송</button>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedGroup && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsDetailOpen(false); }}>
          <div className="modal" style={{ width: 'min(600px, 92vw)' }}>
            <button className="modal-close" onClick={() => setIsDetailOpen(false)}>✕</button>
            <h3>{selectedGroup.title}</h3>
            <p>{selectedGroup.desc}</p>
            <div style={{ background: '#f9fafb', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.7 }}>{selectedGroup.intro}</div>
            <div className="group-actions">
              <button
                onClick={(e) => { e.stopPropagation(); handleJoin(selectedGroup.id); }}
                disabled={!myMemberships.has(selectedGroup.id) && selectedGroup.membersCount >= selectedGroup.maxMembers}
                className="group-button join-btn"
              >
                {myMemberships.has(selectedGroup.id) ? '✓ 가입됨 (참가 취소하기)' : (selectedGroup.membersCount >= selectedGroup.maxMembers ? '정원 마감' : '독서모집 참가 신청')}
              </button>
              {adminEmails.includes(user?.email) && (
                <div className="group-admin-actions">
                  <button onClick={(e) => { e.stopPropagation(); openEditGroup(selectedGroup); }} className="edit">✏️ 수정</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(selectedGroup.id); }} className="delete">🗑 삭제</button>
                </div>
              )}
            </div>
            {/* Bottom button for join/cancel (same as above) */}
            <button
              onClick={(e) => { e.stopPropagation(); handleJoin(selectedGroup.id); }}
              disabled={!myMemberships.has(selectedGroup.id) && selectedGroup.membersCount >= selectedGroup.maxMembers}
              className="group-button join-btn"
              style={{ marginTop: '12px', width: '100%' }}
            >
              {myMemberships.has(selectedGroup.id) ? '✓ 가입됨 (참가 취소하기)' : (selectedGroup.membersCount >= selectedGroup.maxMembers ? '정원 마감' : '독서모임 참가 신청')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
