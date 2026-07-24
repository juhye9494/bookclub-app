"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Order {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_phone: string;
  user_address: string;
  book_order_items: any[];
  total_amount: number;
  order_status: string;
  tracking_number: string;
  payment_order_id: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '주문접수', color: '#f59e0b', bg: '#fef3c7' },
  { value: '배송준비중', color: '#f59e0b', bg: '#fef3c7' },
  { value: '배송중', color: '#3b82f6', bg: '#dbeafe' },
  { value: '배송완료', color: '#10b981', bg: '#d1fae5' },
  { value: '주문취소', color: '#ef4444', bg: '#fee2e2' },
];

function getStatusLabel(status: string) {
  if (status === '주문접수') return '발송대기';
  return status;
}

export default function ShippingManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [editingTracking, setEditingTracking] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    setCheckedIds(new Set());
    setLastCheckedIndex(null);
  }, [filter, currentPage]);

  async function loadOrders() {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setLoading(false);
      return;
    }
    const token = session.session.access_token;
    
    let bOrders = null;
    try {
      const res = await fetch('/api/admin/book-orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (!res.ok) {
        console.error('Failed to load orders:', data.error);
      } else {
        bOrders = data.orders;
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
    if (bOrders) {
      const mapped = bOrders.map((bo: any) => ({
        id: bo.id,
        user_id: bo.user_id,
        user_email: bo.subscription_order?.user_email || '',
        user_name: bo.shipping_name || bo.subscription_order?.user_name || '',
        user_phone: bo.shipping_phone || bo.subscription_order?.user_phone || '',
        user_address: bo.shipping_address || bo.subscription_order?.user_address || '',
        book_order_items: (bo.book_order_items || []).map((item: any) => ({ title: item.book_title_snapshot, cover: '' })),
        total_amount: bo.subscription_order?.total_amount || 45000,
        order_status: bo.order_status || '주문접수',
        tracking_number: bo.tracking_number || '',
        payment_order_id: bo.subscription_order?.payment_order_id || '',
        created_at: bo.created_at
      }));
      setOrders(mapped);
    }
    setLoading(false);
  }

  // 상태별 카운트
  const counts = {
    all: orders.length,
    '주문접수': orders.filter(o => o.order_status === '주문접수').length,
    '배송준비중': orders.filter(o => o.order_status === '배송준비중').length,
    '배송중': orders.filter(o => o.order_status === '배송중').length,
    '배송완료': orders.filter(o => o.order_status === '배송완료').length,
    '주문취소': orders.filter(o => o.order_status === '주문취소').length,
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.order_status === filter);
  
  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedOrders = filteredOrders.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

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
  // 개별 상태 변경
  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        alert('로그인이 필요합니다.');
        return;
      }
      const token = session.session.access_token;
      const res = await fetch(`/api/admin/book-orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) { alert('상태 업데이트 실패: ' + (data.error || '알 수 없는 오류')); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: newStatus } : o));
    } catch (e: any) { alert('상태 업데이트 실패: ' + e.message); }
  };

  // 일괄 상태 변경
  

  // 송장번호 저장
  const saveTracking = async (orderId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        alert('로그인이 필요합니다.');
        return;
      }
      const token = session.session.access_token;
      const res = await fetch(`/api/admin/book-orders/${orderId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tracking_number: trackingInput })
      });
      const data = await res.json();
      if (!res.ok) { alert('송장번호 저장 실패: ' + (data.error || '알 수 없는 오류')); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, tracking_number: trackingInput } : o));
      setEditingTracking(null);
      setTrackingInput('');
    } catch (e: any) { alert('송장번호 저장 실패: ' + e.message); }
  };

  // 체크박스 토글
  const handleCheck = (e: React.MouseEvent, index: number, orderId: string, isCancelled: boolean) => {
    if (isCancelled) return;
    
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastCheckedIndex !== null) {
        const start = Math.min(lastCheckedIndex, index);
        const end = Math.max(lastCheckedIndex, index);
        const isCurrentlyChecked = next.has(orderId);
        
        for (let i = start; i <= end; i++) {
          const row = pagedOrders[i];
          if (row.order_status !== '주문취소') {
            if (isCurrentlyChecked) next.delete(row.id);
            else next.add(row.id);
          }
        }
      } else {
        if (next.has(orderId)) next.delete(orderId);
        else next.add(orderId);
      }
      return next;
    });
    setLastCheckedIndex(index);
  };

  const toggleAll = () => {
    const pageIds = pagedOrders.filter(o => o.order_status !== '주문취소').map(o => o.id);
    const allChecked = pageIds.length > 0 && pageIds.every(id => checkedIds.has(id));
    
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allChecked) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // 일괄 상태 변경
  const handleBulkUpdate = async () => {
    if (checkedIds.size === 0 || !bulkStatus) return;
    if (!confirm(`선택한 ${checkedIds.size}건의 상태를 '${bulkStatus}'(으)로 변경하시겠습니까?`)) return;
    
    setIsUpdatingBulk(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      const res = await fetch('/api/admin/book-orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          order_ids: Array.from(checkedIds),
          order_status: bulkStatus
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert('일괄 상태 변경 실패: ' + (data.error || ''));
      } else {
        let msg = `${data.updated_count}건의 상태를 변경했습니다.`;
        if (data.skipped_count > 0) {
          msg += `\n${data.skipped_count}건은 주문취소 상태이거나 변경할 수 없어 제외되었습니다.`;
        }
        alert(msg);
        setCheckedIds(new Set());
        setBulkStatus('');
        loadOrders();
      }
    } catch (e: any) {
      alert('일괄 상태 변경 실패: ' + e.message);
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  // CSV 다운로드
  const downloadCSV = () => {
    const target = checkedIds.size > 0 ? orders.filter(o => checkedIds.has(o.id)) : filteredOrders;
    if (target.length === 0) return;
    const headers = ['주문일자', '주문번호', '고객명', '이메일', '연락처', '배송주소', '상태', '도서1', 'ISBN1', '도서2', 'ISBN2', '도서3', 'ISBN3'];
    const rows = target.map(order => {
      const books = order.book_order_items || [];
      return [
        new Date(order.created_at).toLocaleDateString(),
        order.payment_order_id,
        order.user_name,
        order.user_email,
        order.user_phone,
        `"${(order.user_address || '').replace(/"/g, '""')}"`,
        order.order_status,
        order.tracking_number || '',
        books[0]?.title || '', books[0]?.isbn || '',
        books[1]?.title || '', books[1]?.isbn || '',
        books[2]?.title || '', books[2]?.isbn || '',
      ].join(',');
    });
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `한경언더라인_발송목록_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusStyle = (status: string) => {
    const s = STATUS_OPTIONS.find(o => o.value === status);
    return s ? { color: s.color, background: s.bg } : { color: '#6b7280', background: '#f3f4f6' };
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>주문 데이터를 불러오는 중...</div>;

  return (
    <div>
      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: '전체', value: counts.all, icon: '📋', key: 'all' },
          { label: getStatusLabel('주문접수'), value: counts['주문접수'], icon: '⏳', key: '주문접수' },
          { label: getStatusLabel('배송준비중'), value: counts['배송준비중'], icon: '📦', key: '배송준비중' },
          { label: getStatusLabel('배송중'), value: counts['배송중'], icon: '🚚', key: '배송중' },
          { label: getStatusLabel('배송완료'), value: counts['배송완료'], icon: '📬', key: '배송완료' },
          { label: getStatusLabel('주문취소'), value: counts['주문취소'], icon: '❌', key: '주문취소' },
        ].map(item => (
          <div
            key={item.key}
            onClick={() => setFilter(item.key)}
            style={{
              background: filter === item.key ? '#1a1815' : '#fff',
              color: filter === item.key ? '#fff' : '#374151',
              padding: '16px',
              borderRadius: '12px',
              cursor: 'pointer',
              border: filter === item.key ? '1px solid #1a1815' : '1px solid #e5e7eb',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{item.icon}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '2px' }}>{item.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 액션 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', marginRight: '8px' }}>
            {checkedIds.size}건 선택
          </div>
          <select 
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            <option value="">변경할 상태 선택</option>
            <option value="주문접수">발송대기</option>
            <option value="배송준비중">배송준비중</option>
            <option value="배송중">배송중</option>
            <option value="배송완료">배송완료</option>
          </select>
          <button 
            onClick={handleBulkUpdate} 
            disabled={checkedIds.size === 0 || !bulkStatus || isUpdatingBulk}
            style={{ 
              padding: '8px 16px', 
              background: (checkedIds.size === 0 || !bulkStatus || isUpdatingBulk) ? '#e5e7eb' : '#111827', 
              color: (checkedIds.size === 0 || !bulkStatus || isUpdatingBulk) ? '#9ca3af' : '#fff', 
              border: 'none', 
              borderRadius: '6px', 
              fontSize: '0.82rem', 
              fontWeight: 600, 
              cursor: (checkedIds.size === 0 || !bulkStatus || isUpdatingBulk) ? 'not-allowed' : 'pointer' 
            }}
          >
            {isUpdatingBulk ? '변경 중...' : '일괄 변경'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadOrders} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
            🔄 새로고침
          </button>
          <button onClick={downloadCSV} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            📥 CSV 다운로드
          </button>
        </div>
      </div>

      {/* 주문 테이블 */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{...thStyle, width: '40px', textAlign: 'center'}}>
                <input 
                  type="checkbox" 
                  checked={pagedOrders.filter(o => o.order_status !== '주문취소').length > 0 && pagedOrders.filter(o => o.order_status !== '주문취소').every(o => checkedIds.has(o.id))}
                  onChange={toggleAll}
                />
              </th>
              <th style={thStyle}>주문일</th>
              <th style={thStyle}>고객명</th>
              <th style={thStyle}>이메일</th>
              <th style={thStyle}>연락처</th>
              <th style={thStyle}>배송지</th>
              <th style={thStyle}>선택 도서</th>
              <th style={thStyle}>상태</th>
            </tr>
          </thead>
          <tbody>
            {pagedOrders.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                {filter === 'all' ? '주문 내역이 없습니다.' : `'${filter}' 상태의 주문이 없습니다.`}
              </td></tr>
            ) : (
              pagedOrders.map((order, index) => {
                const isCancelled = order.order_status === '주문취소';
                return (
                <tr key={order.id} style={{ borderBottom: '1px solid #f3f4f6', background: isCancelled ? '#f9fafb' : 'transparent', opacity: isCancelled ? 0.6 : 1 }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      disabled={isCancelled}
                      checked={checkedIds.has(order.id)}
                      onChange={(e) => e.preventDefault()}
                      onClick={(e) => handleCheck(e, index, order.id, isCancelled)}
                    />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>{new Date(order.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{new Date(order.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td style={{ ...tdStyle, minWidth: '100px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111' }}>{order.user_name}</div>
                  </td>
                  <td style={{ ...tdStyle, minWidth: '120px', fontSize: '0.75rem', color: '#4b5563' }}>
                    {order.user_email}
                  </td>
                  <td style={{ ...tdStyle, minWidth: '110px', fontSize: '0.75rem', color: '#4b5563' }}>
                    {order.user_phone}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.78rem', color: '#6b7280', maxWidth: '180px' }}>
                    {order.user_address || '-'}
                  </td>
                  <td style={{ ...tdStyle, minWidth: '160px' }}>
                    {(order.book_order_items || []).map((b: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: idx < (order.book_order_items?.length || 0) - 1 ? '4px' : 0, fontSize: '0.8rem' }}>
                        {b.cover && <div style={{ width: '24px', height: '32px', borderRadius: '2px 4px 4px 2px', overflow: 'hidden', flexShrink: 0 }}><img src={b.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /></div>}
                        <span style={{ fontWeight: 500 }}>{b.title}</span>
                      </div>
                    ))}
                    {(!order.book_order_items || order.book_order_items.length === 0) && <span style={{ color: '#d1d5db' }}>-</span>}
                  </td>
                  
                  <td style={{ ...tdStyle }}>
                    <select
                      value={order.order_status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '20px',
                        border: '1px solid #e5e7eb',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        ...getStatusStyle(order.order_status)
                      }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{getStatusLabel(s.value)}</option>)}
                    </select>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        
        {/* 책 발송 관리 페이지네이션 UI */}
        {filteredOrders.length > 0 && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              {(safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, filteredOrders.length)} / 총 {filteredOrders.length}건
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
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '12px 10px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const };
const tdStyle: React.CSSProperties = { padding: '12px 10px', verticalAlign: 'top' };
