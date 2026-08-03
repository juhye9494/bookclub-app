"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function PaymentPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [openCycles, setOpenCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    async function loadOpenCycles() {
      try {
        const res = await fetch('/api/cycles/open');
        const data = await res.json();
        if (data.cycles) {
          setOpenCycles(data.cycles);
          if (data.cycles.length > 0) {
            setSelectedCycleId(data.cycles[0].id);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadOpenCycles();
  }, []);

  const handlePayment = async () => {
    let token: string | undefined;
    if (!selectedCycleId) {
      alert('구독할 기수를 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      
      if (!clientKey) {
        console.error('[CRITICAL] NEXT_PUBLIC_TOSS_CLIENT_KEY is not configured.');
        alert('결제 설정을 확인할 수 없습니다. 관리자에게 문의해주세요.');
        setLoading(false);
        return;
      }
      
      if (typeof (window as any).TossPayments === 'undefined') {
        alert('결제 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      
      const tossPayments = await (window as any).TossPayments(clientKey);
      
      // 1. 서버에 주문 초기화(PENDING) 및 고유 orderId 발급 요청
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        setLoading(false);
        return;
      }

      let profile;
      try {
        const profileRes = await fetch('/api/profile', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });
        
        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            alert('로그인 정보가 만료되었습니다.');
          } else if (profileRes.status === 404) {
            alert('프로필 정보를 찾을 수 없습니다.');
          } else {
            alert('결제에 필요한 회원정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
          }
          setLoading(false);
          return;
        }
        
        profile = await profileRes.json();
      } catch (err) {
        alert('결제에 필요한 회원정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      if (!profile?.name || !profile?.phone) {
        alert('결제에 필요한 회원정보를 불러오지 못했습니다. 마이페이지에서 이름과 연락처를 확인해 주세요.');
        setLoading(false);
        return;
      }

      const initRes = await fetch('/api/payments/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cycle_id: selectedCycleId }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.orderId) {
        alert(initData.error || '주문 생성에 실패했습니다. 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      const payment = tossPayments.payment({ customerKey: user.id });
      
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: initData.amount },
        orderId: initData.orderId,
        orderName: `한경 언더라인 독서클럽 (${openCycles.find(c => c.id === selectedCycleId)?.name || '구독'})`,
        successUrl: `${window.location.origin}/success`,
        failUrl: `${window.location.origin}/fail`,
        customerEmail: user.email || '',
        customerName: profile.name,
        customerMobilePhone: (profile.phone || '').replace(/-/g, ''),
      });
    } catch (err: any) {
      if (err?.code === 'PAY_PROCESS_CANCELED' || err?.code === 'USER_CANCEL') {
        alert('결제가 완료되지 않았습니다.\n다시 시도해주세요.');
      } else {
        console.error(err);
        alert('결제창을 띄우는데 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '120px 20px', textAlign: 'center', minHeight: '60vh' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '20px' }}>로그인이 필요합니다</h2>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-login'))} style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '60px auto', padding: '0 20px', minHeight: '60vh' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>구독 결제</h1>
      <p style={{ color: '#6b7280', marginBottom: '32px' }}>구독할 기수를 선택하고 결제를 진행해주세요.</p>

      {openCycles.length === 0 ? (
        <div style={{ padding: '40px', background: '#f9fafb', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>
          현재 모집 중인 기수가 없습니다.
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>모집 중인 기수</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {openCycles.map(cycle => (
              <label 
                key={cycle.id}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', 
                  border: `2px solid ${selectedCycleId === cycle.id ? 'var(--accent)' : '#e5e7eb'}`,
                  borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  background: selectedCycleId === cycle.id ? '#f0f5ff' : '#fff'
                }}
              >
                <input 
                  type="radio" 
                  name="cycle" 
                  value={cycle.id} 
                  checked={selectedCycleId === cycle.id}
                  onChange={() => setSelectedCycleId(cycle.id)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111' }}>{cycle.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>
                    신청 기간: {new Date(cycle.selection_start_date || cycle.subscription_start_date).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} ~ {new Date(cycle.selection_end_date || cycle.subscription_end_date).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#4b5563', fontWeight: 600 }}>구독 금액</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>45,000원</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>* 결제 완료 후 마이페이지에서 원하시는 도서를 선택할 수 있습니다.</p>
          </div>

          <button 
            onClick={handlePayment} 
            disabled={loading || !selectedCycleId}
            style={{ 
              width: '100%', padding: '16px', background: (loading || !selectedCycleId) ? '#9ca3af' : 'var(--accent)', 
              color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, 
              cursor: (loading || !selectedCycleId) ? 'not-allowed' : 'pointer', transition: 'background 0.2s' 
            }}
          >
            {loading ? '결제 준비 중...' : '결제하기'}
          </button>
        </div>
      )}
    </div>
  );
}
