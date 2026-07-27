"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMemberAccess } from '@/hooks/useMemberAccess';
import { isAdmin } from '@/utils/admin';
import { formatKoreanDate } from '@/utils/dateFormatter';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import './groups.css';

const normalizeOpenChatUrl = (value?: string | null) => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.hostname !== 'open.kakao.com') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

function GroupQueryHandler({ groups, onSelect }: { groups: any[], onSelect: (g: any) => void }) {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const handledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id || groups.length === 0) return;
    if (handledIdRef.current === id) return;

    handledIdRef.current = id;

    const target = groups.find(g => String(g.id) === id);
    if (target) {
      onSelect(target);
    }
  }, [id, groups, onSelect]);

  return null;
}

const INITIAL_GROUPS = [
  {
    id: 'group-1',
    title: '직장인 경제 전망 & 재테크 공부방',
    desc: '매주 목요일 저녁, 이번 기수 선정 도서인 [사이클 투자 법칙]을 필두로 거시 경제 지표 분석 및 투자 스터디를 함께 나눕니다.',
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
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingCreateGroup, setPendingCreateGroup] = useState(false);
  const [currentTab, setCurrentTab] = useState<'전체' | '모집중'>('전체');
  const [isRequestAuthorOpen, setIsRequestAuthorOpen] = useState(false);
  const [myMemberships, setMyMemberships] = useState<Set<string>>(new Set());
  const [myCreatedGroups, setMyCreatedGroups] = useState<Set<string>>(new Set());
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
  const [newOpenChatUrl, setNewOpenChatUrl] = useState('');
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const [authorName, setAuthorName] = useState('');
  const [authorBook, setAuthorBook] = useState('');
  const [authorReason, setAuthorReason] = useState('');

  const [user, setUser] = useState<any>(null);
  const { access, loading: accessLoading } = useMemberAccess(user);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && pendingCreateGroup && !accessLoading) {
      if (access?.canAccessMemberFeatures) {
        setIsCreateOpen(true);
      } else {
        if (access?.accessState === 'beforeBookOrderPeriod') {
          const formattedDate = formatKoreanDate(access.bookOrderStartDate);
          if (!formattedDate) {
            alert('이용 기간이 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.');
          } else {
            alert(`독서모임 개설 및 참여는 도서 주문 기간부터 가능합니다.\n이용 시작일: ${formattedDate}`);
          }
        } else if (access?.accessState === 'afterBookOrderPeriod') {
          alert('이번 기수의 독서모임 개설 및 참여 기간이 종료되었습니다.');
        } else if (access?.accessState === 'cycleScheduleMissing') {
          alert('이용 기간이 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.');
        } else {
          alert('구독 회원만 이용할 수 있는 기능입니다.');
        }
      }
      setPendingCreateGroup(false);
    }
  }, [user, pendingCreateGroup, accessLoading, access]);
  
  // Selected group for detail view modal
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const closeCreateModal = () => {
    setEditingGroup(null);
    setNewTitle(''); setNewDesc(''); setNewBook(''); setNewLeader('');
    setNewMax('8'); setNewTags(''); setNewPlace(''); setNewTime(''); setNewIntro(''); setNewOpenChatUrl('');
    setIsCreateOpen(false);
  };

  const closeDetail = () => {
    setSelectedGroup(null);
    const params = new URLSearchParams(window.location.search);
    if (params.has('id')) {
      router.replace('/groups', { scroll: false });
    }
  };
  
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGuideOpen(false);
        closeCreateModal();
        closeDetail();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from('groups')
      .select('id, title, desc, book, leader, maxMembers, membersCount, tags, perks, place, time, status, created_at, creator_id, intro')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      console.error('Groups fetch error:', error);
      return false;
    }

    setGroups(data ?? []);
    return true;
  };

  useEffect(() => {
    // Supabase 정식 전환에 따라 불필요한 기존 폴백 캐시 영구 제거
    localStorage.removeItem('bookclub_groups');
    localStorage.removeItem('my_created_groups');
    localStorage.removeItem('group_memberships');

    const fetchInitialData = async () => {
      // 1. 모임 전체 목록 최신화
      await fetchGroups();

      // 2. 로그인 여부에 따른 내 상태 갱신
      if (user) {
        // 내 참가 목록 최신화
        const { data: myParts } = await supabase
          .from('group_participants')
          .select('group_id')
          .eq('user_id', user.id)
          .eq('role', 'member');
        
        if (myParts) {
          setMyMemberships(new Set(myParts.map(p => p.group_id)));
        }

        // 내가 만든 모임 최신화 (전체 목록에서 필터링하기 위해 DB에서 직접 조회)
        const { data: createdGroups } = await supabase
          .from('groups')
          .select('id')
          .eq('creator_id', user.id);
        
        if (createdGroups) {
          setMyCreatedGroups(new Set(createdGroups.map(g => g.id)));
        }
      } else {
        // 로그아웃 상태일 땐 빈 Set으로 초기화
        setMyMemberships(new Set());
        setMyCreatedGroups(new Set());
      }
    };

    fetchInitialData();
  }, [user]); // user가 바뀔 때(로그인/로그아웃) 다시 불러옵니다.

  const handleJoin = async (groupId: string) => {
    if (isJoining) return;
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } }));
      return;
    }
    const targetGroup = groups.find(g => g.id === groupId);
    if (!targetGroup) return;

    if (targetGroup.creator_id === user.id) {
      alert('직접 만든 독서모임은 참가 취소할 수 없습니다. 모임을 종료하려면 삭제 기능을 이용해주세요.');
      return;
    }

    if (!myMemberships.has(groupId)) {
      if (accessLoading) return;

      if (!access) {
        alert('권한 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      if (access.accessState === 'beforeBookOrderPeriod') {
        const formattedDate = formatKoreanDate(access.bookOrderStartDate);
        if (!formattedDate) {
          alert('이용 기간이 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.');
        } else {
          alert(`독서모임 개설 및 참여는 도서 주문 기간부터 가능합니다.\n이용 시작일: ${formattedDate}`);
        }
        return;
      }
      if (access.accessState === 'afterBookOrderPeriod') {
        alert('이번 기수의 독서모임 개설 및 참여 기간이 종료되었습니다.');
        return;
      }
      if (access.accessState === 'cycleScheduleMissing') {
        alert('이용 기간이 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.');
        return;
      }
      if (access.accessState === 'subscriptionRequired') {
        alert('구독 회원만 이용할 수 있는 기능입니다.');
        return;
      }
    }

    setIsJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const method = myMemberships.has(groupId) ? 'DELETE' : 'POST';
      const res = await fetch(`/api/groups/${groupId}/membership`, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const resData = await res.json();
      
      if (!res.ok) {
        alert(method === 'DELETE' ? '참가 취소 중 오류가 발생했습니다: ' + (resData.error || '') : '참가 신청 실패: ' + (resData.error || ''));
        await fetchGroups();
        return;
      }

      await fetchGroups();
      const { data: myParts } = await supabase.from('group_participants').select('group_id').eq('user_id', user.id).eq('role', 'member');
      if (myParts) setMyMemberships(new Set(myParts.map(p => p.group_id)));
      
      alert(method === 'DELETE' ? '독서모임 탈퇴가 완료되었습니다.' : '독서모임 참가 신청이 완료되었습니다! 마이페이지에서 접수 내역을 확인하실 수 있습니다.');
    } catch (err: any) {
      alert('오류가 발생했습니다: ' + err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleOpenCreateGroup = () => {
    if (!user) {
      setPendingCreateGroup(true);
      window.dispatchEvent(
        new CustomEvent('open-login', {
          detail: { mode: 'login' },
        })
      );
      return;
    }
    
    if (accessLoading) {
      return;
    }

    if (!access) {
      alert('권한 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (access.accessState === 'beforeBookOrderPeriod') {
      const formattedDate = formatKoreanDate(access.bookOrderStartDate);
      if (!formattedDate) {
        alert('이용 기간이 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.');
      } else {
        alert(`독서모임 개설 및 참여는 도서 주문 기간부터 가능합니다.\n이용 시작일: ${formattedDate}`);
      }
      return;
    }
    if (access.accessState === 'afterBookOrderPeriod') {
      alert('이번 기수의 독서모임 개설 및 참여 기간이 종료되었습니다.');
      return;
    }
    if (access.accessState === 'cycleScheduleMissing') {
      alert('이용 기간이 아직 설정되지 않았습니다.\n관리자에게 문의해주세요.');
      return;
    }
    if (access.accessState === 'subscriptionRequired') {
      alert('구독 회원만 이용할 수 있는 기능입니다.');
      return;
    }

    setEditingGroup(null);
    setNewTitle(''); setNewDesc(''); setNewBook(''); setNewLeader('');
    setNewMax('8'); setNewTags(''); setNewPlace(''); setNewTime(''); setNewIntro(''); setNewOpenChatUrl('');
    setIsCreateOpen(true);
  };

  const saveOpenChatUrl = async (groupId: string, openChatUrl: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('AUTH_REQUIRED');
    }
    const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/open-chat`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ open_chat_url: openChatUrl })
    });
    if (!response.ok) {
      throw new Error(`OPEN_CHAT_SAVE_FAILED_${response.status}`);
    }
  };

  const handleCreateGroup = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'login' } }));
      return;
    }
    if (accessLoading || !access?.canAccessMemberFeatures) {
      alert('구독 회원만 이용할 수 있는 기능입니다.');
      return;
    }
    if (!newTitle || !newDesc || !newBook || !newLeader) {
      alert('모든 필수 정보를 입력해 주세요.');
      return;
    }

    let finalChatUrl: string | null = null;
    if (newOpenChatUrl.trim()) {
      finalChatUrl = normalizeOpenChatUrl(newOpenChatUrl);
      if (!finalChatUrl) {
        alert('올바른 카카오톡 오픈채팅방 링크를 입력해 주세요.');
        return;
      }
    }

    const groupId = 'group-' + Date.now();
    const maxMembersNum = parseInt(newMax) || 8;
    const parsedTags = newTags.split(',').map((t: string) => t.trim()).filter(Boolean);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        p_id: groupId,
        p_title: newTitle,
        p_desc: newDesc,
        p_book: newBook,
        p_leader: newLeader,
        p_max_members: maxMembersNum,
        p_tags: parsedTags,
        p_perks: ['커피값 지원 신청가능'],
        p_place: newPlace || null,
        p_time: newTime || null,
        p_intro: newIntro || null
      })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      alert('독서모임 생성 중 오류가 발생했습니다: ' + (errData.error || ''));
      return;
    }

    if (finalChatUrl) {
      try {
        await saveOpenChatUrl(groupId, finalChatUrl);
      } catch (err) {
        alert('독서모임은 생성되었지만 오픈채팅방 링크 저장에 실패했습니다.');
        return;
      }
    }

    await fetchGroups();
    const { data: createdGroups } = await supabase.from('groups').select('id').eq('creator_id', user.id);
    if (createdGroups) setMyCreatedGroups(new Set(createdGroups.map(g => g.id)));

    const { data: myParts } = await supabase.from('group_participants').select('group_id').eq('user_id', user.id).eq('role', 'member');
    if (myParts) setMyMemberships(new Set(myParts.map(p => p.group_id)));

    setNewTitle(''); setNewDesc(''); setNewBook(''); setNewLeader('');
    setNewMax('8'); setNewTags(''); setNewPlace(''); setNewTime(''); setNewIntro(''); setNewOpenChatUrl('');
    setIsCreateOpen(false);

    alert('독서모임이 성공적으로 생성되었습니다!');
  };

  const handleEditGroup = async () => {
    if (!editingGroup) return;

    let finalChatUrl: string | null = null;
    if (newOpenChatUrl.trim()) {
      const url = newOpenChatUrl.trim();
      if (!url.startsWith('https://open.kakao.com/')) {
        alert('올바른 카카오톡 오픈채팅방 링크를 입력해 주세요.');
        return;
      }
      finalChatUrl = url;
    }

    const updatedFields = {
      title: newTitle, desc: newDesc, book: newBook, leader: newLeader, maxMembers: parseInt(newMax) || 8, tags: newTags.split(',').map((t: string) => t.trim()).filter(Boolean), place: newPlace, time: newTime, intro: newIntro
    };

    const { error: updateError } = await supabase.from('groups').update(updatedFields).eq('id', editingGroup.id);
    if (updateError) {
      alert('독서모임 수정 중 오류가 발생했습니다.');
      return;
    }

    try {
      await saveOpenChatUrl(editingGroup.id, newOpenChatUrl.trim());
    } catch (err) {
      alert('모임 정보는 수정되었지만 오픈채팅방 링크 저장에 실패했습니다.');
      return;
    }

    // 성공 시 DB에서 갱신
    await fetchGroups();

    closeCreateModal();
    alert('독서모임 정보가 수정되었습니다.');
  };

  const openEditGroup = async (group: any) => {
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
    setNewOpenChatUrl('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/groups/${group.id}/open-chat`, {
        headers: { ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }) }
      });
      if (res.ok) {
        const data = await res.json();
        setNewOpenChatUrl(data.url || '');
        setIsCreateOpen(true);
      } else if (res.status === 404) {
        setNewOpenChatUrl('');
        setIsCreateOpen(true);
      } else if (res.status === 401) {
        alert('로그인이 필요합니다.');
      } else if (res.status === 403) {
        alert('권한이 없습니다.');
      } else {
        alert('오픈채팅방 링크를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (err) {
      alert('오픈채팅방 링크를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('이 독서모임을 삭제하시겠습니까?')) return;
    
    // 외래키 CASCADE 덕분에 groups만 지워도 participants 연쇄 삭제됨. select('id')로 실 삭제건수 검증
    const { data: deletedRows, error: groupError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)
      .select('id');
    
    if (groupError || !deletedRows || deletedRows.length !== 1) {
      console.error(groupError);
      alert('모임 삭제할 내역을 찾지 못했거나 권한 오류가 발생했습니다.');
      return;
    }
    
    // 성공 시 DB에서 다시 갱신
    await fetchGroups();

    const updatedCreated = new Set(myCreatedGroups);
    updatedCreated.delete(groupId);
    setMyCreatedGroups(updatedCreated);
    alert('모임이 정상적으로 삭제되었습니다.');
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
      
      <Suspense fallback={null}>
        <GroupQueryHandler groups={groups} onSelect={setSelectedGroup} />
      </Suspense>

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
        
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <button 
            onClick={() => setIsGuideOpen(true)}
            style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '100px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
          >
            + 내용 자세히 보기
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 5vw 120px' }}>
        
        {/* Buttons Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              독서모임 목록
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setCurrentTab('전체')}
                style={{
                  padding: '8px 16px', borderRadius: '30px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  background: currentTab === '전체' ? 'var(--accent)' : '#fff',
                  color: currentTab === '전체' ? '#fff' : 'var(--text-mid)',
                  borderColor: currentTab === '전체' ? 'var(--accent)' : 'var(--border)'
                }}>
                전체 ({groups.length})
              </button>
              <button 
                onClick={() => setCurrentTab('모집중')}
                style={{
                  padding: '8px 16px', borderRadius: '30px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  background: currentTab === '모집중' ? 'var(--accent)' : '#fff',
                  color: currentTab === '모집중' ? '#fff' : 'var(--text-mid)',
                  borderColor: currentTab === '모집중' ? 'var(--accent)' : 'var(--border)'
                }}>
                모집중 ({groups.filter(g => !(g.status === '모집마감' || g.membersCount >= g.maxMembers)).length})
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link 
              href="/inquiry?category=저자 섭외 문의"
              className="groups-btn-outline"
            >
              🎙 저자 섭외 건의하기
            </Link>
            <button 
              className="groups-create-submit-btn"
              onClick={handleOpenCreateGroup}
              disabled={accessLoading}
              aria-disabled={user && !accessLoading && !access?.canAccessMemberFeatures ? true : undefined}
              style={user && !accessLoading && !access?.canAccessMemberFeatures ? { background: '#9ca3af', borderColor: '#9ca3af', color: '#fff' } : {}}
            >
              {accessLoading ? '권한 확인 중...' : '＋ 독서모임 만들기'}
            </button>
          </div>
        </div>

        {/* Groups Grid */}
        <div className="groups-grid">
          {groups
            .filter(group => {
              if (currentTab === '전체') return true;
              const isClosed = group.status === '모집마감' || group.membersCount >= group.maxMembers;
              return !isClosed;
            })
            .map(group => {
            const isMember = myMemberships.has(group.id);
            const isFull = group.membersCount >= group.maxMembers;
            const isCreator = user?.id === group.creator_id;
            
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

                  {/* Title */}
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text)', lineHeight: 1.35 }}>
                    {group.title}
                  </h3>

                  {/* Metadata fields */}
                  <div style={{ background: 'var(--bg-warm)', padding: '14px 18px', borderRadius: '10px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div>📖 <strong>도서 :</strong> {group.book}</div>
                    <div>👑 <strong>인원 :</strong> <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{group.membersCount}명</span> / {group.maxMembers}명</div>
                    {group.place && <div>📍 <strong>장소 :</strong> {group.place}</div>}
                    {group.time && <div>🕒 <strong>시간 :</strong> {group.time}</div>}
                  </div>
                </div>

                <div className="groups-actions">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); }}
                    className="group-detail-action-btn"
                    style={{ padding: '10px', background: '#f3f4f6', color: '#374151', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, width: '100%', marginBottom: '8px', border: 'none', cursor: 'pointer' }}
                  >
                    🔍 모임 자세히 보기
                  </button>
                  {isCreator ? (
                    <div className="creator-badge" style={{ padding: '10px', background: '#eef2ff', color: '#4f46e5', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, width: '100%', marginBottom: '8px', textAlign: 'center' }}>
                      👑 내가 만든 독서모임
                    </div>
                  ) : isMember ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleJoin(group.id); }}
                      className="group-main-action-btn"
                    >
                      ✓ 가입됨 (참가 취소하기)
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleJoin(group.id); }}
                      disabled={isFull || accessLoading}
                      className="group-main-action-btn"
                    >
                      {accessLoading ? '권한 확인 중...' : isFull ? '정원 마감' : '독서모임 참가 신청'}
                    </button>
                  )}
                  {isAdmin(user?.email) && (
                    <div className="groups-admin-actions">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditGroup(group); }}
                      className="group-edit-btn"
                    >
                      ✏️ 수정
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                      className="group-delete-btn"
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
        {groups.filter(group => currentTab === '전체' ? true : !(group.status === '모집마감' || group.membersCount >= group.maxMembers)).length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#8a8478', border: '1px dashed #cfc8b8', borderRadius: '8px', margin: '20px 0' }}>
            현재 모집 중인 독서모임이 없습니다.
          </div>
        )}

       </main>
{selectedGroup && (
  <div className="groups-detail-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}>
    <div className="groups-detail-modal" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
      <button className="groups-detail-close" onClick={closeDetail}>✕</button>
      
      {/* 상단: 상태, 태그, 제목 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {selectedGroup.tags?.map((t: string) => (
            <span key={t} style={{ fontSize: '0.7rem', background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>#{t}</span>
          ))}
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedGroup.status === '모집중' ? 'var(--accent)' : '#8c8c8c' }}>
          ● {selectedGroup.status}
        </span>
      </div>
      <h3 style={{ marginTop: 0, fontSize: '1.4rem', fontWeight: 700, marginBottom: '24px' }}>{selectedGroup.title}</h3>
      
      {/* 기본 정보 2열 구조 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-warm)', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.9rem' }}>
        <div>📖 <strong style={{color: '#475569'}}>도서:</strong> {selectedGroup.book}</div>
        <div>👑 <strong style={{color: '#475569'}}>인원:</strong> {selectedGroup.membersCount}/{selectedGroup.maxMembers}명</div>
        <div>👤 <strong style={{color: '#475569'}}>방장:</strong> {selectedGroup.leader}</div>
        {selectedGroup.place && <div>📍 <strong style={{color: '#475569'}}>장소:</strong> {selectedGroup.place}</div>}
        {selectedGroup.time && <div style={{ gridColumn: '1 / -1' }}>🕒 <strong style={{color: '#475569'}}>시간:</strong> {selectedGroup.time}</div>}
      </div>
      


      {/* 방장 소개 */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>👤 방장 소개</h4>
        <div style={{ 
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px',
          whiteSpace: 'pre-wrap', wordBreak: 'keep-all', overflowWrap: 'break-word', lineHeight: 1.7, color: '#475569', fontSize: '0.95rem'
        }}>
          {selectedGroup.desc ? selectedGroup.desc : <span style={{ color: '#94a3b8' }}>등록된 소개글이 없습니다.</span>}
        </div>
      </div>

      {/* 모임 소개 */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>📖 모임 소개</h4>
        <div style={{ 
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px',
          whiteSpace: 'pre-wrap', wordBreak: 'keep-all', overflowWrap: 'break-word', lineHeight: 1.7, color: '#475569', fontSize: '0.95rem'
        }}>
          {selectedGroup.intro ? selectedGroup.intro : <span style={{ color: '#94a3b8' }}>등록된 소개글이 없습니다.</span>}
        </div>
      </div>

      {/* 오픈채팅방 참여하기 */}
      <div style={{ marginBottom: '24px' }}>
        {(() => {
          const isApplied = user && myMemberships.has(selectedGroup.id);
          const isClosed = selectedGroup.membersCount >= selectedGroup.maxMembers || selectedGroup.status === '모집마감';

          if (isClosed) {
            return (
              <button type="button" disabled style={{ width: '100%', padding: '14px 24px', background: '#e5e7eb', color: '#9ca3af', fontWeight: 700, borderRadius: '8px', cursor: 'not-allowed', border: 'none', fontSize: '1rem' }}>
                💬 모집이 마감되었습니다
              </button>
            );
          }

          if (!isApplied) {
            return (
              <button type="button" disabled style={{ width: '100%', padding: '14px 24px', background: '#e5e7eb', color: '#9ca3af', fontWeight: 700, borderRadius: '8px', cursor: 'not-allowed', border: 'none', fontSize: '1rem' }}>
                💬 참가 신청 후 오픈채팅방 입장 가능
              </button>
            );
          }

          return (
            <button 
              type="button" 
              disabled={isOpeningChat}
              onClick={async () => {
                const popup = window.open('', '_blank');
                if (!popup) {
                  alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.');
                  return;
                }
                
                setIsOpeningChat(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const res = await fetch(`/api/groups/${selectedGroup.id}/open-chat`, {
                    headers: { ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }) }
                  });
                  if (!res.ok) {
                    popup.close();
                    if (res.status === 404) {
                      alert('등록된 오픈채팅방 링크가 없습니다.');
                    } else {
                      alert('독서모임 참가 신청 후 이용하시거나 모집이 마감되어 오픈채팅방에 입장할 수 없습니다.');
                    }
                    return;
                  }
                  const data = await res.json();
                  popup.opener = null;
                  popup.location.href = data.url;
                } catch (err) {
                  popup.close();
                  alert('오픈채팅방을 여는 중 오류가 발생했습니다.');
                } finally {
                  setIsOpeningChat(false);
                }
              }}
              style={{ width: '100%', padding: '14px 24px', background: isOpeningChat ? '#e5e7eb' : '#fee500', color: isOpeningChat ? '#9ca3af' : '#191919', fontWeight: 700, borderRadius: '8px', cursor: isOpeningChat ? 'not-allowed' : 'pointer', border: 'none', fontSize: '1rem' }}
            >
              {isOpeningChat ? '오픈채팅방 여는 중...' : '💬 오픈채팅방 참여하기'}
            </button>
          );
        })()}
      </div>

      {/* 상세 참가 버튼 (오픈채팅방 아래로 이동 및 디자인 통일) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        {(() => {
          const isApplied = user && myMemberships.has(selectedGroup.id);
          const isClosed = selectedGroup.membersCount >= selectedGroup.maxMembers || selectedGroup.status === '모집마감';

          if (isJoining) {
            return (
              <button disabled className="group-main-action-btn" style={{ background: '#f3f4f6', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                처리 중...
              </button>
            );
          }

          if (isClosed) {
            return (
              <button disabled className="group-main-action-btn" style={{ background: '#f3f4f6', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                모집 마감
              </button>
            );
          }

          if (isApplied) {
            return (
              <button 
                onClick={() => handleJoin(selectedGroup.id)}
                className="group-main-action-btn"
                style={{ borderColor: '#ef4444', color: '#ef4444' }}
              >
                참가 신청 취소
              </button>
            );
          }

          return (
            <button 
              onClick={() => handleJoin(selectedGroup.id)}
              className="group-main-action-btn"
              disabled={accessLoading}
            >
              {accessLoading ? '권한 확인 중...' : '독서모임 참가 신청'}
            </button>
          );
        })()}
      </div>
    </div>
  </div>
)}

      {/* CREATE GROUP MODAL */}
      {isCreateOpen && (
        <div className="groups-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}>
          <div className="groups-modal" style={{ width: 'min(520px, 92vw)' }}>
            <button className="groups-detail-close" onClick={closeCreateModal}>✕</button>
            <h3>{editingGroup ? '독서모임 정보 수정' : '새 독서모임 개설 신청'}</h3>
            <p className="modal-sub">{editingGroup ? '독서모임 정보를 수정합니다.' : '한경 언더라인 회원들과 함께 나눌 새로운 공간을 만듭니다.'}</p>

            <div className="groups-form-field">
              <label>독서모임 명칭 *</label>
              <input type="text" placeholder="예: CES 2026 테크 트렌드 분석 모임" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            
            <div className="groups-form-field">
              <label>방장 소개 *</label>
              <input type="text" placeholder="방장님의 관심 분야나 모임 운영 경험을 간단히 소개해 주세요." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>

            <div className="groups-form-field">
              <label>읽을 책 *</label>
              <input type="text" placeholder="이번 기수 도서명 (예: 사이클 투자 법칙)" value={newBook} onChange={(e) => setNewBook(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="groups-form-field">
                <label>개설 방장 이름 *</label>
                <input type="text" placeholder="홍길동" value={newLeader} onChange={(e) => setNewLeader(e.target.value)} />
              </div>
              <div className="groups-form-field">
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
              <div className="groups-form-field">
                <label>장소</label>
                <input type="text" placeholder="예: 송파구 가락투구" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} />
              </div>
              <div className="groups-form-field">
                <label>시간</label>
                <input type="text" placeholder="예: 8.8(토) 오전 10:00" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>

            <div className="groups-form-field">
              <label>독서모임 태그 (쉼표로 구분)</label>
              <input type="text" placeholder="예: 재테크, 직장인, 강남역" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
            </div>

            {/* 소개글 작성 */}
            <div className="groups-form-field">
              <label>모임 소개글</label>
              <div style={{ background: '#f9fafb', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.7 }}>
                <p style={{ fontWeight: 700, color: '#374151', marginBottom: '6px' }}>✍️ 작성 안내</p>
                <p>1. 독서모임의 주제와 운영 방식, 활동 계획 등을 자유롭게 소개해 주세요.</p>
                <p>2. 방장님께서는 회원 간 원활한 소통을 위해 카카오톡 오픈채팅방을 개설해 주세요. 오픈채팅방 링크는 아래 전용 입력란에 입력해 주세요.</p>
                <p>3. 원활한 모임 운영을 위해 광고성 게시물이나 영업 목적의 글은 별도 안내 없이 삭제될 수 있습니다.</p>
              </div>
              <textarea 
                placeholder="독서모임의 주제, 운영 방식, 활동 계획 등을 자세히 소개해 주세요.

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

            <div className="groups-form-field">
              <label>오픈채팅방 링크</label>
              <input 
                type="url" 
                placeholder="https://open.kakao.com/o/..." 
                value={newOpenChatUrl} 
                onChange={(e) => setNewOpenChatUrl(e.target.value)} 
                style={{ width: '100%', padding: '14px 16px', border: '1.5px solid var(--border)', borderRadius: '12px', outline: 'none', fontSize: '0.92rem' }}
              />
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '6px' }}>독서모임 참여자들이 입장할 수 있는 카카오톡 오픈채팅방 링크를 입력해 주세요.</p>
            </div>

            <button type="submit" className="groups-create-submit-btn" onClick={editingGroup ? handleEditGroup : handleCreateGroup} style={{ marginTop: '16px' }}>{editingGroup ? '수정 완료' : '독서모임 방 만들기'}</button>
          </div>
        </div>)}


      {/* REQUEST AUTHOR MODAL */}
      {isRequestAuthorOpen && (
        <div className="groups-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsRequestAuthorOpen(false); }}>
          <div className="groups-modal" style={{ width: 'min(500px, 92vw)' }}>
            <button className="groups-detail-close" onClick={() => setIsRequestAuthorOpen(false)}>✕</button>
            <h3>저자 섭외 요청하기</h3>
            <p className="modal-sub">독서모임에서 함께 읽고 소통하고 싶은 작가가 있으신가요? 한경에 섭외 의견을 제안하세요.</p>

            <div className="groups-form-field">
              <label>저자 이름 *</label>
              <input type="text" placeholder="예: 조윤남 저자" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
            </div>
            
            <div className="groups-form-field">
              <label>해당 도서명 *</label>
              <input type="text" placeholder="예: 사이클 투자 법칙" value={authorBook} onChange={(e) => setAuthorBook(e.target.value)} />
            </div>

            <div className="groups-form-field">
              <label>섭외 건의 사유 및 바라는 점 *</label>
              <input type="text" placeholder="예: 모임원들과 함께 저자의 투자 방향에 대한 직접 질의를 하고 싶습니다." value={authorReason} onChange={(e) => setAuthorReason(e.target.value)} />
            </div>

            <button className="groups-modal-btn" onClick={handleRequestAuthor} style={{ marginTop: '16px' }}>섭외 건의서 전송</button>
          </div>
        </div>
      )}

      {/* 운영 안내 모달 */}
      {isGuideOpen && (
        <div className="groups-detail-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsGuideOpen(false); }}>
          <div className="groups-detail-modal" style={{ maxHeight: '85vh', overflowY: 'auto', maxWidth: '600px', width: '92vw', padding: '32px', boxSizing: 'border-box', background: '#fff', borderRadius: '24px', position: 'relative' }}>
            <button className="groups-detail-close" onClick={() => setIsGuideOpen(false)}>✕</button>
            <h3 style={{ marginTop: 0, fontSize: '1.5rem', fontWeight: 700, marginBottom: '28px', textAlign: 'center' }}>독서모임 운영 안내</h3>
            
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'keep-all', lineHeight: 1.7, fontSize: '0.95rem', color: '#374151', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: 'var(--accent)', color: '#fff', borderRadius: '50%', fontSize: '0.8rem' }}>1</span>
                  참여 안내
                </div>
                <p style={{ margin: 0, paddingLeft: '32px' }}>독서모임의 경우 선착순으로 참여 가능합니다.</p>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: 'var(--accent)', color: '#fff', borderRadius: '50%', fontSize: '0.8rem' }}>2</span>
                  소통 방식
                </div>
                <p style={{ margin: 0, paddingLeft: '32px' }}>회원들은 방장이 개설한 카카오톡 오픈채팅방을 통해 모임 일정과 공지사항을 공유받고, 함께 소통하며 독서 경험을 나눌 수 있습니다.</p>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: 'var(--accent)', color: '#fff', borderRadius: '50%', fontSize: '0.8rem' }}>3</span>
                  방장 활동비 지원
                </div>
                <div style={{ paddingLeft: '32px' }}>
                  <p style={{ margin: 0, marginBottom: '8px', fontWeight: 600 }}>방장에게는 활동비 5만원이 지원됩니다.</p>
                  <ul style={{ margin: 0, paddingLeft: '24px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '8px', listStyleType: 'disc' }}>
                    <li>활동 지원은 매월 3개 팀에 한해 제공됩니다.</li>
                    <li>지원금 수령을 위해서는 운영 기간 내 독서모임을 3회 이상 진행해야 합니다.</li>
                    <li>
                      모임을 3회 이상 진행한 후, [1:1 문의] &gt; [독서모임 활동비 신청] 게시판에 활동 인증 내용을 남겨주세요.<br />
                      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>* 회차별 모임 사진 3장 이상, 기프티콘을 받을 휴대폰 번호 기재 필수</span>
                    </li>
                    <li>지원금은 모임 종료 후 활동 확인을 거쳐 남겨주신 휴대폰 번호로 네이버페이 포인트 기프티콘이 발송됩니다.</li>
                  </ul>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: 'var(--accent)', color: '#fff', borderRadius: '50%', fontSize: '0.8rem' }}>4</span>
                  저자 섭외 안내
                </div>
                <div style={{ paddingLeft: '32px' }}>
                  <p style={{ margin: 0, marginBottom: '12px', fontWeight: 600 }}>저자 섭외를 희망하는 경우 방장이 대표로 신청해주세요.</p>
                  <p style={{ margin: 0, color: '#4b5563' }}>모임 내에서 저자 섭외 의견이 있는 경우 [1:1 문의] &gt; [저자 섭외 문의]를 통해 방장이 신청해주시면 내부 검토 후 회신드리겠습니다.</p>
                </div>
              </div>

              <div style={{ marginTop: '8px', background: '#fff4c7', padding: '22px 24px', borderRadius: '12px', color: '#874600', border: '1px solid #f3cc54' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, margin: 0, marginBottom: '12px' }}>
                  ⚠️ 모두가 즐거운 모임이 될 수 있도록 함께 지켜주세요.
                </div>
                <ul style={{ margin: 0, paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', fontWeight: 400, lineHeight: 1.7, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                  <li>영업, 광고 등의 목적으로 독서모임에 참여하는 경우 참여자들의 건의를 통해 모임에서 <strong>강퇴 조치</strong>될 수 있습니다.</li>
                  <li>본 독서모임은 참가자 간 자율적인 교류를 기반으로 운영됩니다. 참가자 간 발생하는 분쟁이나 개인적인 문제에 대해서는 주최 측이 개입하거나 책임지지 않으며, 원활한 모임 운영을 위해 <strong>상호 존중과 배려</strong>를 부탁드립니다.</li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>







  );
}
