
"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const GENRE_OPTIONS = ['경제·경영', '인문·사회', '자기계발', '재테크', '소설', '예술', '건강'];

const extractColors = (imgUrl: string): Promise<{ bg: string, bgDark: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');
      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(img, 0, 0, 64, 64);

      let r = 0, g = 0, b = 0, count = 0;
      const data = ctx.getImageData(0, 0, 64, 64).data;

      // Calculate average color
      for (let i = 0; i < data.length; i += 4) {
        // Skip white/transparent pixels for better color extraction
        if (data[i+3] > 0 && !(data[i] > 240 && data[i+1] > 240 && data[i+2] > 240)) {
          r += data[i];
          g += data[i+1];
          b += data[i+2];
          count++;
        }
      }

      if (count === 0) {
        r = 59; g = 75; b = 114; // Default color
      } else {
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
      }

      // Mute the colors slightly for background
      const lightColor = { r: Math.min(255, Math.floor(r * 0.5 + 127)), g: Math.min(255, Math.floor(g * 0.5 + 127)), b: Math.min(255, Math.floor(b * 0.5 + 127)) };
      const darkColor = { r: Math.floor(r * 0.4), g: Math.floor(g * 0.4), b: Math.floor(b * 0.4) };

      const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');

      resolve({
        bgDark: rgbToHex(darkColor.r, darkColor.g, darkColor.b),
        bg: rgbToHex(lightColor.r, lightColor.g, lightColor.b)
      });
    };
    img.onerror = () => reject('Image load error');
    img.src = imgUrl;
  });
};

export default function ContentManager() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [isCreatingBook, setIsCreatingBook] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isSavingReorder, setIsSavingReorder] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data: cyclesData } = await supabase.from('cycles').select('*').order('subscription_start_date', { ascending: false });
    if (cyclesData) {
      setCycles(cyclesData);
      if (cyclesData.length > 0 && !activeCycleId) {
        setActiveCycleId(cyclesData[0].id);
      }
    }
    const { data: booksData } = await supabase.from('books').select('*').order('order_idx', { ascending: true }).order('created_at', { ascending: true });
    if (booksData) {
      setBooks(booksData);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCycle = cycles.find(c => c.id === activeCycleId) || cycles[0];
  const activeCycleBooks = books
    .filter(b => b.cycle_id === activeCycle?.id && !b.is_deleted)
    .sort((a, b) => (a.order_idx || 0) - (b.order_idx || 0));

  const handleBookDelete = async (bookId: string) => {
    if (confirm('정말로 이 도서를 삭제하시겠습니까? (복구 불가)')) {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      await fetch(`/api/admin/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_deleted: true })
      });
      await loadData();
      setEditingBook(null);
      setIsCreatingBook(false);
    }
  };

  const saveBook = async (payload: any) => {
    const sessionData = await supabase.auth.getSession();
    const token = sessionData.data.session?.access_token;
    try {
      if (isCreatingBook) {
        const newBook = { ...payload, cycle_id: payload.cycle_id || activeCycleId, order_idx: activeCycleBooks.length };
        const res = await fetch('/api/admin/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(newBook)
        });
        if (!res.ok) {
          alert('도서를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
          return;
        }
      } else {
        const res = await fetch(`/api/admin/books/${payload.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          alert('도서를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.');
          return;
        }
      }
      setEditingBook(null);
      setIsCreatingBook(false);
      await loadData();
      localStorage.removeItem('bookEditDraft');
      alert('저장 완료!');
    } catch (error) {
      alert('요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const moveBook = (index: number, direction: number) => {
    const currentActiveBooks = [...activeCycleBooks];
    if (index + direction < 0 || index + direction >= currentActiveBooks.length) return;

    // Swap
    const temp = currentActiveBooks[index];
    currentActiveBooks[index] = currentActiveBooks[index + direction];
    currentActiveBooks[index + direction] = temp;

    // Update order_idx locally
    currentActiveBooks.forEach((b, i) => {
      b.order_idx = i;
    });

    setBooks(prev => prev.map(b => {
      const updated = currentActiveBooks.find(cb => cb.id === b.id);
      return updated ? { ...updated } : b;
    }));
  };

  const saveReorder = async () => {
    if (isSavingReorder) return;
    setIsSavingReorder(true);
    try {
      const orderedBookIds = activeCycleBooks.map(b => b.id);
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;

      const res = await fetch('/api/admin/books/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cohortId: activeCycle?.id, orderedBookIds })
      });

      if (!res.ok) {
        throw new Error('Failed to save order');
      }

      alert('도서 순서가 저장되었습니다.');
      setIsReordering(false);
    } catch (e) {
      alert('순서 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSavingReorder(false);
      await loadData();
    }
  };

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>데이터 불러오는 중...</div>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', padding: '20px', background: '#faf8f4', minHeight: '800px', borderRadius: '8px', border: '1px solid #e5dfd2' }}>
        {/* Sidebar */}
        <aside style={{ borderRight: '1px solid #e5dfd2', paddingRight: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1815' }}>기수 선택</h3>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {cycles.map(c => (
              <li
                key={c.id}
                onClick={() => setActiveCycleId(c.id)}
                style={{ padding: '12px', background: activeCycleId === c.id ? '#f3ede2' : 'transparent', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px', border: activeCycleId === c.id ? '1px solid #cfc8b8' : '1px solid transparent' }}
              >
                <div style={{ fontWeight: 600, color: '#1a1815', marginBottom: '4px', fontSize: '0.92rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#8a8478' }}>
                  도서 {books.filter(b => b.cycle_id === c.id && !b.is_deleted).length}권
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main>
          {!editingBook && !isCreatingBook ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>도서 목록 <span style={{ color: '#8a8478', fontSize: '1rem', fontWeight: 400 }}>{activeCycleBooks.length}권</span></h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isReordering ? (
                    <>
                      <button onClick={async () => { setIsReordering(false); await loadData(); }} disabled={isSavingReorder} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: isSavingReorder ? 'not-allowed' : 'pointer' }}>취소</button>
                      <button onClick={saveReorder} disabled={isSavingReorder} style={{ padding: '8px 16px', background: '#1a1815', color: '#fff', border: 'none', borderRadius: '4px', cursor: isSavingReorder ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                        {isSavingReorder ? '저장 중...' : '순서 저장'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setIsReordering(true)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>순서 변경</button>
                      <button onClick={() => { setIsCreatingBook(true); setEditingBook({ cycle_id: activeCycle?.id || '', title:'', author:'', genre:'', cover:'', tags:[], description:'', lecture:null, bg_color: '#3b4b72', bg_color_dark: '#121931', is_new:false, is_public: true, is_orderable: true }); }} style={{ padding: '8px 16px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>+ 도서 추가</button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeCycleBooks.map((book: any, i: number) => (
                  <div key={book.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5dfd2', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {isReordering && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '4px' }}>
                          <button onClick={() => moveBook(i, -1)} disabled={i === 0 || isSavingReorder} style={{ padding: '2px 6px', background: i === 0 ? '#f3ede2' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: i === 0 || isSavingReorder ? 'not-allowed' : 'pointer', color: i === 0 ? '#cfc8b8' : '#1a1815' }}>▲</button>
                          <button onClick={() => moveBook(i, 1)} disabled={i === activeCycleBooks.length - 1 || isSavingReorder} style={{ padding: '2px 6px', background: i === activeCycleBooks.length - 1 ? '#f3ede2' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: i === activeCycleBooks.length - 1 || isSavingReorder ? 'not-allowed' : 'pointer', color: i === activeCycleBooks.length - 1 ? '#cfc8b8' : '#1a1815' }}>▼</button>
                        </div>
                      )}
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#cfc8b8', width: '20px' }}>{i + 1}</div>
                      {book.cover ? (
                        <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e5dfd2' }}>
                          <img src={book.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        </div>
                      ) : (
                        <div style={{ width: '40px', height: '56px', borderRadius: '4px', background: '#f3ede2', border: '1px solid #e5dfd2' }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1a1815', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {book.title}
                          {book.is_new && <span style={{ fontSize: '0.65rem', background: '#e74c3c', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>NEW</span>}
                          {!book.is_public && <span style={{ fontSize: '0.65rem', background: '#9ca3af', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>비공개</span>}
                          {!book.is_orderable && <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>주문불가</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#8a8478', marginBottom: '8px' }}>{book.author} · {book.genre}</div>
                      </div>
                    </div>
                    <div>
                      <button onClick={() => { setEditingBook(book); setIsCreatingBook(false); }} disabled={isReordering} style={{ padding: '6px 12px', background: isReordering ? '#f9f9f9' : '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: isReordering ? 'not-allowed' : 'pointer', fontSize: '0.8rem', color: isReordering ? '#cfc8b8' : '#1a1815' }}>편집</button>
                    </div>
                  </div>
                ))}
                {activeCycleBooks.length === 0 && (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: '#8a8478', border: '1px dashed #cfc8b8', borderRadius: '8px' }}>
                    등록된 도서가 없습니다.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <BookEditForm
              book={editingBook}
              cycles={cycles}
              onSave={saveBook}
              onCancel={() => { setEditingBook(null); setIsCreatingBook(false); }}
              onDelete={() => handleBookDelete(editingBook.id)}
            />
          )}
        </main>
      </div>
    </>
  );
}

function BookEditForm({ book, cycles, onSave, onCancel, onDelete }: { book: any, cycles: any[], onSave: (b: any) => void, onCancel: () => void, onDelete: () => void }) {
  const [formData, setFormData] = useState<any>({
    id: book.id || null,
    cycle_id: book.cycle_id || '',
    title: book.title || '',
    author: book.author || '',
    genre: book.genre || '',
    cover: book.cover || '',
    tagsStr: (book.tags || []).join(', '),
    description: book.description || '',
    lecture: book.lecture || null,
    bg: book.bg_color || '#3b4b72',
    bgDark: book.bg_color_dark || '#121931',
    is_new: !!book.is_new,
    is_public: book.is_public ?? true,
    is_orderable: book.is_orderable ?? true,
    isbn: book.isbn || ''
  });

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev: any) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleAutoExtractColor = async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || formData.cover;
    if (!targetUrl) {
      alert('표지 URL이 없습니다. 먼저 표지 이미지를 등록해주세요.');
      return;
    }
    try {
      const colors = await extractColors(targetUrl);
      setFormData((prev: any) => ({ ...prev, bg: colors.bg, bgDark: colors.bgDark }));
    } catch (e) {
      alert('표지 색상을 자동으로 추출하지 못했습니다. 색상 코드를 직접 선택해주세요.');
    }
  };

  const handleDraftSave = () => {
    const draftData = { ...formData, _id: book.id || null };
    localStorage.setItem('bookEditDraft', JSON.stringify(draftData));
    alert('임시저장 완료! 다음에 편집을 열면 자동으로 복원됩니다.');
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.author) { alert('제목과 저자를 입력해주세요.'); return; }
    localStorage.removeItem('bookEditDraft');
    const payload = {
      ...formData,
      tags: formData.tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean),
      bg_color: formData.bg,
      bg_color_dark: formData.bgDark
    };
    delete payload.tagsStr;
    delete payload.bg;
    delete payload.bgDark;
    onSave(payload);
  };

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '2px solid #1a1815' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '1.1rem' }}>도서 편집</h4>
        {book.id && (
          <button onClick={onDelete} style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
            이 도서 삭제
          </button>
        )}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>기수 선택 *</label>
        <select name="cycle_id" value={formData.cycle_id} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', background: '#fff' }}>
          <option value="">기수를 선택하세요</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div><label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>제목 *</label><input name="title" value={formData.title} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} /></div>
        <div><label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>저자 *</label><input name="author" value={formData.author} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} /></div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>장르</label>
          <select name="genre" value={formData.genre || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', background: '#fff', fontSize: '0.88rem', cursor: 'pointer' }}>
            <option value="">분야 선택</option>
            {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.8rem' }}>표지 URL</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => handleAutoExtractColor()}
                style={{ background: '#eef2ff', color: '#4f46e5', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
              >
                표지 색상 자동 추출
              </button>
              <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                이미지 파일 직접 업로드
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fileExt = file.name.split('.').pop();
                  const fileName = `img_${Date.now()}.${fileExt}`;
                  const filePath = `covers/${fileName}`;

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('filePath', filePath);

                  const sessionData = await supabase.auth.getSession();
                  const token = sessionData.data.session?.access_token;

                  const res = await fetch('/api/admin/books/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                  });

                  if (!res.ok) {
                    const errData = await res.json();
                    alert('업로드 실패: ' + errData.error);
                    return;
                  }

                  const { publicUrl } = await res.json();
                  setFormData((prev: any) => ({ ...prev, cover: publicUrl }));
                  e.target.value = '';
                  handleAutoExtractColor(publicUrl);
                }} />
              </label>
            </div>
          </div>
          <input name="cover" value={formData.cover || ''} onChange={handleChange} onBlur={() => handleAutoExtractColor()} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>배경 테마 색상 (밝은색)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="color" name="bg" value={formData.bg || '#3b4b72'} onChange={handleChange} style={{ width: '40px', height: '36px', padding: '2px', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer' }} />
            <input name="bg" value={formData.bg || '#3b4b72'} onChange={handleChange} placeholder="#HEX" style={{ flex: 1, padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', textTransform: 'uppercase' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>배경 테마 색상 (어두운색)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="color" name="bgDark" value={formData.bgDark || '#121931'} onChange={handleChange} style={{ width: '40px', height: '36px', padding: '2px', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer' }} />
            <input name="bgDark" value={formData.bgDark || '#121931'} onChange={handleChange} placeholder="#HEX" style={{ flex: 1, padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', textTransform: 'uppercase' }} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>종이책 ISBN <span style={{ color: '#8a8478', fontWeight: 400 }}>(발송 관리용 · 사용자에게 미노출)</span></label>
        <input name="isbn" value={formData.isbn || ''} onChange={handleChange} placeholder="9788900000000" style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', fontFamily: 'monospace' }} />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>태그 (쉼표로 구분)</label>
        <input name="tagsStr" value={formData.tagsStr} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
          <label style={{ fontSize: '0.8rem' }}>설명 <span style={{ color: '#8a8478', fontWeight: 400 }}>(줄바꿈은 엔터)</span></label>
          <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            본문 이미지 첨부하기
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fileExt = file.name.split('.').pop();
              const fileName = `img_${Date.now()}.${fileExt}`;
              const filePath = `descriptions/${fileName}`;

              const formData = new FormData();
              formData.append('file', file);
              formData.append('filePath', filePath);

              const sessionData = await supabase.auth.getSession();
              const token = sessionData.data.session?.access_token;

              const res = await fetch('/api/admin/books/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
              });

              if (!res.ok) {
                const errData = await res.json();
                alert('업로드 실패: ' + errData.error);
                return;
              }

              const { publicUrl } = await res.json();
              const textarea = document.getElementById('description-textarea') as HTMLTextAreaElement;
              setFormData((prev: any) => {
                const currentText = prev.description || '';
                const cursorPos = textarea ? textarea.selectionStart : currentText.length;
                const textBefore = currentText.substring(0, cursorPos);
                const textAfter = currentText.substring(cursorPos);
                const imgTag = `\n<img src="${publicUrl}" style="width:100%" />\n`;
                return { ...prev, description: textBefore + imgTag + textAfter };
              });
              e.target.value = '';
            }} />
          </label>
        </div>
        <textarea id="description-textarea" name="description" value={formData.description || ''} onChange={handleChange} style={{ width: '100%', padding: '12px', border: '1px solid #cfc8b8', borderRadius: '4px', minHeight: '300px', fontFamily: 'inherit', lineHeight: '1.6', resize: 'vertical' }} />
      </div>

      <div style={{ marginBottom: '16px', background: '#f9f9f9', padding: '12px', borderRadius: '6px', border: '1px solid #e5dfd2', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" name="is_new" checked={!!formData.is_new} onChange={handleChange} /> 새 신간 도서 (NEW 표시)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" name="is_public" checked={!!formData.is_public} onChange={handleChange} /> 공개 (Public)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" name="is_orderable" checked={!!formData.is_orderable} onChange={handleChange} /> 주문 가능 (Orderable)
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
        <button onClick={handleDraftSave} style={{ padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>임시저장</button>
        <button onClick={handleSubmit} style={{ padding: '8px 16px', background: '#1a1815', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>저장</button>
      </div>
    </div>
  );
}
