"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatKoreanDate } from '@/utils/dateFormatter';

export default function NoticeManager() {
  const [notices, setNotices] = useState<any[]>([]);
  const [editingNotice, setEditingNotice] = useState<any | null>(null);
  const [isCreatingNotice, setIsCreatingNotice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load notices', error);
      } else {
        setNotices(data || []);
      }
    } catch (err) {
      console.error('Exception loading notices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const handleAddClick = () => {
    setIsCreatingNotice(true);
    setEditingNotice({
      title: '',
      content: '',
      is_pinned: false,
      image_urls: []
    });
  };

  const handleEditClick = (notice: any) => {
    setIsCreatingNotice(false);
    setEditingNotice({ ...notice });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까? 관련 이미지도 모두 삭제됩니다.')) return;
    
    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/admin/notices/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`삭제 실패: ${errorData.error}`);
        return;
      }
      
      alert('삭제되었습니다.');
      loadNotices();
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotice.title.trim() || !editingNotice.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) return;

      const url = isCreatingNotice ? '/api/admin/notices' : `/api/admin/notices/${editingNotice.id}`;
      const method = isCreatingNotice ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editingNotice.title,
          content: editingNotice.content,
          is_pinned: editingNotice.is_pinned,
          image_urls: editingNotice.image_urls
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`저장 실패: ${errorData.error}`);
        return;
      }

      alert('저장되었습니다.');
      setEditingNotice(null);
      setIsCreatingNotice(false);
      loadNotices();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('JPG, PNG, WEBP 이미지만 업로드 가능합니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지는 최대 5MB까지 업로드 가능합니다.');
      return;
    }

    try {
      setUploading(true);
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) return;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/notices/images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`이미지 업로드 실패: ${data.error}`);
        return;
      }

      setEditingNotice({
        ...editingNotice,
        image_urls: [...(editingNotice.image_urls || []), data.url]
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error(err);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setEditingNotice({
      ...editingNotice,
      image_urls: editingNotice.image_urls.filter((_: any, idx: number) => idx !== indexToRemove)
    });
  };

  if (loading) return <div>불러오는 중...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>공지사항 관리</h2>
        {!editingNotice && (
          <button 
            onClick={handleAddClick}
            style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            새 공지 작성
          </button>
        )}
      </div>

      {editingNotice ? (
        <div style={{ background: '#f8f9fa', padding: '24px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{isCreatingNotice ? '공지 작성' : '공지 수정'}</h3>
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>상단 고정 여부</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  checked={editingNotice.is_pinned}
                  onChange={(e) => setEditingNotice({...editingNotice, is_pinned: e.target.checked})}
                />
                상단에 고정 표시하기
              </label>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>제목</label>
              <input 
                type="text" 
                value={editingNotice.title} 
                onChange={(e) => setEditingNotice({...editingNotice, title: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                placeholder="공지사항 제목"
                required
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>내용</label>
              <textarea 
                value={editingNotice.content} 
                onChange={(e) => setEditingNotice({...editingNotice, content: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '200px' }}
                placeholder="공지사항 내용 (여러 문단 작성 가능)"
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>이미지 첨부</label>
              <input 
                type="file" 
                accept="image/jpeg, image/png, image/webp"
                onChange={handleImageUpload}
                ref={fileInputRef}
                disabled={uploading}
                style={{ marginBottom: '12px' }}
              />
              {uploading && <span style={{ marginLeft: '12px', fontSize: '0.9rem', color: '#666' }}>업로드 중...</span>}
              
              {editingNotice.image_urls && editingNotice.image_urls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
                  {editingNotice.image_urls.map((url: string, idx: number) => (
                    <div key={idx} style={{ position: 'relative', width: '120px', height: '120px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                      <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveImage(idx)}
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setEditingNotice(null)}
                style={{ padding: '10px 20px', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                type="submit"
                style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                저장
              </button>
            </div>
          </form>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', background: '#fafafa' }}>
              <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>고정</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>제목</th>
              <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>작성일</th>
              <th style={{ padding: '12px', textAlign: 'center', width: '160px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {notices.map((n: any) => (
              <tr key={n.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {n.is_pinned ? <span style={{ background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>공지</span> : '-'}
                </td>
                <td style={{ padding: '12px' }}>{n.title}</td>
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>{formatKoreanDate(n.created_at)}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => handleEditClick(n)} style={{ marginRight: '8px', padding: '4px 8px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>수정</button>
                  <button onClick={() => handleDelete(n.id)} style={{ padding: '4px 8px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>삭제</button>
                </td>
              </tr>
            ))}
            {notices.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#666' }}>등록된 공지사항이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
