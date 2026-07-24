"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const STATUS_OPTIONS = ['접수완료', '확인중', '답변완료'];
const CATEGORY_FILTERS = ['전체', '가입문의', '배송문의', '교환문의', '환불문의', '저자 섭외 문의', '독서모임 활동비 신청', '기타 문의'];

interface Inquiry {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_phone: string;
  category: string;
  title: string;
  content: string;
  attachment_url: string;
  status: string;
  admin_reply: string;
  created_at: string;
}

export default function InquiryManager() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingInquiry, setDeletingInquiry] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => { loadInquiries(); }, []);

  // attachment_url에서 Storage 파일 경로를 추출하는 헬퍼
  function extractFilePath(attachmentUrl: string): string {
    if (!attachmentUrl) return '';
    // 이미 전체 URL인 경우 (기존 데이터 호환): 경로 부분만 추출
    if (attachmentUrl.startsWith('http')) {
      const marker = '/object/public/inquiry-attachments/';
      const idx = attachmentUrl.indexOf(marker);
      if (idx !== -1) return attachmentUrl.substring(idx + marker.length);
      // signed URL 마커
      const signedMarker = '/object/sign/inquiry-attachments/';
      const sIdx = attachmentUrl.indexOf(signedMarker);
      if (sIdx !== -1) return attachmentUrl.substring(sIdx + signedMarker.length).split('?')[0];
      return '';
    }
    // 파일 경로만 저장된 경우 (새 데이터)
    return attachmentUrl;
  }

  async function resolveAttachmentUrls(inqs: Inquiry[]) {
    const urls: Record<string, string> = {};
    for (const inq of inqs) {
      if (!inq.attachment_url) continue;
      const filePath = extractFilePath(inq.attachment_url);
      if (!filePath) {
        console.warn(`[문의 ${inq.id}] 첨부 경로 추출 실패:`, inq.attachment_url);
        continue;
      }
      const { data, error } = await supabase.storage
        .from('inquiry-attachments')
        .createSignedUrl(filePath, 3600);
      if (error) {
        console.warn(`[문의 ${inq.id}] signed URL 생성 실패:`, error.message, '경로:', filePath);
        // fallback: public URL 시도
        const { data: pubData } = supabase.storage.from('inquiry-attachments').getPublicUrl(filePath);
        if (pubData?.publicUrl) urls[inq.id] = pubData.publicUrl;
      } else if (data?.signedUrl) {
        urls[inq.id] = data.signedUrl;
      }
    }
    setSignedUrls(urls);
  }

  async function loadInquiries() {
    setLoading(true);
    const { data } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });
    if (data) {
      setInquiries(data);
      resolveAttachmentUrls(data);
    }
    setLoading(false);
  }

  const filtered = inquiries.filter(inq => {
    if (filter !== '전체' && inq.category !== filter) return false;
    if (statusFilter !== '전체' && inq.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    total: inquiries.length,
    pending: inquiries.filter(i => i.status === '접수완료').length,
    reviewing: inquiries.filter(i => i.status === '확인중').length,
    replied: inquiries.filter(i => i.status === '답변완료').length,
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const inquiry = inquiries.find(i => i.id === id);
    // 답변완료 → 접수완료/확인중으로 되돌릴 때 답변도 초기화
    if (inquiry?.admin_reply && newStatus !== '답변완료') {
      if (!confirm('상태를 되돌리면 등록된 답변도 삭제됩니다. 계속하시겠습니까?')) return;
      await supabase.from('inquiries').update({ status: newStatus, admin_reply: '' }).eq('id', id);
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, admin_reply: '' } : i));
      setEditingReplyId(null);
      setReplyText('');
    } else {
      await supabase.from('inquiries').update({ status: newStatus }).eq('id', id);
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    }
  };

  async function handleDeleteInquiry(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm('이 회원의 문의를 삭제하시겠습니까?')) return;

    setDeletingInquiry(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        throw new Error('삭제에 실패했습니다.');
      }

      setInquiries(prev => prev.filter(inq => inq.id !== id));
      if (expandedId === id) setExpandedId(null);
      alert('문의가 삭제되었습니다.');
    } catch (err: any) {
      alert(err.message || '오류가 발생했습니다.');
    } finally {
      setDeletingInquiry(null);
    }
  }

  const submitReply = async (id: string) => {
    if (!replyText.trim()) { alert('답변 내용을 입력해주세요.'); return; }
    setSaving(true);
    await supabase.from('inquiries').update({ admin_reply: replyText, status: '답변완료' }).eq('id', id);
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, admin_reply: replyText, status: '답변완료' } : i));
    setReplyText('');
    setEditingReplyId(null);
    setSaving(false);
    alert('✅ 답변이 저장되었습니다.');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case '접수완료': return { bg: '#fef3c7', color: '#92400e' };
      case '확인중': return { bg: '#dbeafe', color: '#1d4ed8' };
      case '답변완료': return { bg: '#d1fae5', color: '#059669' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>문의 내역 불러오는 중...</div>;

  return (
    <div>
      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: '전체', value: counts.total, icon: '📋', sKey: '전체' },
          { label: '접수완료', value: counts.pending, icon: '⏳', sKey: '접수완료' },
          { label: '확인중', value: counts.reviewing, icon: '👀', sKey: '확인중' },
          { label: '답변완료', value: counts.replied, icon: '✅', sKey: '답변완료' },
        ].map(item => (
          <div key={item.sKey} onClick={() => setStatusFilter(item.sKey)}
            style={{
              background: statusFilter === item.sKey ? '#1a1815' : '#fff',
              color: statusFilter === item.sKey ? '#fff' : '#374151',
              padding: '14px', borderRadius: '12px', cursor: 'pointer',
              border: statusFilter === item.sKey ? '1px solid #1a1815' : '1px solid #e5e7eb',
              textAlign: 'center', transition: 'all 0.2s'
            }}>
            <div style={{ fontSize: '1.3rem' }}>{item.icon}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{item.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {CATEGORY_FILTERS.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              background: filter === cat ? 'var(--accent)' : '#fff', color: filter === cat ? '#fff' : '#6b7280',
              border: filter === cat ? 'none' : '1px solid #e5e7eb', transition: 'all 0.2s'
            }}>
            {cat}
          </button>
        ))}
        <button onClick={loadInquiries} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer' }}>🔄 새로고침</button>
      </div>

      {/* 문의 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            문의 내역이 없습니다.
          </div>
        ) : filtered.map(inq => (
          <div key={inq.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* Header */}
            <div onClick={() => { setExpandedId(expandedId === inq.id ? null : inq.id); setReplyText(inq.admin_reply || ''); }}
              style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>{inq.category}</span>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: getStatusStyle(inq.status).bg, color: getStatusStyle(inq.status).color }}>{inq.status}</span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{inq.title}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.78rem', color: '#9ca3af' }}>
                <span>{inq.user_name}</span>
                <span>{new Date(inq.created_at).toLocaleDateString()}</span>
                <button
                  onClick={(e) => handleDeleteInquiry(e, inq.id)}
                  disabled={deletingInquiry === inq.id}
                  style={{
                    padding: '4px 10px',
                    background: '#fff',
                    color: '#ef4444',
                    border: '1px solid #fca5a5',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: deletingInquiry === inq.id ? 'not-allowed' : 'pointer',
                    opacity: deletingInquiry === inq.id ? 0.6 : 1
                  }}
                >
                  {deletingInquiry === inq.id ? '삭제 중...' : '삭제'}
                </button>
                <span>{expandedId === inq.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded */}
            {expandedId === inq.id && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
                {/* 문의 정보 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '12px 0', fontSize: '0.8rem', color: '#6b7280' }}>
                  <div><strong>이름:</strong> {inq.user_name}</div>
                  <div><strong>이메일:</strong> {inq.user_email}</div>
                  <div><strong>연락처:</strong> {inq.user_phone}</div>
                </div>

                {/* 문의 내용 */}
                <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '8px', fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                  {inq.content}
                </div>
                {inq.attachment_url && signedUrls[inq.id] && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '6px' }}>📎 첨부 이미지</p>
                    <img
                      src={signedUrls[inq.id]}
                      alt="첨부 이미지"
                      onClick={() => setZoomedImage(signedUrls[inq.id])}
                      style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', border: '1px solid #e5e7eb', objectFit: 'cover', cursor: 'pointer', transition: 'opacity 0.2s' }}
                      onError={(e) => { console.warn(`[문의 ${inq.id}] 이미지 로드 실패:`, signedUrls[inq.id]); (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* 상태 변경 */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => updateStatus(inq.id, s)}
                      style={{
                        padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        background: inq.status === s ? getStatusStyle(s).bg : '#fff',
                        color: inq.status === s ? getStatusStyle(s).color : '#6b7280',
                        border: `1px solid ${inq.status === s ? getStatusStyle(s).color : '#e5e7eb'}`,
                      }}>
                      {s}
                    </button>
                  ))}
                </div>

                {/* 답변 영역 */}
                <div>
                  {inq.admin_reply && editingReplyId !== inq.id ? (
                    /* 등록된 답변 — 읽기 모드 */
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', marginBottom: '6px', display: 'block' }}>✅ 등록된 답변</label>
                      <div style={{ padding: '14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#374151' }}>
                        {inq.admin_reply}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button onClick={() => { setEditingReplyId(inq.id); setReplyText(inq.admin_reply); }}
                          style={{ padding: '7px 18px', background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                          ✏️ 답변 수정하기
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 답변 작성/수정 모드 */
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '6px', display: 'block' }}>
                        {inq.admin_reply ? '✏️ 답변 수정' : '📝 답변 작성'}
                      </label>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        rows={4} placeholder="답변 내용을 작성해주세요..."
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.88rem', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--sans)' }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                        {inq.admin_reply && (
                          <button onClick={() => { setEditingReplyId(null); setReplyText(''); }}
                            style={{ padding: '8px 18px', background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                            취소
                          </button>
                        )}
                        <button onClick={() => submitReply(inq.id)} disabled={saving}
                          style={{ padding: '8px 24px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                          {saving ? '저장 중...' : inq.admin_reply ? '답변 수정 저장' : '답변 저장'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Lightbox */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '24px' }}
        >
          <img src={zoomedImage} alt="확대 보기" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
