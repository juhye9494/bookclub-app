"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SEED_EVENTS = [
  {
    id: 'ev-1',
    title: '[저자강연] 정경자 대표의 "공간 정리로 인생 바꾸기" 특강',
    category: '저자강연',
    date: '2026-06-15 (월) 19:30',
    location: '한국경제신문사 18층 다산홀 (오프라인 & 온라인 병행)',
    cover: '/uploads/author_lecture_event.png',
    description: '인생 정리 전문가 정경자 대표가 제안하는 공간 경영 및 정리 노하우 특강입니다.<br/><br/><strong>[강연 핵심 내용]</strong><br/>• 복잡한 생각과 물건을 비우는 \'비움의 미학\'<br/>• 생활주기별 공간 수납 설계 팁<br/>• 시간과 정서적 에너지를 회복하는 힐링 세션<br/><br/><strong>[회원 전용 혜택]</strong><br/>• 정리수납 1:1 현장 상담 (선착순 5명)<br/>• 정리 체크리스트 및 가이드북 PDF 제공',
    status: '모집중',
    order_idx: 0
  },
  {
    id: 'ev-2',
    title: '한경 언더라인 2026 네트워킹 디너 "Success Night"',
    category: '패밀리행사',
    date: '2026-07-10 (금) 18:30',
    location: '포시즌스 호텔 서울 그랜드볼룸',
    cover: '/uploads/networking_dinner_event.png',
    description: '한경 언더라인의 우수 멤버 및 오피니언 리더들이 함께 모여 인사이트를 나누고 네트워크를 형성하는 연례 네트워킹 행사입니다.<br/><br/><strong>[행사 구성]</strong><br/>• Part 1: 2026 하반기 경제 트렌드 스페셜 강연<br/>• Part 2: 멤버십 갈라 디너 및 네트워킹 세션<br/>• Part 3: 행운권 추첨 및 특별 기념품 증정',
    status: '진행예정',
    order_idx: 1
  },
  {
    id: 'ev-3',
    title: '[멤버십 혜택] 예술의전당 "베르나르 뷔페" 특별초대전 티켓 제공',
    category: '문화제휴',
    date: '2026-05-01 ~ 2026-06-30',
    location: '예술의전당 한가람미술관',
    cover: '/uploads/art_exhibition_event.png',
    description: '20세기 현대 미술의 거장, 베르나르 뷔페의 대형 회고전에 한경 언더라인 회원 여러분을 무료 초대합니다.<br/><br/><strong>[제공 혜택]</strong><br/>• 골드/프리미엄 멤버: 전시 무료 관람권 2매 증정<br/>• 일반 멤버: 현장 티켓 30% 특별 할인<br/>• 오디오 가이드 모바일 쿠폰 무료 배포',
    status: '모집중',
    order_idx: 2
  }
];

export default function EventManager() {
  const [events, setEvents] = useState<any[]>([]);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Record<string, any[]>>({});
  const [viewingParticipants, setViewingParticipants] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('order_idx', { ascending: true });

      if (error) {
        console.error('Failed to load events from DB', error);
      } else {
        setEvents(data || []);
      }
    } catch (err) {
      console.error('Failed to execute query', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleAddEventClick = () => {
    setIsCreatingEvent(true);
    setEditingEvent({
      title: '',
      category: '저자강연',
      date: '',
      location: '',
      cover: '',
      description: '',
      status: '모집중',
      order_idx: events.length
    });
  };

  const handleSaveEvent = async (event: any) => {
    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) return;

      if (isCreatingEvent) {
        const newEvent = {
          ...event,
          id: 'ev-' + Date.now(),
          order_idx: events.length
        };
        const res = await fetch('/api/admin/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(newEvent)
        });
        if (!res.ok) {
          const err = await res.json();
          alert('이벤트 추가 실패: ' + (err.error || res.statusText));
        } else {
          alert('이벤트가 추가되었습니다.');
        }
      } else {
        const res = await fetch(`/api/admin/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(event)
        });
        if (!res.ok) {
          const err = await res.json();
          alert('이벤트 수정 실패: ' + (err.error || res.statusText));
        } else {
          alert('이벤트가 저장되었습니다.');
        }
      }
      setEditingEvent(null);
      setIsCreatingEvent(false);
      await loadEvents();
    } catch (err: any) {
      alert('오류 발생: ' + err.message);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('이 이벤트를 정말 삭제하시겠습니까?')) return;
    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        alert('이벤트 삭제 실패: ' + (err.error || res.statusText));
      } else {
        await loadEvents();
      }
    } catch (err: any) {
      alert('오류 발생: ' + err.message);
    }
  };

  const moveEvent = async (index: number, direction: number) => {
    const list = [...events];
    if (index + direction < 0 || index + direction >= list.length) return;

    // Swap
    const temp = list[index];
    list[index] = list[index + direction];
    list[index + direction] = temp;

    setLoading(true);
    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/events/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ list })
      });
      if (!res.ok) {
        console.error('Error reordering events');
      } else {
        await loadEvents();
      }
    } catch (err) {
      console.error('Error reordering events:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatApplicationDate = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(value));

  const loadParticipants = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    
    if (!token) return;

    try {
      const res = await fetch('/api/admin/event-participants', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      const data = result.data;

      if (data) {
        const grouped: Record<string, any[]> = {};
        data.forEach((p: any) => {
          if (p.status === '취소' || p.status === 'CANCELLED' || p.is_cancelled === true) return;
          
          if (!grouped[p.event_id]) grouped[p.event_id] = [];
          
          const uniqueKey = p.user_id || p.user_email;
          const isDuplicate = grouped[p.event_id].some(existing => (existing.user_id || existing.user_email) === uniqueKey);
          
          if (!isDuplicate) {
            grouped[p.event_id].push(p);
          }
        });
        setParticipants(grouped);
      }
    } catch (e) {
      console.error('Failed to load participants');
    }
  };

  const handleDownloadCSV = (event: any, applicants: any[]) => {
    if (!applicants || applicants.length === 0) {
      alert('다운로드할 신청자가 없습니다.');
      return;
    }

    const toExcelText = (value: unknown) => {
      if (value === null || value === undefined || value === '') return '';
      return `\t${String(value)}`;
    };

    const escapeCsvValue = (value: unknown) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };

    const headers = ['이벤트명', '이름', '연락처', '신청일'];
    
    const rows = applicants.map(p => {
      return [
        escapeCsvValue(event.title),
        escapeCsvValue(p.user_name),
        escapeCsvValue(toExcelText(p.user_phone)),
        escapeCsvValue(formatApplicationDate(p.created_at))
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const safeTitle = event.title.replace(/[\\/:*?"<>|]/g, '');
    const dateStr = new Date().toISOString().split('T')[0];
    
    link.setAttribute('download', `한경언더라인_이벤트신청자_${safeTitle}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => { loadParticipants(); }, [events]);

  if (loading && events.length === 0) return <div style={{ padding: '40px', textAlign: 'center' }}>이벤트 목록 불러오는 중...</div>;

  return (
    <div style={{ background: '#faf8f4', padding: '32px', borderRadius: '12px', border: '1px solid #e5dfd2', minHeight: '600px' }}>
      
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5dfd2', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1815', margin: 0 }}>📅 이벤트 관리</h2>
          <p style={{ fontSize: '0.8rem', color: '#8a8478', marginTop: '4px' }}>저자강연, 패밀리행사, 문화제휴 항목을 생성하고 정렬할 수 있습니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleAddEventClick} 
            style={{ padding: '8px 16px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
          >
            + 새 이벤트 추가
          </button>
        </div>
      </div>

      {/* Editor & List Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isCreatingEvent && editingEvent && (
          <EventEditForm 
            event={editingEvent} 
            onSave={handleSaveEvent} 
            onCancel={() => { setIsCreatingEvent(false); setEditingEvent(null); }} 
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {events.map((ev, index) => (
            <div key={ev.id}>
              {editingEvent?.id === ev.id && !isCreatingEvent ? (
                <EventEditForm 
                  event={editingEvent} 
                  onSave={handleSaveEvent} 
                  onCancel={() => setEditingEvent(null)} 
                />
              ) : (
                <>
                <div style={{ display: 'flex', background: '#fff', padding: '16px', borderRadius: '10px', border: '1px solid #e5dfd2', gap: '16px', alignItems: 'center' }}>
                  {/* Sorting Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button 
                      onClick={() => moveEvent(index, -1)} 
                      disabled={index === 0} 
                      style={{ padding: '3px 8px', background: index === 0 ? '#f9f9f9' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? '#ccc' : '#1a1815', fontSize: '0.75rem' }}
                    >
                      ▲
                    </button>
                    <button 
                      onClick={() => moveEvent(index, 1)} 
                      disabled={index === events.length - 1} 
                      style={{ padding: '3px 8px', background: index === events.length - 1 ? '#f9f9f9' : '#e5dfd2', border: 'none', borderRadius: '4px', cursor: index === events.length - 1 ? 'not-allowed' : 'pointer', color: index === events.length - 1 ? '#ccc' : '#1a1815', fontSize: '0.75rem' }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Thumbnail */}
                  <div style={{ width: '80px', height: '50px', background: '#f3ede2', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#8a8478', border: '1px solid #e5dfd2' }}>
                    {ev.cover ? (
                      <img src={ev.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="cover"/>
                    ) : (
                      'No Image'
                    )}
                  </div>

                  {/* Metadata */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.7rem', background: '#fde7df', color: '#fc6640', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {ev.category}
                      </span>
                      <span style={{ fontSize: '0.7rem', background: ev.status === '모집중' ? '#eef5ff' : '#eee', color: ev.status === '모집중' ? '#3b82f6' : '#666', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {ev.status || '모집중'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1815' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#8a8478', marginTop: '4px' }}>
                      📅 {ev.date} &nbsp;|&nbsp; 📍 {ev.location}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={() => setViewingParticipants(viewingParticipants === ev.id ? null : ev.id)}
                      style={{ padding: '6px 12px', background: (participants[ev.id]?.length || 0) > 0 ? '#fef3c7' : '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#92400e' }}
                    >
                      👥 신청자 {participants[ev.id]?.length || 0}명
                    </button>
                    <button 
                      onClick={() => setEditingEvent(ev)} 
                      style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                    >
                      편집
                    </button>
                    <button 
                      onClick={() => handleDeleteEvent(ev.id)} 
                      style={{ padding: '6px 12px', background: '#fff', color: '#c0392b', border: '1px solid #f5c6cb', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {/* Participant list dropdown */}
                {viewingParticipants === ev.id && (participants[ev.id]?.length || 0) > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0 0 10px 10px', padding: '12px 16px', marginTop: '-1px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', margin: 0 }}>신청자 목록 ({participants[ev.id].length}명)</p>
                      <button 
                        onClick={() => handleDownloadCSV(ev, participants[ev.id])}
                        disabled={participants[ev.id].length === 0}
                        style={{
                          fontSize: '0.75rem', padding: '4px 8px', background: '#f59e0b', color: '#fff',
                          border: 'none', borderRadius: '4px', cursor: participants[ev.id].length === 0 ? 'not-allowed' : 'pointer',
                          opacity: participants[ev.id].length === 0 ? 0.5 : 1
                        }}
                      >
                        CSV 다운로드
                      </button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead><tr style={{ borderBottom: '1px solid #fde68a' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', color: '#78716c' }}>이름</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', color: '#78716c' }}>연락처</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', color: '#78716c' }}>신청일</th>
                      </tr></thead>
                      <tbody>
                        {participants[ev.id].map((p: any) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #fef3c7' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{p.user_name}</td>
                            <td style={{ padding: '6px 8px', color: '#78716c' }}>{p.user_phone || '-'}</td>
                            <td style={{ padding: '6px 8px', color: '#78716c' }}>{formatApplicationDate(p.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </>
              )}
            </div>
          ))}

          {events.length === 0 && !isCreatingEvent && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8a8478', border: '1px dashed #cfc8b8', borderRadius: '12px', background: '#fff' }}>
              등록된 이벤트가 존재하지 않습니다. 상단의 <strong>'+ 새 이벤트 추가'</strong> 혹은 <strong>'기본 데이터 채우기'</strong> 버튼을 눌러주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventEditForm({ event, onSave, onCancel }: { event: any, onSave: (e: any) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({ ...event });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.date || !formData.location) {
      alert('이벤트 제목, 일시, 장소를 모두 입력해주세요.');
      return;
    }
    onSave(formData);
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #1a1815', marginBottom: '16px' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700 }}>✏️ 이벤트 작성 / 편집</h4>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>이벤트 제목 *</label>
          <input 
            name="title" 
            value={formData.title} 
            onChange={handleChange} 
            placeholder="예: [저자강연] 정경자 대표 공간정리법 강의" 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem' }} 
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>카테고리</label>
          <select 
            name="category" 
            value={formData.category} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="저자강연">저자강연</option>
            <option value="패밀리행사">패밀리행사</option>
            <option value="문화제휴">문화제휴</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>진행 일시 *</label>
          <input 
            name="date" 
            value={formData.date} 
            onChange={handleChange} 
            placeholder="예: 2026-06-15 (월) 19:30" 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem' }} 
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>장소 *</label>
          <input 
            name="location" 
            value={formData.location} 
            onChange={handleChange} 
            placeholder="예: 한국경제신문사 18층 다산홀" 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem' }} 
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>포스터/썸네일 이미지 URL</label>
            <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', border: '1px solid #cfc8b8' }}>
              📷 포스터 업로드
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fileExt = file.name.split('.').pop();
                  const fileName = `event_${Date.now()}.${fileExt}`;
                  const { error } = await supabase.storage.from('books').upload(`events/${fileName}`, file);
                  if (error) { 
                    alert('포스터 업로드 실패: ' + error.message); 
                    return; 
                  }
                  const { data } = supabase.storage.from('books').getPublicUrl(`events/${fileName}`);
                  setFormData((prev: any) => ({ ...prev, cover: data.publicUrl }));
                  e.target.value = '';
                }} 
              />
            </label>
          </div>
          <input 
            name="cover" 
            value={formData.cover || ''} 
            onChange={handleChange} 
            placeholder="직접 입력 혹은 포스터 업로드 이용" 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem' }} 
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>진행 상태</label>
          <select 
            name="status" 
            value={formData.status || '모집중'} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="모집중">모집중</option>
            <option value="진행예정">진행예정</option>
            <option value="종료">종료</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>모집 인원</label>
          <input 
            name="capacity" 
            value={formData.capacity || ''} 
            onChange={handleChange} 
            placeholder="예: 50명 (선착순)" 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem' }} 
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>발표 일정</label>
          <input 
            name="announcement_date" 
            value={formData.announcement_date || ''} 
            onChange={handleChange} 
            placeholder="예: 2026-07-20 (일) 당체자 개별 안내" 
            style={{ width: '100%', padding: '10px', border: '1px solid #cfc8b8', borderRadius: '6px', fontSize: '0.85rem' }} 
          />
        </div>
      </div>

      {/* Rich Text Editor */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>상세 소개글 <span style={{ color: '#8a8478', fontWeight: 400 }}>(줄바꿈은 엔터, HTML 태그 지원)</span></label>
          <label style={{ cursor: 'pointer', background: '#f3ede2', padding: '3px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #cfc8b8' }}>
            🖼️ 본문 이미지 삽입
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fileExt = file.name.split('.').pop();
                const fileName = `img_${Date.now()}.${fileExt}`;
                const { error } = await supabase.storage.from('books').upload(`descriptions/${fileName}`, file);
                
                if (error) {
                  alert('이미지 삽입 실패: ' + error.message);
                  return;
                }
                const { data } = supabase.storage.from('books').getPublicUrl(`descriptions/${fileName}`);
                
                const textarea = document.getElementById('event-desc-textarea') as HTMLTextAreaElement;
                const currentText = formData.description || '';
                const cursorPos = textarea ? textarea.selectionStart : currentText.length;
                const textBefore = currentText.substring(0, cursorPos);
                const textAfter = currentText.substring(cursorPos);
                const imgTag = `\n<img src="${data.publicUrl}" style="width:100%" />\n`;
                
                setFormData((prev: any) => ({
                  ...prev,
                  description: textBefore + imgTag + textAfter
                }));
                e.target.value = '';
              }} 
            />
          </label>
        </div>
        <textarea 
          id="event-desc-textarea" 
          name="description" 
          value={formData.description || ''} 
          onChange={handleChange} 
          placeholder="상세 정보를 기입해주세요. 강연 목차나 회원 특전 등 상세한 내용을 적어주시면 좋습니다." 
          style={{ width: '100%', padding: '12px', border: '1px solid #cfc8b8', borderRadius: '6px', minHeight: '220px', fontFamily: 'inherit', lineHeight: '1.6', fontSize: '0.88rem', resize: 'vertical' }} 
        />
      </div>

      {/* Button Controls */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button 
          onClick={onCancel} 
          style={{ padding: '8px 18px', background: '#fff', border: '1px solid #cfc8b8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500 }}
        >
          취소
        </button>
        <button 
          onClick={handleSubmit} 
          style={{ padding: '8px 18px', background: '#1a1815', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}
        >
          이벤트 저장
        </button>
      </div>
    </div>
  );
}
