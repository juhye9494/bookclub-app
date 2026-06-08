"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ContentManager from './ContentManager';
import EventManager from './EventManager';
import InsightManager from './InsightManager';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminAndFetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("관리자 로그인이 필요합니다.");
        router.push('/');
        return;
      }

      // 관리자 이메일 확인
      if (session.user.email !== 'xn940@naver.com') {
        alert("접근 권한이 없습니다. 관리자 계정으로 로그인해주세요.");
        router.push('/');
        return;
      }
      
      setUser(session.user);

      // 전체 주문 가져오기
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setOrders(data);
      }
      setLoading(false);
    }

    checkAdminAndFetchData();

    // Listen for auth state changes (e.g. logging out from the global header)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session || session.user?.email !== 'xn940@naver.com') {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // 배송 상태 변경 함수
  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ order_status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('상태 업데이트에 실패했습니다.');
    } else {
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_status: newStatus } : o));
    }
  };

  // 엑셀(CSV) 다운로드 함수
  const downloadCSV = () => {
    if (orders.length === 0) return;
    
    // CSV 헤더
    const headers = ['주문일자', '주문번호', '고객명', '연락처', '배송주소', '상태', '도서1', '도서2', '도서3'];
    
    // CSV 데이터 행 만들기
    const rows = orders.map(order => {
      const date = new Date(order.created_at).toLocaleDateString();
      const books = order.selected_books.map((b: any) => b.title);
      
      return [
        date,
        order.payment_order_id,
        order.user_name,
        order.user_phone,
        `"${order.user_address}"`, // 주소에 쉼표가 있을 수 있으므로 따옴표로 감쌈
        order.order_status,
        books[0] || '',
        books[1] || '',
        books[2] || ''
      ].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n'); // \uFEFF는 엑셀 한글 깨짐 방지용 BOM
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `한경언더라인독서클럽_주문목록_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [activeTab, setActiveTab] = useState('shipping'); // 'shipping', 'content', 'members'

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>데이터를 불러오는 중...</div>;

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'var(--sans)', paddingTop: '64px' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 5vw' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', fontWeight: 700, marginBottom: '24px', color: 'var(--text)' }}>
          관리자 대시보드
        </h1>
        
        {/* TABS */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb', marginBottom: '32px' }}>
          <button 
            onClick={() => setActiveTab('shipping')} 
            style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'shipping' ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: '-2px', fontWeight: activeTab === 'shipping' ? 700 : 500, color: activeTab === 'shipping' ? 'var(--text)' : '#6b7280', cursor: 'pointer', fontSize: '1rem' }}
          >
            📦 발송 관리
          </button>
          <button 
            onClick={() => setActiveTab('content')} 
            style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'content' ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: '-2px', fontWeight: activeTab === 'content' ? 700 : 500, color: activeTab === 'content' ? 'var(--text)' : '#6b7280', cursor: 'pointer', fontSize: '1rem' }}
          >
            📚 콘텐츠(도서/시즌) 관리
          </button>
          <button 
            onClick={() => setActiveTab('events')} 
            style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'events' ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: '-2px', fontWeight: activeTab === 'events' ? 700 : 500, color: activeTab === 'events' ? 'var(--text)' : '#6b7280', cursor: 'pointer', fontSize: '1rem' }}
          >
            📅 이벤트 관리
          </button>
          <button 
            onClick={() => setActiveTab('insights')} 
            style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'insights' ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: '-2px', fontWeight: activeTab === 'insights' ? 700 : 500, color: activeTab === 'insights' ? 'var(--text)' : '#6b7280', cursor: 'pointer', fontSize: '1rem' }}
          >
            📝 인사이트 관리
          </button>
          <button 
            onClick={() => setActiveTab('members')} 
            style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'members' ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: '-2px', fontWeight: activeTab === 'members' ? 700 : 500, color: activeTab === 'members' ? 'var(--text)' : '#6b7280', cursor: 'pointer', fontSize: '1rem' }}
          >
            👥 회원 관리
          </button>
        </div>

        {/* TAB 1: SHIPPING */}
        {activeTab === 'shipping' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>전체 주문 목록 ({orders.length}건)</h1>
              <button onClick={downloadCSV} style={{ padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                📥 엑셀(CSV) 다운로드
              </button>
            </div>

        <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: '#6b7280' }}>주문일자</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: '#6b7280' }}>주문번호</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: '#6b7280' }}>고객 정보</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: '#6b7280' }}>선택 도서</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: '#6b7280' }}>상태 관리</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>주문 내역이 없습니다.</td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '16px', fontSize: '0.85rem', color: '#374151', verticalAlign: 'top' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.8rem', color: '#6b7280', verticalAlign: 'top', wordBreak: 'break-all', maxWidth: '150px' }}>
                      {order.payment_order_id}
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.85rem', color: '#111827', verticalAlign: 'top', maxWidth: '250px' }}>
                      <strong>{order.user_name}</strong><br/>
                      <span style={{ color: '#6b7280' }}>{order.user_phone}</span><br/>
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{order.user_address}</span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.8rem', color: '#374151', verticalAlign: 'top' }}>
                      <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        {order.selected_books.map((b: any, idx: number) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{b.title}</li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
                      <select 
                        value={order.order_status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem', background: order.order_status === '배송중' ? '#eef5ff' : '#fff' }}
                      >
                        <option value="배송준비중">배송준비중</option>
                        <option value="배송중">배송중</option>
                        <option value="배송완료">배송완료</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </>
        )}

        {/* TAB 2: CONTENT */}
        {activeTab === 'content' && (
          <ContentManager />
        )}

        {/* TAB 4: EVENTS */}
        {activeTab === 'events' && (
          <EventManager />
        )}

        {/* TAB: INSIGHTS */}
        {activeTab === 'insights' && (
          <InsightManager />
        )}

        {/* TAB 3: MEMBERS */}
        {activeTab === 'members' && (
          <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#111' }}>회원 관리 기능</h2>
            <p>이곳에 회원들의 기본 정보(가입일자, 이메일, 마케팅 수신 동의 여부 등)가 표시될 예정입니다.<br/>현재 수파베이스 Authentication 대시보드에서 직접 회원을 관리하실 수 있습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
