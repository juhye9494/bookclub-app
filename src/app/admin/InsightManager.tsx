"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function InsightManager() {
  const [posts, setPosts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .order('order_idx', { ascending: true });
    if (data) setPosts(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 글을 삭제하시겠습니까?')) return;
    await supabase.from('insights').delete().eq('id', id);
    await loadData();
  };

  const handleSave = async (post: any) => {
    if (isCreating) {
      const newPost = { ...post, id: 'insight-' + Date.now(), order_idx: posts.length };
      const { error } = await supabase.from('insights').insert(newPost);
      if (error) { alert('저장 실패: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('insights').update(post).eq('id', post.id);
      if (error) { alert('수정 실패: ' + error.message); return; }
    }
    setEditing(null);
    setIsCreating(false);
    await loadData();
  };

  const movePost = async (index: number, direction: number) => {
    const items = [...posts];
    if (index + direction < 0 || index + direction >= items.length) return;
    const temp = items[index];
    items[index] = items[index + direction];
    items[index + direction] = temp;
    for (let i = 0; i < items.length; i++) {
      await supabase.from('insights').update({ order_idx: i }).eq('id', items[i].id);
    }
    await loadData();
  };

  if (loading && posts.length === 0) return <div style={{ padding: '40px', textAlign: 'center' }}>인사이트 데이터 불러오는 중...</div>;

  return (
    <div style={{ padding: '20px', background: '#faf8f4', minHeight: '600px', borderRadius: '8px', border: '1px solid #e5dfd2' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5dfd2', paddingBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px 0', color: '#1a1815' }}>플러스 인사이트 관리</h2>
          <p style={{ fontSize: '0.85rem', color: '#8a8478', margin: 0 }}>총 {posts.length}개 글</p>
        </div>
        <button
          onClick={() => { setIsCreating(true); setEditing({ title: '', author: '', day: '월요일', type: '에디터 칼럼', date: new Date().toISOString().slice(0, 10), summary: '', content: '', cover: '' }); }}
          style={{ padding: '10px 20px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
        >
          + 글 추가
        </button>
      </div>

      {/* Edit Form */}
      {(isCreating || editing) && (
        <InsightEditForm
          post={editing}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setIsCreating(false); }}
        />
      )}

      {/* Posts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {posts.map((post, index) => (
          editing?.id === post.id ? null : (
            <div key={post.id} style={{ display: 'flex', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5dfd2', gap: '16px', alignItems: 'center' }}>
              {/* Order arrows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button onClick={() => movePost(index, -1)} disabled={index === 0} style={{ padding: '2px 6px', background: index === 0 ? '#f3ede2' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? '#cfc8b8' : '#1a1815' }}>▲</button>
                <button onClick={() => movePost(index, 1)} disabled={index === posts.length - 1} style={{ padding: '2px 6px', background: index === posts.length - 1 ? '#f3ede2' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: index === posts.length - 1 ? 'not-allowed' : 'pointer', color: index === posts.length - 1 ? '#cfc8b8' : '#1a1815' }}>▼</button>
              </div>

              {/* Thumbnail */}
              <div style={{ width: '80px', height: '56px', background: '#f3ede2', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                {post.cover ? <img src={post.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#8a8478' }}>No Image</div>}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1a1815', marginBottom: '4px' }}>{post.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#8a8478' }}>
                  {post.author} · {post.type} · <span style={{ background: '#fde7df', color: '#d44d2a', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>{post.day}</span> · {post.date}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setEditing(post)} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>편집</button>
                <button onClick={() => handleDelete(post.id)} style={{ padding: '6px 12px', background: '#fff', color: '#c0392b', border: '1px solid #f5c6cb', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>삭제</button>
              </div>
            </div>
          )
        ))}
        {posts.length === 0 && !isCreating && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#8a8478', border: '1px dashed #cfc8b8', borderRadius: '8px' }}>
            등록된 인사이트 글이 없습니다.<br />위의 '+ 글 추가' 버튼으로 첫 글을 작성해 보세요.
          </div>
        )}
      </div>
    </div>
  );
}

function InsightEditForm({ post, onSave, onCancel }: { post: any, onSave: (p: any) => void, onCancel: () => void }) {
  const [form, setForm] = useState({ ...post });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = () => {
    if (!form.title || !form.author) { alert('제목과 작성자를 입력해주세요.'); return; }
    onSave(form);
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '2px solid #1a1815', marginBottom: '24px' }}>
      <h4 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 700 }}>{post.id ? '글 수정' : '새 글 작성'}</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>제목 *</label>
          <input name="title" value={form.title} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>작성자 *</label>
          <input name="author" value={form.author} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>발행 요일</label>
          <select name="day" value={form.day} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }}>
            <option>월요일</option>
            <option>화요일</option>
            <option>수요일</option>
            <option>목요일</option>
            <option>금요일</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>분류 (타입)</label>
          <input name="type" value={form.type} onChange={handleChange} placeholder="에디터 칼럼, 마케터 베스트 리뷰 등" style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>발행일</label>
          <input name="date" type="date" value={form.date} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>커버 이미지 URL</label>
            <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
              📷 업로드
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const ext = file.name.split('.').pop();
                const name = `insight_${Date.now()}.${ext}`;
                const { error } = await supabase.storage.from('books').upload(`insights/${name}`, file);
                if (error) { alert('업로드 실패: ' + error.message); return; }
                const { data } = supabase.storage.from('books').getPublicUrl(`insights/${name}`);
                setForm((prev: any) => ({ ...prev, cover: data.publicUrl }));
                e.target.value = '';
              }} />
            </label>
          </div>
          <input name="cover" value={form.cover || ''} onChange={handleChange} placeholder="https://..." style={{ width: '100%', padding: '8px', border: '1px solid #cfc8b8', borderRadius: '4px' }} />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 600 }}>요약 (카드에 표시)</label>
        <textarea name="summary" value={form.summary || ''} onChange={handleChange} style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '4px', minHeight: '80px', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>본문 내용 <span style={{ color: '#8a8478', fontWeight: 400 }}>(HTML 지원: &lt;br/&gt;, &lt;strong&gt;, &lt;em&gt; 등)</span></label>
          <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            📷 이미지 첨부
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const ext = file.name.split('.').pop();
              const name = `insight_img_${Date.now()}.${ext}`;
              const { error } = await supabase.storage.from('books').upload(`insights/${name}`, file);
              if (error) { alert('이미지 업로드 실패: ' + error.message); return; }
              const { data } = supabase.storage.from('books').getPublicUrl(`insights/${name}`);
              setForm((prev: any) => {
                const current = prev.content || '';
                return { ...prev, content: current + `\n<br/><img src="${data.publicUrl}" style="width:100%;border-radius:8px;margin:16px 0" /><br/>\n` };
              });
              e.target.value = '';
            }} />
          </label>
        </div>
        <textarea name="content" value={form.content || ''} onChange={handleChange} style={{ width: '100%', padding: '12px', border: '1px solid #cfc8b8', borderRadius: '4px', minHeight: '300px', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
        <button onClick={handleSubmit} style={{ padding: '8px 16px', background: '#1a1815', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>저장</button>
      </div>
    </div>
  );
}
