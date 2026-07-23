"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ContentManager() {
  const [books, setBooks] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    cycle_id: '', title: '', author: '', genre: '', description: '', 
    cover: '', tags: '', is_public: true, is_orderable: true, is_deleted: false, order_idx: 0,
    bg: '#3b4b72', bgDark: '#121931', is_new: false
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const cyclesRes = await fetch('/api/admin/cycles', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const cyclesData = await cyclesRes.json();
      const loadedCycles = cyclesData.cycles || [];
      setCycles(loadedCycles);
      
      if (loadedCycles.length > 0 && !selectedCycleId) {
        setSelectedCycleId(loadedCycles[0].id);
      }

      // Fetch all books via Supabase directly for reading (Admin should have read access, but we can also use an API. For simplicity reading via client if RLS allows, but let's use client since they said admin uses server API only for cycles, but didn't strictly forbid books. Let's fetch books normally, assuming RLS allows read).
      const { data: booksData, error } = await supabase.from('books').select('*').order('order_idx', { ascending: true });
      if (booksData) setBooks(booksData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openModal = (book: any = null) => {
    if (book) {
      setEditingBook(book);
      setFormData({
        cycle_id: book.cycle_id, title: book.title, author: book.author || '', genre: book.genre || '', 
        description: book.description || '', cover: book.cover || '', tags: (book.tags || []).join(', '), 
        is_public: book.is_public, is_orderable: book.is_orderable, is_deleted: book.is_deleted, order_idx: book.order_idx || 0,
        bg: book.bg_color || '#3b4b72', bgDark: book.bg_color_dark || '#121931', is_new: !!book.is_new
      });
    } else {
      setEditingBook(null);
      setFormData({
        cycle_id: selectedCycleId || '', title: '', author: '', genre: '', description: '', 
        cover: '', tags: '', is_public: true, is_orderable: true, is_deleted: false, order_idx: 0, bg: '#3b4b72', bgDark: '#121931', is_new: false
      });
    }
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      const filePath = `covers/${fileName}`;
      const { error } = await supabase.storage.from('books').upload(filePath, file);
      if (error) {
        alert('이미지 업로드 실패: ' + error.message);
        return;
      }
      const { data } = supabase.storage.from('books').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, cover: data.publicUrl }));
    } catch (err: any) {
      alert('업로드 중 오류 발생: ' + err.message);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const url = editingBook ? `/api/admin/books/${editingBook.id}` : '/api/admin/books';
      const method = editingBook ? 'PATCH' : 'POST';

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
        loadData();
      } else {
        alert(result.error);
      }
    } catch (e) {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div>로딩 중...</div>;

  const filteredBooks = books.filter(b => b.cycle_id === selectedCycleId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>기수별 도서 관리</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
          </select>
          <button onClick={() => openModal()} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>+ 새 도서 추가</button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>순서</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>도서명</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>저자</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>상태</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {filteredBooks.map(b => (
            <tr key={b.id}>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{b.order_idx}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{b.title}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{b.author}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                {!b.is_public && <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', marginRight: '4px' }}>비공개</span>}
                {!b.is_orderable && <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', marginRight: '4px' }}>주문불가</span>}
                {b.is_deleted && <span style={{ background: '#e5e7eb', color: '#374151', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>삭제됨</span>}
                {b.is_public && b.is_orderable && !b.is_deleted && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>정상</span>}
              </td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <button onClick={() => openModal(b)} style={{ padding: '4px 8px', border: '1px solid #d1d5db', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>수정</button>
              </td>
            </tr>
          ))}
          {filteredBooks.length === 0 && <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>등록된 도서가 없습니다.</td></tr>}
        </tbody>
      </table>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingBook ? '도서 수정' : '새 도서 추가'}</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>기수 선택</label>
              <select value={formData.cycle_id} onChange={e => setFormData({...formData, cycle_id: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>도서명</label>
              <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>저자</label>
                <input type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>장르</label>
                <input type="text" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>표지 이미지 URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={formData.cover} onChange={e => setFormData({...formData, cover: e.target.value})} style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ padding: '4px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>태그 (쉼표로 구분)</label>
              <input type="text" value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>설명</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '4px', minHeight: '220px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>배경색 (bg_color)</label>
                <input type="color" value={formData.bg} onChange={e => setFormData({...formData, bg: e.target.value})} style={{ width: '40px', height: '36px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 600 }}>어두운 배경색 (bg_color_dark)</label>
                <input type="color" value={formData.bgDark} onChange={e => setFormData({...formData, bgDark: e.target.value})} style={{ width: '40px', height: '36px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', padding: '12px', background: '#f9fafb', borderRadius: '8px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.is_new} onChange={e => setFormData({...formData, is_new: e.target.checked})} /> 신간 표시 (NEW)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.is_public} onChange={e => setFormData({...formData, is_public: e.target.checked})} /> 공개 (Public)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.is_orderable} onChange={e => setFormData({...formData, is_orderable: e.target.checked})} /> 주문 가능 (Orderable)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.is_deleted} onChange={e => setFormData({...formData, is_deleted: e.target.checked})} /> 삭제 (Deleted)
              </label>
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
