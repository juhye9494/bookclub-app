"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  has_paid: boolean;
  created_at: string;
}

interface Order {
  id: string;
  user_id: string;
  cycle_id: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
}

interface BookOrder {
  id: string;
  user_id: string;
  cycle_id: string;
  order_status: string;
  created_at: string;
  book_order_items: { id: string; book_title_snapshot: string; }[];
}

export default function MembersManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookOrders, setBookOrders] = useState<BookOrder[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'free'>('all');
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [compAccessList, setCompAccessList] = useState<any[]>([]);
  const [compCycleId, setCompCycleId] = useState('');
  const [compGrantReason, setCompGrantReason] = useState('');
  const [compLoading, setCompLoading] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, selectedCycleId]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert('로그인이 필요합니다.');
      setLoading(false);
      return;
    }

    try {
      // Fetch cycles using admin API
      const cyclesRes = await fetch('/api/admin/cycles', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const cyclesData = await cyclesRes.json();
      const cyclesList = cyclesData.cycles || [];
      setCycles(cyclesList);

      const [profilesRes, ordersRes] = await Promise.all([
        fetch('/api/admin/profiles', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: 'no-store',
        }),
        supabase.from('orders').select('*').order('created_at', { ascending: false })
      ]);

      const profilesPayload = await profilesRes.json();
      if (!profilesRes.ok) {
        if (profilesRes.status === 401) alert('로그인이 필요합니다.');
        else if (profilesRes.status === 403) alert('관리자 권한이 필요합니다.');
        else alert('회원정보를 불러오지 못했습니다.');
        setProfiles([]);
      } else {
        setProfiles(Array.isArray(profilesPayload.profiles) ? profilesPayload.profiles : []);
      }

      if (ordersRes.data) setOrders(ordersRes.data);
    } catch {
      alert('회원정보를 불러오지 못했습니다.');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedMember) {
      loadBookOrdersForMember(selectedMember.id);
      loadCompAccessForMember(selectedMember.id);
    } else {
      setBookOrders([]);
      setCompAccessList([]);
    }
  }, [selectedMember]);

  async function loadCompAccessForMember(userId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`/api/admin/complimentary-member-access?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompAccessList(data.accessList || []);
      }
    } catch (err) {
      console.error('Failed to load complimentary access:', err);
    }
  }

  async function loadBookOrdersForMember(userId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`/api/admin/book-orders?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load book orders via API:', err);
    }
  }

  function getOrdersForMember(userId: string) {
    return orders.filter(o => o.user_id === userId && o.payment_status === 'DONE' && (selectedCycleId === 'all' || o.cycle_id === selectedCycleId));
  }

  function getBookOrdersForMember(userId: string) {
    return bookOrders.filter(bo => bo.user_id === userId && (selectedCycleId === 'all' || bo.cycle_id === selectedCycleId));
  }

  function isSubscribed(userId: string) {
    return orders.some(o => o.user_id === userId && o.payment_status === 'DONE' && (selectedCycleId === 'all' || o.cycle_id === selectedCycleId));
  }

  const filteredProfiles = profiles.filter(p => {
    const matchSearch = !search ||
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.phone || '').includes(search);

    const isSub = isSubscribed(p.id);
    const matchFilter = filter === 'all' || (filter === 'subscribed' && isSub) || (filter === 'free' && !isSub);

    return matchSearch && matchFilter;
  });

  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedProfiles = filteredProfiles.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 3) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (safePage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handleStatusChange = async (bookOrderId: string, newStatus: string, cycleId: string) => {
    if (!confirm(`상태를 '${newStatus}'(으)로 변경하시겠습니까?`)) return;

    setUpdatingId(bookOrderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/book-orders/${bookOrderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '상태 변경 실패');
      } else {
        alert('상태가 변경되었습니다.');
        loadData();
      }
    } catch (e) {
      alert('요청 중 오류가 발생했습니다.');
    }
    setUpdatingId(null);
  };

  const handleGrantCompAccess = async () => {
    if (!selectedMember || !compCycleId) return;
    setCompLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/complimentary-member-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          userId: selectedMember.id,
          cycleId: compCycleId,
          grantReason: compGrantReason
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '권한 부여 실패');
      } else {
        alert('무료 이용 권한이 부여되었습니다.');
        setCompGrantReason('');
        loadCompAccessForMember(selectedMember.id);
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
    setCompLoading(false);
  };

  const handleRevokeCompAccess = async (accessId: string) => {
    const reason = prompt('권한 회수 사유를 입력하세요 (선택사항)');
    if (reason === null) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/complimentary-member-access', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          id: accessId,
          revokeReason: reason
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '권한 회수 실패');
      } else {
        alert('권한이 회수되었습니다.');
        if (selectedMember) loadCompAccessForMember(selectedMember.id);
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="이름, 이메일, 전화번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '12px', width: '300px', border: '1px solid #d1d5db', borderRadius: '8px' }}
        />
        <select value={filter} onChange={(e: any) => setFilter(e.target.value)} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <option value="all">전체 회원</option>
          <option value="subscribed">구독(결제) 회원</option>
          <option value="free">미결제 회원</option>
        </select>
        <select value={selectedCycleId} onChange={(e: any) => setSelectedCycleId(e.target.value)} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <option value="all">전체 기수</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selectedCycleId !== 'all' && (() => {
        const c = cycles.find(x => x.id === selectedCycleId);
        if (c && new Date() < new Date(c.shipping_start_date)) {
          return (
            <div style={{ padding: '16px', background: '#fff3cd', color: '#856404', borderRadius: '8px', marginBottom: '24px' }}>
              <strong>안내:</strong> {c.name} 도서는 {new Date(c.shipping_start_date).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}부터 순차 배송할 수 있습니다. 그 전에는 '주문접수' 및 '주문취소'만 가능합니다.
            </div>
          );
        }
        return null;
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: selectedMember ? '1fr 1fr' : '1fr', gap: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>이름</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>연락처</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>상태</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>가입일</th>
              </tr>
            </thead>
            <tbody>
              {pagedProfiles.map(p => (
                <tr key={p.id} onClick={() => setSelectedMember(p)} style={{ cursor: 'pointer', background: selectedMember?.id === p.id ? '#f3f4f6' : 'transparent' }}>
                  <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontWeight: 600 }}>{p.name || '이름없음'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{p.email}</div>
                  </td>
                  <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }}>{p.phone || '-'}</td>
                  <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                    {isSubscribed(p.id) ?
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>구독중</span> :
                      <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>미구독</span>}
                  </td>
                  <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem', color: '#6b7280' }}>
                    {new Date(p.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                  </td>
                </tr>
              ))}
              {pagedProfiles.length === 0 && <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>

          {/* 회원관리 페이지네이션 UI */}
          {filteredProfiles.length > 0 && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {(safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, filteredProfiles.length)} / 총 {filteredProfiles.length}명
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(safePage - 1)}
                  style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.5 : 1 }}
                >
                  이전
                </button>
                {getPageNumbers().map((pageNum, idx) => (
                  <button
                    key={idx}
                    disabled={pageNum === '...'}
                    onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      background: pageNum === safePage ? '#111827' : '#fff',
                      color: pageNum === safePage ? '#fff' : '#374151',
                      fontWeight: pageNum === safePage ? 700 : 400,
                      cursor: pageNum === '...' ? 'default' : 'pointer',
                      minWidth: '36px'
                    }}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(safePage + 1)}
                  style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.5 : 1 }}
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedMember && (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>회원 상세 정보</h2>
              <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px', marginBottom: '32px', fontSize: '0.95rem' }}>
              <div style={{ color: '#6b7280' }}>이름</div><div>{selectedMember.name}</div>
              <div style={{ color: '#6b7280' }}>이메일</div><div>{selectedMember.email}</div>
              <div style={{ color: '#6b7280' }}>연락처</div><div>{selectedMember.phone}</div>
              <div style={{ color: '#6b7280' }}>배송지</div><div>{selectedMember.address || '미입력'}</div>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>무료 회원 이용 권한</h3>
            <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <select value={compCycleId} onChange={e => setCompCycleId(e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                  <option value="">기수 선택</option>
                  {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="부여 사유 (선택)"
                  value={compGrantReason}
                  onChange={e => setCompGrantReason(e.target.value)}
                  style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', flex: 1 }}
                />
                <button
                  onClick={handleGrantCompAccess}
                  disabled={compLoading || !compCycleId || (compCycleId ? orders.some(o => o.user_id === selectedMember.id && o.cycle_id === compCycleId && o.payment_status === 'DONE') : false)}
                  style={{ padding: '8px 16px', background: (compCycleId && orders.some(o => o.user_id === selectedMember.id && o.cycle_id === compCycleId && o.payment_status === 'DONE')) ? '#9ca3af' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  권한 부여
                </button>
              </div>
              {compCycleId && orders.some(o => o.user_id === selectedMember.id && o.cycle_id === compCycleId && o.payment_status === 'DONE') && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '8px' }}>이미 유료 구독 중인 회원입니다.</div>
              )}

              {compAccessList.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>부여된 무료 권한이 없습니다.</div>
              ) : (
                compAccessList.map(acc => (
                  <div key={acc.id} style={{ padding: '16px', background: acc.revoked_at ? '#f3f4f6' : (cycles.find(c => c.id === acc.cycle_id)?.status === 'closed' || new Date() > new Date(cycles.find(c => c.id === acc.cycle_id)?.book_order_end_date || new Date(0))) ? '#f9fafb' : '#eff6ff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{cycles.find(c => c.id === acc.cycle_id)?.name || acc.cycle_id}</span>
                      {acc.revoked_at ? (
                        <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>회수됨</span>
                      ) : (
                        (() => {
                          const cycle = cycles.find(c => c.id === acc.cycle_id);
                          const isExpired = !cycle || cycle.status === 'closed' || new Date() > new Date(cycle.book_order_end_date);
                          if (isExpired) {
                            return <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>만료됨</span>;
                          }
                          return (
                            <button onClick={() => handleRevokeCompAccess(acc.id)} style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>회수</button>
                          );
                        })()
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                      부여일: {new Date(acc.granted_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} <br/>
                      부여자 ID: {acc.granted_by} <br/>
                      사유: {acc.grant_reason || '-'}
                      {acc.revoked_at && (
                        <><br/>회수일: {new Date(acc.revoked_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} <br/>회수 사유: {acc.revoke_reason || '-'}</>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>구독 결제 내역 (DONE)</h3>
            <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {getOrdersForMember(selectedMember.id).length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>해당 기수의 결제 내역이 없습니다.</div>
              ) : (
                getOrdersForMember(selectedMember.id).map(o => (
                  <div key={o.id} style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{cycles.find(c => c.id === o.cycle_id)?.name || o.cycle_id}</span>
                      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{new Date(o.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#4b5563' }}>주문번호: {o.id}</div>
                  </div>
                ))
              )}
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>도서 주문 및 배송 상태</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const memberBookOrders = getBookOrdersForMember(selectedMember.id);
                const ACTIVE_BOOK_ORDER_STATUSES = ['주문접수', '배송준비중', '배송중'];
                const activeBookOrders = memberBookOrders.filter((bo: any) =>
                  ACTIVE_BOOK_ORDER_STATUSES.includes(bo.order_status)
                );

                if (activeBookOrders.length === 0) {
                  return <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>활성 도서 주문이 없습니다.</div>;
                }

                return activeBookOrders.map(bo => {
                  const cycle = cycles.find(c => c.id === bo.cycle_id);
                  const canShip = cycle && new Date() >= new Date(cycle.shipping_start_date);

                  return (
                    <div key={bo.id} style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{cycle?.name || bo.cycle_id} 도서 주문</div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{new Date(bo.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
                        </div>
                        <div>
                          <select
                            value={bo.order_status}
                            onChange={(e) => handleStatusChange(bo.id, e.target.value, bo.cycle_id)}
                            disabled={updatingId === bo.id}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                          >
                            <option value="주문접수">주문접수</option>
                            <option value="배송준비중" disabled={!canShip}>배송준비중 {!canShip && '(제한됨)'}</option>
                            <option value="배송중" disabled={!canShip}>배송중 {!canShip && '(제한됨)'}</option>
                            <option value="배송완료" disabled={!canShip}>배송완료 {!canShip && '(제한됨)'}</option>
                            <option value="주문취소">주문취소</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '4px', fontSize: '0.9rem' }}>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {(bo.book_order_items || []).map((item: any, idx: number) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>{item.book_title_snapshot}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
