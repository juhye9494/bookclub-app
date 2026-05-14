"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("로그인이 필요합니다.");
        router.push('/');
        return;
      }
      setUser(session.user);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setOrders(data);
      }
      setLoading(false);
    }
    fetchData();
  }, [router]);

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>로딩중...</div>;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--sans)' }}>
      {/* HEADER */}
      <nav style={{ padding: '18px 5vw', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: '#fff' }}>
        <Link href="/" style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)', textDecoration: 'none' }}>
          한경 <span style={{ color: 'var(--accent)' }}>석세스</span> 클럽
        </Link>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-mid)' }}>{user?.user_metadata?.name || user?.email}님</span>
          <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} style={{ background: 'none', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>로그아웃</button>
        </div>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 5vw' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', marginBottom: '40px' }}>나의 구독 현황</h1>

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>아직 구독 내역이 없습니다.</p>
            <Link href="/" style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: '40px', fontWeight: 600 }}>구독 신청하러 가기</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {orders.map((order, i) => (
              <div key={order.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>주문번호: {order.payment_order_id}</span>
                    <h3 style={{ fontSize: '1.2rem', marginTop: '4px' }}>한경 석세스 클럽 6개월권</h3>
                  </div>
                  <span style={{ padding: '6px 14px', background: order.order_status === '배송중' ? '#eef5ff' : 'var(--bg-warm)', color: order.order_status === '배송중' ? '#3b82f6' : 'var(--accent)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700 }}>
                    {order.order_status}
                  </span>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-mid)' }}>선택한 도서 4권</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                    {order.selected_books.map((book: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ width: '50px', height: '70px', background: book.img ? '#fff' : 'var(--bg-warm)', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                          {book.img ? <img src={book.img} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>{book.title}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{book.author}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-warm)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-mid)' }}>
                  <strong>배송 정보:</strong> {order.user_name} ({order.user_phone}) <br/>
                  {order.user_address}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
