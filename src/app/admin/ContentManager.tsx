"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Seed data
const SEED_CYCLES = [
  {
    id: 'cycle-2026-h1', label: '2026 상반기', start_date: '2026-01-01', end_date: '2026-06-30', status: 'active',
    books: [
      { id: 'b1', title: 'CES 2026', author: '한국경제신문 × The Miilk', genre: '테크 · 트렌드', cover: '/uploads/041f16811654291628de9f342681dbb1.png', tags: ['IT · 기술', 'AI · 혁신'], description: 'AI 리더십부터 로봇공학, 양자컴퓨터까지 — 세계 최대 가전·IT 박람회 CES 2026의 모든 것을 한 권에 담았습니다. 한국경제신문과 The Miilk이 공동 취재한 현장 리포트와 전문가 인사이트를 통해 2026년 기술 트렌드를 선점하세요.', lecture: null },
      { id: 'b2', title: '정리로 시작하는 인생 리셋', author: '정경자 지음', genre: '라이프스타일', cover: '/uploads/ce7fe03d39caf9b1708cba7e5e7faa83.jpg', tags: ['정리 · 수납', '라이프스타일', '강연 포함'], description: '10만 가구의 변화를 이끌어온 정리 전문가 정경자의 인생 정리 바이블. 생각·시간·공간을 한꺼번에 리셋하는 실전 방법론을 담았습니다. "정리는 끝이 아니라 변화의 시작이다!" 정리수납 노하우부터 생활주기별 정리 TIP, 공간 경영 철학까지 모두 수록했습니다.', lecture: { desc: '저자 정경자가 직접 진행하는 "공간 정리로 인생 바꾸기" 온라인 강연.', perks: ['60분 실전 정리 강의', '공간별 체크리스트 PDF 제공', '1:1 Q&A 세션 포함'] } },
      { id: 'b3', title: '프로젝트리츠로 일하는 법', author: '강병기 외 4인', genre: '부동산 · 비즈니스', cover: '/uploads/fd38af558278f9de5a15d0ab05aaf85e.jpg', tags: ['부동산', '리츠', '강연 포함'], description: '새로운 부동산 개발 플랫폼 PROJECT REITs의 모든 것. 개발·운영·공모·상장까지, 리츠 전문가 5인이 집필한 국내 최초 리츠 종합 안내서입니다. 실무 현장의 생생한 사례와 함께 복잡한 리츠 구조를 명쾌하게 정리했습니다.', lecture: { desc: '저자 5인이 릴레이로 진행하는 "리츠 실무 완전정복" 온라인 강연 시리즈.', perks: ['총 3회 릴레이 강연 (각 60분)', '리츠 투자 체크리스트 PDF', '실무 사례집 별책 제공'] } },
      { id: 'b4', title: '퍼지키즈', author: '한지우 지음', genre: '교육 · 자녀교육', cover: '/uploads/d1bae06b6d279117f4aeacbd777accbb.jpg', tags: ['AI 교육', '인문학', '강연 포함'], description: 'AI 시대의 새로운 인재상을 제시하는 혁신적 교육서. 속도보다 방향, 지식보다 감각을 키우는 인문학 자녀교육의 핵심을 담았습니다. 방종임 교육대기자TV, 독지선 선생님 강력 추천! 초등 학부모 필독서로 꼽히는 베스트셀러입니다.', lecture: { desc: '저자 한지우가 직접 강의하는 "AI 시대 아이 키우기" 학부모 특강.', perks: ['75분 온라인 특강', '연령별 인문학 교육 로드맵 PDF', '학부모 커뮤니티 초대'] } },
      { id: 'b5', title: '덜 멍청하게 살기 위한 최소한의 철학', author: '라르스 스벤젠', genre: '철학 · 인문', cover: '/uploads/775c4d1d6677a6abd5ce990900c13cb0.jpg', tags: ['철학', '인문', '번역서'], description: '전 세계 35개 언어로 읽히는 북유럽 철학자 라르스 스벤젠의 신작. 멍청함은 지능이 아니라 태도다 — 타인의 멍청함에 화가 나고, 자신의 멍청함은 두려운 모든 사람을 위한 지적 수업.', lecture: null },
      { id: 'b6', title: '사이클 투자 법칙', author: '조윤남 지음', genre: '경제 · 투자', cover: '/uploads/cd52ee5bff3ec53eb02c5a0e4fce2526.jpg', tags: ['주식', '투자', '강연 포함'], description: '주식시장 슈퍼사이클에 올라타는 실전 매매법. 코스피 5,000 시대 필독서 — 위기는 피하고 기회는 확실히 잡아라! 홍성국 전 더불어민주당 최고위원, 이효석 HSD엔진 대표, 오라영 신한은행 패시브인덱 단장이 강력 추천한 투자 바이블입니다.', lecture: { desc: '저자 조윤남이 직접 진행하는 "사이클로 읽는 주식시장" 투자 강연.', perks: ['90분 심층 분석 강의', '사이클 투자 체크리스트 PDF', '비공개 Q&A 세션'] } }
    ]
  },
  {
    id: 'cycle-2025-h2', label: '2025 하반기', start_date: '2025-07-01', end_date: '2025-12-31', status: 'archived',
    books: [
      { id: 'a1', title: '미라클 모닝 다이어리', author: '할 엘로드', genre: '자기계발', cover: '', tags: ['자기계발', '루틴'], description: '아침 30분이 인생을 바꾼다', lecture: null },
      { id: 'a2', title: '세계 경제의 미래', author: '김광석', genre: '경제', cover: '', tags: ['경제', '트렌드', '강연 포함'], description: '거시경제 전망', lecture: { desc: '전망 강연', perks: ['90분 강연'] } }
    ]
  },
  {
    id: 'cycle-2025-h1', label: '2025 상반기', start_date: '2025-01-01', end_date: '2025-06-30', status: 'archived',
    books: [
      { id: 'p1', title: '돈의 속성', author: '김승호', genre: '경제 · 투자', cover: '', tags: ['투자', '재테크'], description: '부의 본질', lecture: null }
    ]
  }
];

export default function ContentManager() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [isCreatingBook, setIsCreatingBook] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data: cyclesData, error: cycleErr } = await supabase.from('cycles').select('*').order('start_date', { ascending: false });
    const { data: booksData, error: bookErr } = await supabase.from('books').select('*');

    if (cycleErr || bookErr) {
      console.error('Failed to load DB', cycleErr, bookErr);
      setLoading(false);
      return;
    }

    const mapped = (cyclesData || []).map(c => ({
      ...c,
      books: (booksData || []).filter(b => b.cycle_id === c.id).sort((a, b) => (a.order_idx || 0) - (b.order_idx || 0))
    }));
    
    setCycles(mapped);
    if (mapped.length > 0 && !activeId) {
      setActiveId(mapped[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCycle = cycles.find(c => c.id === activeId);

  // Cycle Actions
  const handleAddCycle = async () => {
    const label = prompt('새 시즌 이름 (예: 2026 하반기)');
    if (!label) return;
    const newCycle = { id: 'cycle-' + Date.now(), label, start_date: '2026-07-01', end_date: '2026-12-31', status: 'draft' };
    await supabase.from('cycles').insert(newCycle);
    setActiveId(newCycle.id);
    await loadData();
  };

  const handleEditCycle = async () => {
    if (!activeCycle) return;
    const newLabel = prompt('시즌 이름', activeCycle.label);
    if (!newLabel) return;
    await supabase.from('cycles').update({ label: newLabel }).eq('id', activeCycle.id);
    await loadData();
  };

  const handleDeleteCycle = async () => {
    if (!activeCycle || !confirm(`'${activeCycle.label}' 시즌을 정말 삭제하시겠습니까?`)) return;
    await supabase.from('cycles').delete().eq('id', activeCycle.id);
    setActiveId(null);
    await loadData();
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!activeCycle) return;
    const newStatus = e.target.value;
    await supabase.from('cycles').update({ status: newStatus }).eq('id', activeCycle.id);
    await loadData();
  };

  const resetData = async () => {
    if (confirm('기본 예시 데이터를 다시 불러오시겠습니까? 기존 데이터는 모두 지워지고 초기화됩니다.')) {
      setLoading(true);
      // Delete all existing
      for (const c of cycles) {
        await supabase.from('cycles').delete().eq('id', c.id);
      }
      
      // Insert seeds
      for (const c of SEED_CYCLES) {
        await supabase.from('cycles').insert({ id: c.id, label: c.label, start_date: c.start_date, end_date: c.end_date, status: c.status });
        if (c.books.length > 0) {
          const mappedBooks = c.books.map(b => ({ ...b, cycle_id: c.id }));
          await supabase.from('books').insert(mappedBooks);
        }
      }
      setActiveId(SEED_CYCLES[0].id);
      await loadData();
    }
  };

  // Book Actions
  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('이 도서를 삭제하시겠습니까?')) return;
    await supabase.from('books').delete().eq('id', bookId);
    await loadData();
  };

  const saveBook = async (book: any) => {
    // Remove tagsStr which is only used for the UI form
    const payload = { ...book };
    delete payload.tagsStr;
    
    if (isCreatingBook) {
      const newBook = { ...payload, id: 'b-' + Date.now(), cycle_id: activeCycle.id, order_idx: activeCycle.books?.length || 0 };
      const { error } = await supabase.from('books').insert(newBook);
      if (error) alert('저장 실패: ' + error.message);
    } else {
      const { error } = await supabase.from('books').update(payload).eq('id', book.id);
      if (error) alert('저장 실패: ' + error.message);
    }
    setEditingBook(null);
    setIsCreatingBook(false);
    await loadData();
  };

  const moveBook = async (index: number, direction: number) => {
    if (!activeCycle || !activeCycle.books) return;
    const books = [...activeCycle.books];
    if (index + direction < 0 || index + direction >= books.length) return;
    
    // Swap
    const temp = books[index];
    books[index] = books[index + direction];
    books[index + direction] = temp;
    
    // Update order_idx for all books in cycle
    setLoading(true);
    for (let i = 0; i < books.length; i++) {
      await supabase.from('books').update({ order_idx: i }).eq('id', books[i].id);
    }
    await loadData();
  };

  const renderStatus = (status: string) => {
    const map: any = { active: '운영중', archived: '종료', draft: '준비중' };
    const colorMap: any = { active: '#fc6640', archived: '#8a8478', draft: '#eab308' };
    return <span style={{ background: colorMap[status] || '#ccc', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>{map[status] || status}</span>;
  };

  if (loading && cycles.length === 0) return <div style={{ padding: '40px', textAlign: 'center' }}>데이터베이스 불러오는 중...</div>;

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
              <div style={{ fontSize: '0.75rem', color: '#8a8478' }}>도서 {c.books?.length || 0}권 · {c.start_date} ~ {c.end_date}</div>
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
                <div style={{ fontSize: '0.85rem', color: '#8a8478' }}>{activeCycle.start_date} ~ {activeCycle.end_date} · 상태: <strong>{({active:'운영중',archived:'종료',draft:'준비중'} as any)[activeCycle.status]}</strong></div>
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
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>도서 목록 <span style={{ color: '#8a8478', fontSize: '1rem', fontWeight: 400 }}>{activeCycle.books?.length || 0}권</span></h3>
              <button onClick={() => { setIsCreatingBook(true); setEditingBook({ title:'', author:'', genre:'', cover:'', tags:[], description:'', lecture:null }); }} style={{ padding: '8px 16px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>+ 도서 추가</button>
            </div>

            {/* Books List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isCreatingBook && <BookEditForm book={editingBook} onSave={saveBook} onCancel={() => setIsCreatingBook(false)} />}
              
              {activeCycle.books?.map((book: any, index: number) => (
                <div key={book.id}>
                  {editingBook?.id === book.id ? (
                    <BookEditForm book={editingBook} onSave={saveBook} onCancel={() => setEditingBook(null)} />
                  ) : (
                    <div style={{ display: 'flex', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5dfd2', gap: '16px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button onClick={() => moveBook(index, -1)} disabled={index === 0} style={{ padding: '2px 6px', background: index === 0 ? '#f3ede2' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? '#cfc8b8' : '#1a1815' }}>▲</button>
                        <button onClick={() => moveBook(index, 1)} disabled={index === activeCycle.books.length - 1} style={{ padding: '2px 6px', background: index === activeCycle.books.length - 1 ? '#f3ede2' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: index === activeCycle.books.length - 1 ? 'not-allowed' : 'pointer', color: index === activeCycle.books.length - 1 ? '#cfc8b8' : '#1a1815' }}>▼</button>
                      </div>
                      <div style={{ width: '48px', height: '64px', background: '#f3ede2', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#8a8478', textAlign: 'center' }}>
                        {book.cover ? <img src={book.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="cover"/> : book.title.slice(0, 5)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1a1815', marginBottom: '4px' }}>{book.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#8a8478', marginBottom: '8px' }}>{book.author} · {book.genre}</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(book.tags||[]).map((t: string) => <span key={t} style={{ fontSize: '0.7rem', background: '#f3ede2', padding: '2px 8px', borderRadius: '12px', color: '#4a463f' }}>{t}</span>)}
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
              {(!activeCycle.books || activeCycle.books.length === 0) && !isCreatingBook && <div style={{ padding: '40px', textAlign: 'center', color: '#8a8478', border: '1px dashed #cfc8b8', borderRadius: '8px' }}>등록된 도서가 없습니다.</div>}
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
        <div><label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>장르</label><input name="genre" value={formData.genre || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} /></div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.8rem' }}>표지 URL</label>
            <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              📷 파일 업로드
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fileExt = file.name.split('.').pop();
                const fileName = `cover_${Date.now()}.${fileExt}`;
                const { error } = await supabase.storage.from('books').upload(`covers/${fileName}`, file);
                if (error) { alert('표지 업로드 실패 (Supabase SQL Editor에서 INSERT 정책을 추가해주세요): ' + error.message); return; }
                const { data } = supabase.storage.from('books').getPublicUrl(`covers/${fileName}`);
                setFormData((prev: any) => ({ ...prev, cover: data.publicUrl }));
                e.target.value = '';
              }} />
            </label>
          </div>
          <input name="cover" value={formData.cover || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
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
        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>태그 (쉼표로 구분)</label>
        <input name="tagsStr" value={formData.tagsStr} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
          <label style={{ fontSize: '0.8rem' }}>설명 <span style={{ color: '#8a8478', fontWeight: 400 }}>(줄바꿈은 엔터)</span></label>
          <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            📷 이미지 첨부하기
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              
              const fileExt = file.name.split('.').pop();
              const fileName = `img_${Date.now()}.${fileExt}`;
              const filePath = `descriptions/${fileName}`;
              
              // 1. Upload to Supabase Storage 'books' bucket
              const { error } = await supabase.storage.from('books').upload(filePath, file);
              
              if (error) {
                alert('이미지 업로드 실패! (Supabase 보안 정책 오류)\n\nSupabase 대시보드 -> SQL Editor 탭에 가서 아래 명령어를 실행해주세요:\n\nCREATE POLICY "Allow public uploads to books" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = \'books\');\n\n상세 에러: ' + error.message);
                return;
              }
              
              // 2. Get Public URL
              const { data } = supabase.storage.from('books').getPublicUrl(filePath);
              
              // 3. Insert into textarea at cursor position
              const textarea = document.getElementById('description-textarea') as HTMLTextAreaElement;
              setFormData((prev: any) => {
                const currentText = prev.description || '';
                const cursorPos = textarea ? textarea.selectionStart : currentText.length;
                const textBefore = currentText.substring(0, cursorPos);
                const textAfter = currentText.substring(cursorPos);
                const imgTag = `\n<img src="${data.publicUrl}" style="width:100%" />\n`;
                return { ...prev, description: textBefore + imgTag + textAfter };
              });
              
              e.target.value = ''; // Reset input
            }} />
          </label>
        </div>
        <textarea id="description-textarea" name="description" value={formData.description || ''} onChange={handleChange} style={{ width: '100%', padding: '12px', border: '1px solid #cfc8b8', borderRadius: '4px', minHeight: '300px', fontFamily: 'inherit', lineHeight: '1.6', resize: 'vertical' }} />
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
