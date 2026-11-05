"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ConsentMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'unanswered' | 'agreed' | 'rejected' | 'withdrawn';
  privacy_marketing_consent: boolean;
  email_marketing_consent: boolean;
  sms_marketing_consent: boolean;
  is_email_eligible: boolean;
  is_sms_eligible: boolean;
  consent_version: string;
  consent_source: string;
  consented_at: string | null;
  updated_at: string | null;
  created_at: string;
}

interface SummaryData {
  total_members: number;
  email_eligible_count: number;
  sms_eligible_count: number;
  unanswered_count: number;
  rejected_or_withdrawn_count: number;
}

interface HistoryItem {
  id: string;
  user_id: string;
  status: string;
  privacy_marketing_consent: boolean;
  email_marketing_consent: boolean;
  sms_marketing_consent: boolean;
  action_type: string;
  consent_version: string;
  consent_source: string;
  created_at: string;
}

export default function MarketingConsentManager() {
  const [members, setMembers] = useState<ConsentMember[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    total_members: 0,
    email_eligible_count: 0,
    sms_eligible_count: 0,
    unanswered_count: 0,
    rejected_or_withdrawn_count: 0
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'email_eligible' | 'sms_eligible' | 'unanswered' | 'rejected_or_withdrawn'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 이력 모달 상태
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<ConsentMember | null>(null);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 엑셀 다운로드 중 상태
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        search,
        filter,
        page: String(currentPage),
        limit: '20'
      });

      const res = await fetch(`/api/admin/marketing-consents?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '회원 마케팅 동의 목록을 불러오지 못했습니다.');
        return;
      }

      const data = await res.json();
      setMembers(data.members || []);
      setSummary(data.summary || {
        total_members: 0,
        email_eligible_count: 0,
        sms_eligible_count: 0,
        unanswered_count: 0,
        rejected_or_withdrawn_count: 0
      });
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);

    } catch (e) {
      console.error(e);
      alert('데이터 요청에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  useEffect(() => {
    fetchMembers();
  }, [search, filter, currentPage]);

  // 특정 회원의 이력 조회
  const handleOpenHistory = async (member: ConsentMember) => {
    setSelectedUserForHistory(member);
    setHistoryLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/admin/marketing-consents/${member.id}/history`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      } else {
        alert('이력을 불러오지 못했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('이력 조회 중 오류가 발생했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = async () => {
    setIsDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('로그인이 필요합니다.');
        return;
      }

      const params = new URLSearchParams({
        search,
        filter
      });

      const res = await fetch(`/api/admin/marketing-consents/download?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '엑셀 다운로드에 실패했습니다.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = 'marketing_consent_list.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (e) {
      console.error('Download error:', e);
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'agreed':
        return <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>동의</span>;
      case 'rejected':
        return <span style={{ padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>거부</span>;
      case 'withdrawn':
        return <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>철회</span>;
      case 'unanswered':
      default:
        return <span style={{ padding: '4px 10px', background: '#f3f4f6', color: '#6b7280', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>미응답</span>;
    }
  };

  const getSourceLabel = (src: string) => {
    switch (src) {
      case 'signup': return '회원가입';
      case 'popup': return '안내팝업';
      case 'consent_page': return '동의페이지';
      case 'mypage': return '마이페이지';
      default: return src || '-';
    }
  };

  const getActionLabel = (act: string) => {
    switch (act) {
      case 'agree': return '최초 동의';
      case 'update': return '설정 변경';
      case 'reject': return '명시적 거부';
      case 'withdraw': return '수신 철회';
      default: return act;
    }
  };

  return (
    <div>
      {/* 통계 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>전체 회원 수</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a' }}>
            {summary.total_members.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>명</span>
          </div>
        </div>

        <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '14px', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600 }}>📨 이메일 발송 가능</span>
            <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '8px' }}>개인정보+이메일</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1e3a8a' }}>
            {summary.email_eligible_count.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>명</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#60a5fa', marginTop: '4px' }}>
            전체 중 {summary.total_members ? Math.round((summary.email_eligible_count / summary.total_members) * 100) : 0}%
          </div>
        </div>

        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>📱 문자(SMS) 발송 가능</span>
            <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '8px' }}>개인정보+문자</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#14532d' }}>
            {summary.sms_eligible_count.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>명</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#4ade80', marginTop: '4px' }}>
            전체 중 {summary.total_members ? Math.round((summary.sms_eligible_count / summary.total_members) * 100) : 0}%
          </div>
        </div>

        <div style={{ background: '#fafafa', padding: '20px', borderRadius: '14px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>⏳ 미응답 회원</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#4b5563' }}>
            {summary.unanswered_count.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>명</span>
          </div>
        </div>

        <div style={{ background: '#fff1f2', padding: '20px', borderRadius: '14px', border: '1px solid #fecdd3' }}>
          <div style={{ fontSize: '0.85rem', color: '#be123c', marginBottom: '8px' }}>🚫 거부 및 철회</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#9f1239' }}>
            {summary.rejected_or_withdrawn_count.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>명</span>
          </div>
        </div>

      </div>

      {/* 검색 & 필터 & 다운로드 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        
        {/* 필터 탭 */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'all', label: '전체' },
            { id: 'email_eligible', label: '📨 이메일 발송 대상' },
            { id: 'sms_eligible', label: '📱 문자 발송 대상' },
            { id: 'unanswered', label: '⏳ 미응답' },
            { id: 'rejected_or_withdrawn', label: '🚫 거부·철회자' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: filter === t.id ? 'var(--accent, #1e3a8a)' : '#e5e7eb',
                background: filter === t.id ? 'var(--accent, #1e3a8a)' : '#fff',
                color: filter === t.id ? '#fff' : '#4b5563',
                fontSize: '0.88rem',
                fontWeight: filter === t.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 검색 및 엑셀 다운로드 버튼 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="이름, 이메일, 전화번호 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '9px 14px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.88rem',
              width: '240px'
            }}
          />

          <button
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            style={{
              padding: '9px 18px',
              background: '#15803d',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: isDownloading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span>📊</span>
            <span>{isDownloading ? '다운로드 중...' : '엑셀 다운로드'}</span>
          </button>
        </div>

      </div>

      <div style={{ fontSize: '0.84rem', color: '#6b7280', marginBottom: '14px' }}>
        총 <strong>{totalCount.toLocaleString()}</strong>명의 회원이 조회되었습니다.
        <span style={{ marginLeft: '10px', color: '#9ca3af' }}>
          * 발송 대상 명단은 개인정보 마케팅 이용 동의와 해당 채널 수신 동의를 모두 충족한 회원만 포함되며, 탈퇴·철회한 회원은 자동 제외됩니다.
        </span>
      </div>

      {/* 회원 테이블 */}
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
              <th style={{ padding: '12px 16px' }}>회원명</th>
              <th style={{ padding: '12px 16px' }}>이메일</th>
              <th style={{ padding: '12px 16px' }}>연락처</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>개인정보 동의</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>이메일 동의</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>문자 동의</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>상태</th>
              <th style={{ padding: '12px 16px' }}>최종 설정일시</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>신청경로</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>이력</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: '60px 0', textAlign: 'center', color: '#9ca3af' }}>
                  회원 데이터를 불러오는 중...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '60px 0', textAlign: 'center', color: '#9ca3af' }}>
                  검색 및 필터 조건에 일치하는 회원이 없습니다.
                </td>
              </tr>
            ) : (
              members.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
                    {m.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                    {m.email}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                    {m.phone || '-'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {m.privacy_marketing_consent ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>동의</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>미동의</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {m.email_marketing_consent ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>동의</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>미동의</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {m.sms_marketing_consent ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>동의</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>미동의</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {getStatusBadge(m.status)}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.8rem' }}>
                    {m.consented_at ? new Date(m.consented_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                    {getSourceLabel(m.consent_source)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleOpenHistory(m)}
                      style={{
                        padding: '4px 10px',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        color: '#374151'
                      }}
                    >
                      이력
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '24px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              background: '#fff',
              borderRadius: '6px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              style={{
                padding: '6px 12px',
                border: '1px solid',
                borderColor: currentPage === p ? 'var(--accent, #1e3a8a)' : '#d1d5db',
                background: currentPage === p ? 'var(--accent, #1e3a8a)' : '#fff',
                color: currentPage === p ? '#fff' : '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: currentPage === p ? 700 : 400
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              background: '#fff',
              borderRadius: '6px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            다음
          </button>
        </div>
      )}

      {/* 변경 이력 확인 모달 */}
      {selectedUserForHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '640px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* 모달 헤더 */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>
                  마케팅 동의 변경 이력
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#6b7280', margin: 0 }}>
                  {selectedUserForHistory.name} ({selectedUserForHistory.email})
                </p>
              </div>
              <button
                onClick={() => setSelectedUserForHistory(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#9ca3af', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* 모달 본문 (이력 리스트) */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  이력을 불러오는 중...
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  기록된 변경 이력이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {historyList.map(h => (
                    <div
                      key={h.id}
                      style={{
                        padding: '16px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        background: '#f9fafb'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                          {getActionLabel(h.action_type)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {new Date(h.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.82rem', marginBottom: '8px' }}>
                        <div>개인정보: <strong style={{ color: h.privacy_marketing_consent ? '#16a34a' : '#64748b' }}>{h.privacy_marketing_consent ? '동의' : '미동의'}</strong></div>
                        <div>이메일: <strong style={{ color: h.email_marketing_consent ? '#16a34a' : '#64748b' }}>{h.email_marketing_consent ? '동의' : '미동의'}</strong></div>
                        <div>문자(SMS): <strong style={{ color: h.sms_marketing_consent ? '#16a34a' : '#64748b' }}>{h.sms_marketing_consent ? '동의' : '미동의'}</strong></div>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', gap: '12px' }}>
                        <span>신청경로: <strong>{getSourceLabel(h.consent_source)}</strong></span>
                        <span>약관버전: <strong>{h.consent_version}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedUserForHistory(null)}
                style={{
                  padding: '8px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
