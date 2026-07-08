"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ContentManager from './ContentManager';
import EventManager from './EventManager';
import InsightManager from './InsightManager';
import MembersManager from './MembersManager';
import ShippingManager from './ShippingManager';

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

      // 관리자 이메일 확인
      const adminEmails = ['xn940@naver.com', 'ess0317@hankyung.com', 'parkjh@hankyung.com', 'lygin729@hankyung.com', 'mama0707@hankyung.com', 'pdh0109@hankyung.com', 'shchoi@hankyung.com', 'mwd101@hankyung.com', 'sj.flyme@gmail.com'];
      if (!adminEmails.includes(session.user.email || '')) {
        alert("접근 권한이 없습니다. 관리자 계정으로 로그인해주세요.");
        router.push('/');
        return;
      }
      
      setUser(session.user);
      setLoading(false);
    }

    checkAdminAndFetchData();

    // Listen for auth state changes (e.g. logging out from the global header)
    const adminEmails = ['xn940@naver.com', 'ess0317@hankyung.com', 'parkjh@hankyung.com', 'lygin729@hankyung.com', 'mama0707@hankyung.com', 'pdh0109@hankyung.com', 'shchoi@hankyung.com', 'mwd101@hankyung.com', 'sj.flyme@gmail.com'];
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session || !adminEmails.includes(session.user?.email || '')) {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

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
          <ShippingManager />
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
          <MembersManager />
        )}
      </main>
    </div>
  );
}
