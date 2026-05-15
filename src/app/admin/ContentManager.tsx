"use client";
import React, { useState, useEffect } from 'react';

// Seed data
const SEED_CYCLES = [
  {
    id: 'cycle-2026-h1', label: '2026 상반기', startDate: '2026-01-01', endDate: '2026-06-30', status: 'active',
    books: [
      { id: 'b1', title: 'CES 2026', author: '한국경제신문 × The Miilk', genre: '테크 · 트렌드', cover: '/uploads/041f16811654291628de9f342681dbb1.png', tags: ['IT · 기술', 'AI · 혁신'], desc: 'CES 2026의 모든 것', lecture: null },
      { id: 'b2', title: '정리로 시작하는 인생 리셋', author: '정경자 지음', genre: '라이프스타일', cover: '/uploads/ce7fe03d39caf9b1708cba7e5e7faa83.jpg', tags: ['정리 · 수납', '라이프스타일', '강연 포함'], desc: '정리 전문가의 바이블', lecture: { desc: '온라인 강연', perks: ['60분 실전 정리 강의'] } },
      { id: 'b3', title: '프로젝트리츠로 일하는 법', author: '강병기 외 4인', genre: '부동산 · 비즈니스', cover: '/uploads/fd38af558278f9de5a15d0ab05aaf85e.jpg', tags: ['부동산', '리츠', '강연 포함'], desc: '국내 최초 리츠 종합 안내서', lecture: { desc: '릴레이 강연', perks: ['총 3회 릴레이 강연'] } },
      { id: 'b4', title: '퍼지키즈', author: '한지우 지음', genre: '교육 · 자녀교육', cover: '/uploads/d1bae06b6d279117f4aeacbd777accbb.jpg', tags: ['AI 교육', '인문학', '강연 포함'], desc: '혁신적 교육서', lecture: { desc: '온라인 특강', perks: ['75분 라이브 특강'] } },
      { id: 'b5', title: '덜 멍청하게 살기 위한 최소한의 철학', author: '라르스 스벤젠', genre: '철학 · 인문', cover: '/uploads/775c4d1d6677a6abd5ce990900c13cb0.jpg', tags: ['철학', '인문', '번역서'], desc: '북유럽 철학자의 신작', lecture: null },
      { id: 'b6', title: '사이클 투자 법칙', author: '조윤남 지음', genre: '경제 · 투자', cover: '/uploads/cd52ee5bff3ec53eb02c5a0e4fce2526.jpg', tags: ['주식', '투자', '강연 포함'], desc: '실전 매매법', lecture: { desc: '투자 강연', perks: ['90분 심층 강의'] } }
    ]
  },
  {
    id: 'cycle-2025-h2', label: '2025 하반기', startDate: '2025-07-01', endDate: '2025-12-31', status: 'archived',
    books: [
      { id: 'a1', title: '미라클 모닝 다이어리', author: '할 엘로드', genre: '자기계발', cover: '', tags: ['자기계발', '루틴'], desc: '아침 30분이 인생을 바꾼다', lecture: null },
      { id: 'a2', title: '세계 경제의 미래', author: '김광석', genre: '경제', cover: '', tags: ['경제', '트렌드', '강연 포함'], desc: '거시경제 전망', lecture: { desc: '전망 강연', perks: ['90분 강연'] } }
    ]
  },
  {
    id: 'cycle-2025-h1', label: '2025 상반기', startDate: '2025-01-01', endDate: '2025-06-30', status: 'archived',
    books: [
      { id: 'p1', title: '돈의 속성', author: '김승호', genre: '경제 · 투자', cover: '', tags: ['투자', '재테크'], desc: '부의 본질', lecture: null }
    ]
  }
];

export default function ContentManager() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [isCreatingBook, setIsCreatingBook] = useState(false);

  useEffect(() => {
    // Load from memory/localstorage on mount
    try {
      const stored = localStorage.getItem('react_bookclub_cycles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCycles(parsed);
          setActiveId(parsed[0].id);
          return;
        }
      }
    } catch(e) {}
    setCycles(SEED_CYCLES);
    setActiveId(SEED_CYCLES[0].id);
  }, []);

  const saveCycles = (newCycles: any[]) => {
    setCycles(newCycles);
    try { localStorage.setItem('react_bookclub_cycles', JSON.stringify(newCycles)); } catch(e) {}
  };

  const activeCycle = cycles.find(c => c.id === activeId);

  // Cycle Actions
  const handleAddCycle = () => {
    const label = prompt('새 시즌 이름 (예: 2026 하반기)');
    if (!label) return;
    const newCycle = { id: 'cycle-' + Date.now(), label, startDate: '2026-07-01', endDate: '2026-12-31', status: 'draft', books: [] };
    const newCycles = [newCycle, ...cycles];
    saveCycles(newCycles);
    setActiveId(newCycle.id);
  };

  const handleEditCycle = () => {
    if (!activeCycle) return;
    const newLabel = prompt('시즌 이름', activeCycle.label);
    if (!newLabel) return;
    const newCycles = cycles.map(c => c.id === activeCycle.id ? { ...c, label: newLabel } : c);
    saveCycles(newCycles);
  };

  const handleDeleteCycle = () => {
    if (!activeCycle || !confirm(`'${activeCycle.label}' 시즌을 정말 삭제하시겠습니까?`)) return;
    const newCycles = cycles.filter(c => c.id !== activeCycle.id);
    saveCycles(newCycles);
    setActiveId(newCycles[0]?.id || null);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!activeCycle) return;
    const newCycles = cycles.map(c => c.id === activeCycle.id ? { ...c, status: e.target.value } : c);
    saveCycles(newCycles);
  };

  const resetData = () => {
    if (confirm('기본 예시 데이터를 다시 불러오시겠습니까? 기존 데이터는 덮어씌워집니다.')) {
      saveCycles(SEED_CYCLES);
      setActiveId(SEED_CYCLES[0].id);
    }
  };

  // Book Actions
  const handleDeleteBook = (bookId: string) => {
    if (!confirm('이 도서를 삭제하시겠습니까?')) return;
    const newCycles = cycles.map(c => c.id === activeCycle.id ? { ...c, books: c.books.filter((b: any) => b.id !== bookId) } : c);
    saveCycles(newCycles);
  };

  const saveBook = (book: any) => {
    if (isCreatingBook) {
      const newBook = { ...book, id: 'b-' + Date.now() };
      const newCycles = cycles.map(c => c.id === activeCycle.id ? { ...c, books: [...c.books, newBook] } : c);
      saveCycles(newCycles);
    } else {
      const newCycles = cycles.map(c => c.id === activeCycle.id ? { ...c, books: c.books.map((b: any) => b.id === book.id ? book : b) } : c);
      saveCycles(newCycles);
    }
    setEditingBook(null);
    setIsCreatingBook(false);
  };

  const renderStatus = (status: string) => {
    const map: any = { active: '운영중', archived: '종료', draft: '준비중' };
    const colorMap: any = { active: '#fc6640', archived: '#8a8478', draft: '#eab308' };
    return <span style={{ background: colorMap[status], color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>{map[status]}</span>;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px', padding: '20px', background: '#faf8f4', minHeight: '800px', borderRadius: '8px', border: '1px solid #e5dfd2' }}>
      {/* Sidebar */}
      <aside style={{ borderRight: '1px solid #e5dfd2', paddingRight: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1815' }}>시즌</h3>
          <div>
            <button onClick={resetData} style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '6px' }}>초기화</button>
            <button onClick={handleAddCycle} style={{ fontSize: '1rem', padding: '2px 8px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
          </div>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {cycles.map(c => (
            <li 
              key={c.id} 
              onClick={() => setActiveId(c.id)}
              style={{ padding: '12px', background: activeId === c.id ? '#f3ede2' : 'transparent', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px', border: activeId === c.id ? '1px solid #cfc8b8' : '1px solid transparent' }}
            >
              <div style={{ fontWeight: 600, color: '#1a1815', marginBottom: '4px' }}>{c.label} {renderStatus(c.status)}</div>
              <div style={{ fontSize: '0.75rem', color: '#8a8478' }}>도서 {c.books.length}권 · {c.startDate} ~ {c.endDate}</div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content */}
      <main>
        {!activeCycle ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: '#8a8478' }}>시즌을 선택하세요</div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5dfd2', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px 0', color: '#1a1815' }}>{activeCycle.label}</h2>
                <div style={{ fontSize: '0.85rem', color: '#8a8478' }}>{activeCycle.startDate} ~ {activeCycle.endDate} · 상태: <strong>{({active:'운영중',archived:'종료',draft:'준비중'} as any)[activeCycle.status]}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={activeCycle.status} onChange={handleStatusChange} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #cfc8b8' }}>
                  <option value="draft">준비중</option>
                  <option value="active">운영중</option>
                  <option value="archived">종료</option>
                </select>
                <button onClick={handleEditCycle} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer' }}>시즌 수정</button>
                <button onClick={handleDeleteCycle} style={{ padding: '6px 12px', background: '#fff', color: '#c0392b', border: '1px solid #f5c6cb', borderRadius: '4px', cursor: 'pointer' }}>삭제</button>
              </div>
            </div>

            {/* Books Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>도서 목록 <span style={{ color: '#8a8478', fontSize: '1rem', fontWeight: 400 }}>{activeCycle.books.length}권</span></h3>
              <button onClick={() => { setIsCreatingBook(true); setEditingBook({ title:'', author:'', genre:'', cover:'', tags:[], desc:'', lecture:null }); }} style={{ padding: '8px 16px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>+ 도서 추가</button>
            </div>

            {/* Books List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isCreatingBook && <BookEditForm book={editingBook} onSave={saveBook} onCancel={() => setIsCreatingBook(false)} />}
              
              {activeCycle.books.map((book: any) => (
                <div key={book.id}>
                  {editingBook?.id === book.id ? (
                    <BookEditForm book={editingBook} onSave={saveBook} onCancel={() => setEditingBook(null)} />
                  ) : (
                    <div style={{ display: 'flex', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5dfd2', gap: '16px', alignItems: 'center' }}>
                      <div style={{ width: '48px', height: '64px', background: '#f3ede2', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#8a8478', textAlign: 'center' }}>
                        {book.cover ? <img src={book.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="cover"/> : book.title.slice(0, 5)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1a1815', marginBottom: '4px' }}>{book.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#8a8478', marginBottom: '8px' }}>{book.author} · {book.genre}</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {book.tags.map((t: string) => <span key={t} style={{ fontSize: '0.7rem', background: '#f3ede2', padding: '2px 8px', borderRadius: '12px', color: '#4a463f' }}>{t}</span>)}
                          {book.lecture && <span style={{ fontSize: '0.7rem', background: '#fde7df', color: '#d44d2a', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>+ 저자 강연권</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingBook(book)} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>편집</button>
                        <button onClick={() => handleDeleteBook(book.id)} style={{ padding: '6px 12px', background: '#fff', color: '#c0392b', border: '1px solid #f5c6cb', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {activeCycle.books.length === 0 && !isCreatingBook && <div style={{ padding: '40px', textAlign: 'center', color: '#8a8478', border: '1px dashed #cfc8b8', borderRadius: '8px' }}>등록된 도서가 없습니다.</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BookEditForm({ book, onSave, onCancel }: { book: any, onSave: (b: any) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({ ...book, tagsStr: (book.tags || []).join(', ') });

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData({ ...formData, lecture: checked ? { desc: '', perks: [] } : null });
    } else if (name.startsWith('lecture.')) {
      const field = name.split('.')[1];
      setFormData({ ...formData, lecture: { ...formData.lecture, [field]: value } });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.author) { alert('제목과 저자를 입력해주세요.'); return; }
    onSave({
      ...formData,
      tags: formData.tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean),
      lecture: formData.lecture ? {
        ...formData.lecture,
        perks: typeof formData.lecture.perks === 'string' ? formData.lecture.perks.split('\n').map((p: string) => p.trim()).filter(Boolean) : formData.lecture.perks
      } : null
    });
  };

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '2px solid #1a1815' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>도서 편집</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div><label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>제목 *</label><input name="title" value={formData.title} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} /></div>
        <div><label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>저자 *</label><input name="author" value={formData.author} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} /></div>
        <div><label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>장르</label><input name="genre" value={formData.genre} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} /></div>
        <div><label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>표지 URL</label><input name="cover" value={formData.cover} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} /></div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>태그 (쉼표로 구분)</label>
        <input name="tagsStr" value={formData.tagsStr} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>설명</label>
        <textarea name="desc" value={formData.desc || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', minHeight: '80px', fontFamily: 'inherit' }} />
      </div>
      <div style={{ marginBottom: '16px', background: '#f9f9f9', padding: '12px', borderRadius: '6px', border: '1px solid #e5dfd2' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" checked={!!formData.lecture} onChange={handleChange} /> 저자 강연권 포함
        </label>
        
        {!!formData.lecture && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>강연 설명</label>
              <textarea name="lecture.desc" value={formData.lecture.desc || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', minHeight: '60px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>혜택 (한 줄에 하나씩)</label>
              <textarea name="lecture.perks" value={Array.isArray(formData.lecture.perks) ? formData.lecture.perks.join('\n') : formData.lecture.perks || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px', minHeight: '60px', fontFamily: 'inherit' }} />
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
        <button onClick={handleSubmit} style={{ padding: '8px 16px', background: '#1a1815', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>저장</button>
      </div>
    </div>
  );
}
