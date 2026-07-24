"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const formatDatetimeLocalKst = (isoString?: string | null) => {
  if (!isoString) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(new Date(isoString));
  const getPart = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`;
};

const toKstIso = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  return new Date(`${normalized}+09:00`).toISOString();
};

export default function CyclesManager() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<any>(null);
  const [formData, setFormData] = useState({
    id: '', name: '', status: 'upcoming', max_book_count: 4,
    subscription_start_date: '', subscription_end_date: '',
    book_order_start_date: '', book_order_end_date: '',
    shipping_start_date: '', operation_end_date: '', activity_start_date: '',
    recruitment_start_date: '', recruitment_end_date: ''
  });

  const loadCycles = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/cycles', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (res.ok) setCycles(data.cycles || []);
      else alert(data.error);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadCycles(); }, []);

  const openModal = (cycle: any = null) => {
    if (cycle) {
      setEditingCycle(cycle);
      setFormData({
        id: cycle.id, name: cycle.name, status: cycle.status, max_book_count: cycle.max_book_count,
        subscription_start_date: formatDatetimeLocalKst(cycle.subscription_start_date),
        subscription_end_date: formatDatetimeLocalKst(cycle.subscription_end_date),
        book_order_start_date: formatDatetimeLocalKst(cycle.book_order_start_date),
        book_order_end_date: formatDatetimeLocalKst(cycle.book_order_end_date),
        shipping_start_date: formatDatetimeLocalKst(cycle.shipping_start_date),
        operation_end_date: formatDatetimeLocalKst(cycle.operation_end_date),
        activity_start_date: cycle.activity_start_date || '',
        recruitment_start_date: cycle.recruitment_start_date || '',
        recruitment_end_date: cycle.recruitment_end_date || ''
      });
    } else {
      setEditingCycle(null);
      setFormData({
        id: '', name: '', status: 'upcoming', max_book_count: 4,
        subscription_start_date: '', subscription_end_date: '',
        book_order_start_date: '', book_order_end_date: '',
        shipping_start_date: '', operation_end_date: '', activity_start_date: '',
        recruitment_start_date: '', recruitment_end_date: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        ...formData,
        subscription_start_date: toKstIso(formData.subscription_start_date),
        subscription_end_date: toKstIso(formData.subscription_end_date),
        book_order_start_date: toKstIso(formData.book_order_start_date),
        book_order_end_date: toKstIso(formData.book_order_end_date),
        shipping_start_date: toKstIso(formData.shipping_start_date),
        operation_end_date: toKstIso(formData.operation_end_date),
        activity_start_date: formData.activity_start_date || null,
        recruitment_start_date: formData.recruitment_start_date || null,
        recruitment_end_date: formData.recruitment_end_date || null,
      };

      const url = editingCycle ? `/api/admin/cycles/${editingCycle.id}` : '/api/admin/cycles';
      const method = editingCycle ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok) {
        alert('저장되었습니다.');
        setIsModalOpen(false);
        loadCycles();
      } else {
        alert(result.error);
      }
    } catch (e) {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const dateStr = (iso: string) => {
    return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>기수 관리</h2>
        <button onClick={() => openModal()} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>+ 새 기수 추가</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>ID</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>기수명</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>상태</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>구독 신청 기간</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>도서 주문 기간</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map(c => (
            <tr key={c.id}>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{c.id}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{c.name}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', background: c.status === 'active' ? '#dcfce7' : c.status === 'closed' ? '#fee2e2' : '#f3f4f6', color: c.status === 'active' ? '#166534' : c.status === 'closed' ? '#991b1b' : '#374151' }}>
                  {c.status}
                </span>
              </td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem' }}>{dateStr(c.subscription_start_date)} ~<br/>{dateStr(c.subscription_end_date)}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem' }}>{dateStr(c.book_order_start_date)} ~<br/>{dateStr(c.book_order_end_date)}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <button onClick={() => openModal(c)} style={{ padding: '4px 8px', border: '1px solid #d1d5db', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>수정</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingCycle ? '기수 수정' : '새 기수 추가'}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>기수 ID</label>
                <input type="text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={!!editingCycle} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} placeholder="cycle-2026-h1" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>기수명</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} placeholder="1기" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>상태</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                  <option value="upcoming">Upcoming (예정)</option>
                  <option value="active">Active (운영중)</option>
                  <option value="closed">Closed (강제종료)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>최대 제공 권수</label>
                <input type="number" min="1" value={formData.max_book_count} onChange={e => setFormData({...formData, max_book_count: parseInt(e.target.value)})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>모집 표시 시작일</label>
                <input type="date" value={formData.recruitment_start_date} onChange={e => setFormData({...formData, recruitment_start_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>모집 표시 종료일</label>
                <input type="date" value={formData.recruitment_end_date} onChange={e => setFormData({...formData, recruitment_end_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>

              <div style={{ marginBottom: '12px', marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>구독 신청 시작일</label>
                <input type="datetime-local" value={formData.subscription_start_date} onChange={e => setFormData({...formData, subscription_start_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>구독 신청 마감일</label>
                <input type="datetime-local" value={formData.subscription_end_date} onChange={e => setFormData({...formData, subscription_end_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>도서 주문 시작일</label>
                <input type="datetime-local" value={formData.book_order_start_date} onChange={e => setFormData({...formData, book_order_start_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>도서 주문 마감일</label>
                <input type="datetime-local" value={formData.book_order_end_date} onChange={e => setFormData({...formData, book_order_end_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>배송 시작일</label>
                <input type="datetime-local" value={formData.shipping_start_date} onChange={e => setFormData({...formData, shipping_start_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>운영 종료일</label>
                <input type="datetime-local" value={formData.operation_end_date} onChange={e => setFormData({...formData, operation_end_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>활동 시작일 (FAQ용)</label>
                <input type="date" value={formData.activity_start_date || ''} onChange={e => setFormData({...formData, activity_start_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
              <button onClick={handleSave} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
