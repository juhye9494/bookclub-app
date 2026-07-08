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
  selected_books: any[];
  total_amount: number;
  order_status: string;
  tracking_number: string;
  payment_order_id: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '발송대기', label: '발송대기', color: '#f59e0b', bg: '#fef3c7' },
  { value: '발송완료', label: '발송완료', color: '#10b981', bg: '#d1fae5' },
  { value: '배송중', label: '배송중', color: '#3b82f6', bg: '#dbeafe' },
  { value: '배송완료', label: '배송완료', color: '#6b7280', bg: '#f3f4f6' },
];

export default function ShippingManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [editingTracking, setEditingTracking] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      // 기존 order_status가 '배송준비중'인 것을 '발송대기'로 매핑
      const mapped = data.map(o => ({
        ...o,
        order_status: o.order_status === '배송준비중' ? '발송대기' : (o.order_status || '발송대기'),
        tracking_number: o.tracking_number || ''
      }));
      setOrders(mapped);
    }
    setLoading(false);
  }

  // 상태별 카운트
  const counts = {
    all: orders.length,
    '발송대기': orders.filter(o => o.order_status === '발송대기').length,
    '발송완료': orders.filter(o => o.order_status === '발송완료').length,
    '배송중': orders.filter(o => o.order_status === '배송중').length,
    '배송완료': orders.filter(o => o.order_status === '배송완료').length,
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.order_status === filter);

  // 개별 상태 변경
  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ order_status: newStatus }).eq('id', orderId);
    if (error) { alert('상태 업데이트 실패: ' + error.message); return; }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: newStatus } : o));
  };

  // 일괄 상태 변경
  const bulkUpdateStatus = async (newStatus: string) => {
    if (checkedIds.size === 0) { alert('선택된 주문이 없습니다.'); return; }
    const ids = Array.from(checkedIds);
    const { error } = await supabase.from('orders').update({ order_status: newStatus }).in('id', ids);
    if (error) { alert('일괄 업데이트 실패: ' + error.message); return; }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, order_status: newStatus } : o));
    setCheckedIds(new Set());
  };

  // 송장번호 저장
  const saveTracking = async (orderId: string) => {
    const { error } = await supabase.from('orders').update({ tracking_number: trackingInput }).eq('id', orderId);
    if (error) { alert('송장번호 저장 실패: ' + error.message); return; }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, tracking_number: trackingInput } : o));
    setEditingTracking(null);
    setTrackingInput('');
  };

  // 체크박스 토글
  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (checkedIds.size === filteredOrders.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // CSV 다운로드
  const downloadCSV = () => {
    const target = checkedIds.size > 0 ? orders.filter(o => checkedIds.has(o.id)) : filteredOrders;
    if (target.length === 0) return;
    const headers = ['주문일자', '주문번호', '고객명', '이메일', '연락처', '배송주소', '상태', '송장번호', '도서1', 'ISBN1', '도서2', 'ISBN2', '도서3', 'ISBN3'];
    const rows = target.map(order => {
      const books = order.selected_books || [];
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
          { label: '발송대기', value: counts['발송대기'], icon: '⏳', key: '발송대기' },
          { label: '발송완료', value: counts['발송완료'], icon: '✅', key: '발송완료' },
          { label: '배송중', value: counts['배송중'], icon: '🚚', key: '배송중' },
          { label: '배송완료', value: counts['배송완료'], icon: '📬', key: '배송완료' },
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
          {checkedIds.size > 0 && (
            <>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                {checkedIds.size}건 선택
              </span>
              <button onClick={() => bulkUpdateStatus('발송완료')} style={{ padding: '6px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ✅ 일괄 발송완료
              </button>
              <button onClick={() => bulkUpdateStatus('배송중')} style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                🚚 일괄 배송중
              </button>
              <button onClick={() => bulkUpdateStatus('배송완료')} style={{ padding: '6px 14px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                📬 일괄 배송완료
              </button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadOrders} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
            🔄 새로고침
          </button>
          <button onClick={downloadCSV} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            📥 CSV 다운로드{checkedIds.size > 0 ? ` (${checkedIds.size}건)` : ''}
          </button>
        </div>
      </div>

      {/* 주문 테이블 */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px 10px', width: '36px' }}>
                <input type="checkbox" checked={checkedIds.size === filteredOrders.length && filteredOrders.length > 0} onChange={toggleAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              </th>
              <th style={thStyle}>주문일</th>
              <th style={thStyle}>고객</th>
              <th style={thStyle}>배송지</th>
              <th style={thStyle}>선택 도서</th>
              <th style={thStyle}>송장번호</th>
              <th style={thStyle}>상태</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                {filter === 'all' ? '주문 내역이 없습니다.' : `'${filter}' 상태의 주문이 없습니다.`}
              </td></tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid #f3f4f6', background: checkedIds.has(order.id) ? '#fefce8' : 'transparent' }}>
                  <td style={{ padding: '12px 10px' }}>
                    <input type="checkbox" checked={checkedIds.has(order.id)} onChange={() => toggleCheck(order.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>{new Date(order.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{new Date(order.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td style={{ ...tdStyle, minWidth: '120px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111' }}>{order.user_name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{order.user_email}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{order.user_phone}</div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.78rem', color: '#6b7280', maxWidth: '180px' }}>
                    {order.user_address || '-'}
                  </td>
                  <td style={{ ...tdStyle, minWidth: '160px' }}>
                    {(order.selected_books || []).map((b: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: idx < (order.selected_books?.length || 0) - 1 ? '4px' : 0, fontSize: '0.8rem' }}>
                        {b.cover && <div style={{ width: '24px', height: '32px', borderRadius: '2px 4px 4px 2px', overflow: 'hidden', flexShrink: 0 }}><img src={b.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /></div>}
                        <span style={{ fontWeight: 500 }}>{b.title}</span>
                      </div>
                    ))}
                    {(!order.selected_books || order.selected_books.length === 0) && <span style={{ color: '#d1d5db' }}>-</span>}
                  </td>
                  <td style={{ ...tdStyle, minWidth: '140px' }}>
                    {editingTracking === order.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          placeholder="송장번호 입력"
                          style={{ width: '100px', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.78rem' }}
                          onKeyDown={(e) => e.key === 'Enter' && saveTracking(order.id)}
                          autoFocus
                        />
                        <button onClick={() => saveTracking(order.id)} style={{ padding: '4px 8px', background: '#1a1815', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}>저장</button>
                        <button onClick={() => setEditingTracking(null)} style={{ padding: '4px 8px', background: '#f3f4f6', border: 'none', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}>취소</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditingTracking(order.id); setTrackingInput(order.tracking_number || ''); }}
                        style={{ cursor: 'pointer', fontSize: '0.8rem', color: order.tracking_number ? '#374151' : '#d1d5db', padding: '4px 0' }}
                      >
                        {order.tracking_number || '+ 송장번호 입력'}
                      </div>
                    )}
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
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '12px 10px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const };
const tdStyle: React.CSSProperties = { padding: '12px 10px', verticalAlign: 'top' };
