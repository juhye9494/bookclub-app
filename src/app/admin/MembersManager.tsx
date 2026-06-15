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
  user_email: string;
  user_name: string;
  selected_books: any[];
  total_amount: number;
  order_status: string;
  created_at: string;
}

export default function MembersManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'free'>('all');
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [profilesRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false })
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
    setLoading(false);
  }

  // 회원별 주문 내역 가져오기
  function getOrdersForMember(userId: string) {
    return orders.filter(o => o.user_id === userId);
  }

  // 구독 여부 확인
  function isSubscribed(userId: string) {
    return orders.some(o => o.user_id === userId);
  }

  // 필터링 + 검색
  const filteredProfiles = profiles.filter(p => {
    const matchSearch = !search || 
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.phone || '').includes(search);
    
    const matchFilter = filter === 'all' ||
      (filter === 'subscribed' && isSubscribed(p.id)) ||
      (filter === 'free' && !isSubscribed(p.id));
    
    return matchSearch && matchFilter;
  });

  const totalMembers = profiles.length;
  const subscribedMembers = profiles.filter(p => isSubscribed(p.id)).length;
  const freeMembers = totalMembers - subscribedMembers;

  // CSV 다운로드
  const downloadCSV = () => {
    if (filteredProfiles.length === 0) return;
    const headers = ['가입일', '이름', '이메일', '연락처', '주소', '구독상태', '주문수'];
    const rows = filteredProfiles.map(p => {
      const memberOrders = getOrdersForMember(p.id);
      return [
        new Date(p.created_at).toLocaleDateString(),
        p.name || '-',
        p.email || '-',
        p.phone || '-',
        `"${p.address || '-'}"`,
        isSubscribed(p.id) ? '구독회원' : '무료회원',
        memberOrders.length.toString()
      ].join(',');
    });
    const csv = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `회원목록_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>회원 데이터를 불러오는 중...</div>;

  return (
    <div>
      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '8px' }}>전체 회원</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#111' }}>{totalMembers}<span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 400 }}>명</span></p>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '8px' }}>구독 회원</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{subscribedMembers}<span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 400 }}>명</span></p>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '8px' }}>미구독 회원</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#6b7280' }}>{freeMembers}<span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 400 }}>명</span></p>
        </div>
      </div>

      {/* 검색 & 필터 & 다운로드 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="이름, 이메일, 연락처 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '3px' }}>
          {(['all', 'subscribed', 'free'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                background: filter === f ? '#fff' : 'transparent',
                color: filter === f ? '#111' : '#6b7280',
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {f === 'all' ? '전체' : f === 'subscribed' ? '구독회원' : '미구독'}
            </button>
          ))}
        </div>
        <button onClick={downloadCSV} style={{ padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
          📥 CSV 다운로드
        </button>
        <button onClick={loadData} style={{ padding: '10px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
          🔄 새로고침
        </button>
      </div>

      {/* 회원 목록 테이블 */}
      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>상태</th>
              <th style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>이름</th>
              <th style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>이메일</th>
              <th style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>연락처</th>
              <th style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>가입일</th>
              <th style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>주문</th>
              <th style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                  {search ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredProfiles.map(p => {
                const memberOrders = getOrdersForMember(p.id);
                const subscribed = memberOrders.length > 0;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700,
                        background: subscribed ? '#fef3c7' : '#f3f4f6',
                        color: subscribed ? '#92400e' : '#6b7280'
                      }}>
                        {subscribed ? '구독' : '무료'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>
                      {p.name || '-'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#374151' }}>
                      {p.email || '-'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#6b7280' }}>
                      {p.phone || '-'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#9ca3af' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#374151' }}>
                      {memberOrders.length > 0 ? `${memberOrders.length}건` : '-'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => setSelectedMember(p)}
                        style={{ padding: '5px 12px', background: '#f3f4f6', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '12px', fontSize: '0.78rem', color: '#9ca3af' }}>
        총 {filteredProfiles.length}명 표시 / 전체 {profiles.length}명
      </p>

      {/* 회원 상세 모달 */}
      {selectedMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedMember(null); }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '36px', width: 'min(560px, 92vw)', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>회원 상세 정보</h3>
              <button onClick={() => setSelectedMember(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* 기본 정보 */}
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>기본 정보</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>이름</p>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600 }}>{selectedMember.name || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>이메일</p>
                  <p style={{ fontSize: '0.92rem' }}>{selectedMember.email || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>연락처</p>
                  <p style={{ fontSize: '0.92rem' }}>{selectedMember.phone || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>가입일</p>
                  <p style={{ fontSize: '0.92rem' }}>{new Date(selectedMember.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>배송 주소</p>
                <p style={{ fontSize: '0.92rem' }}>{selectedMember.address || '미입력'}</p>
              </div>
            </div>

            {/* 주문 내역 */}
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>주문 내역</p>
              {getOrdersForMember(selectedMember.id).length === 0 ? (
                <p style={{ fontSize: '0.88rem', color: '#9ca3af', padding: '20px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px' }}>주문 내역이 없습니다.</p>
              ) : (
                getOrdersForMember(selectedMember.id).map(order => (
                  <div key={order.id} style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{new Date(order.created_at).toLocaleDateString()}</span>
                      <span style={{
                        padding: '3px 10px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700,
                        background: order.order_status === '배송완료' ? '#d1fae5' : order.order_status === '배송중' ? '#dbeafe' : '#fef3c7',
                        color: order.order_status === '배송완료' ? '#065f46' : order.order_status === '배송중' ? '#1e40af' : '#92400e'
                      }}>
                        {order.order_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#374151' }}>
                      {order.selected_books?.map((b: any, i: number) => (
                        <span key={i}>📖 {b.title}{i < order.selected_books.length - 1 ? ', ' : ''}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '6px' }}>{order.total_amount?.toLocaleString()}원</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
