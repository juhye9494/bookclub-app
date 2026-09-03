"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function GroupsManager() {
  const [groups, setGroups] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      // Fetch groups
      const { data: gData, error: gError } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      if (gData) setGroups(gData);

      // Fetch participants
      const { data: pData, error: pError } = await supabase.from('group_participants').select('*');
      if (pData) setParticipants(pData);

      // Fetch profiles via admin API to bypass RLS and get decrypted PII
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch('/api/admin/profiles', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.profiles) setProfiles(data.profiles);
          }
        }
      } catch (err) {
        console.error('Failed to fetch admin profiles', err);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div>데이터를 불러오는 중...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px' }}>독서모임 관리</h2>
      
      {selectedGroup ? (
        <div>
          <button onClick={() => setSelectedGroup(null)} style={{ marginBottom: '16px', padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            ← 목록으로 돌아가기
          </button>
          
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>'{selectedGroup.title}' 참여자 목록</h3>
          
          <div style={{ background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>이름</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>이메일</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>연락처</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>역할</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>신청일</th>
                </tr>
              </thead>
              <tbody>
                {participants
                  .filter(p => p.group_id === selectedGroup.id)
                  .map(p => {
                    const profile = profiles.find(pr => pr.id === p.user_id);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px' }}>{profile?.name || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{profile?.email || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{profile?.phone || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{p.role === 'admin' || p.role === 'creator' ? '방장' : '참여자'}</td>
                        <td style={{ padding: '12px 16px' }}>{new Date(p.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
                      </tr>
                    );
                  })}
                {participants.filter(p => p.group_id === selectedGroup.id).length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>참여자가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {groups.map(group => (
            <div key={group.id} style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{group.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  도서: {group.book} | 상태: {group.status} | 인원: {group.membersCount}/{group.maxMembers}
                </div>
              </div>
              <button 
                onClick={() => setSelectedGroup(group)}
                style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                참여자 보기
              </button>
            </div>
          ))}
          {groups.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>생성된 독서모임이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
