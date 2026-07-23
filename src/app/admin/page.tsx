"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isAdmin } from '@/utils/admin';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ContentManager from './ContentManager';
import EventManager from './EventManager';
import InsightManager from './InsightManager';
import MembersManager from './MembersManager';
import ShippingManager from './ShippingManager';
import InquiryManager from './InquiryManager';
import CyclesManager from './CyclesManager';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminAndFetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("관리자 로그인이 필요합니다.");
        router.push('/');
        return;
      }

      if (!isAdmin(session.user.email)) {
        alert("접근 권한이 없습니다. 관리자 계정으로 로그인해주세요.");
        router.push('/');
        return;
      }
      
      setUser(session.user);
      setLoading(false);
    }

    checkAdminAndFetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session || !isAdmin(session.user?.email)) {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const [activeTab, setActiveTab] = useState('shipping');

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>데이터를 불러오는 중...</div>;

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'var(--sans)', paddingTop: '64px' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 5vw' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', fontWeight: 700, marginBottom: '24px', color: 'var(--text)' }}>
          관리자 대시보드
        </h1>
        
        {/* TABS */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb', marginBottom: '32px', overflowX: 'auto' }}>
          {['shipping', 'cycles', 'content', 'members', 'events', 'insights', 'inquiries'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)} 
              style={{ 
                padding: '12px 16px', background: 'none', border: 'none', 
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent', 
                marginBottom: '-2px', fontWeight: activeTab === tab ? 700 : 500, 
                color: activeTab === tab ? 'var(--text)' : '#6b7280', cursor: 'pointer', fontSize: '1rem', whiteSpace: 'nowrap'
              }}
            >
              {tab === 'shipping' && '책 발송 관리'}
              {tab === 'cycles' && '기수 관리'}
              {tab === 'content' && '기수별 도서 관리'}
              {tab === 'members' && '회원 및 배송 관리'}
              {tab === 'events' && '이벤트 관리'}
              {tab === 'insights' && '인사이트 관리'}
              {tab === 'inquiries' && '고객 센터 문의'}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          {activeTab === 'shipping' && <ShippingManager />}
          {activeTab === 'cycles' && <CyclesManager />}
          {activeTab === 'content' && <ContentManager />}
          {activeTab === 'members' && <MembersManager />}
          {activeTab === 'events' && <EventManager />}
          {activeTab === 'insights' && <InsightManager />}
          {activeTab === 'inquiries' && <InquiryManager />}
        </div>
      </main>
    </div>
  );
}
