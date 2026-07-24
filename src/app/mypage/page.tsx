"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DaumPostcodeEmbed from 'react-daum-postcode';

type TabType = 'orders' | 'profile' | 'activity' | 'inquiry';

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [isCancelProcessing, setIsCancelProcessing] = useState(false);
  const [ordersFetchError, setOrdersFetchError] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);
  
  const handleCancelOrder = async (orderId: string) => {
    setIsCancelProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '결제 취소 중 오류가 발생했습니다.');
      } else {
        alert('구독 결제가 취소되었습니다.');
        setOrders(orders.map(o => o.id === orderId ? { ...o, payment_status: 'CANCELLED' } : o));
      }
    } catch (e: any) {
      alert('취소 요청에 실패했습니다.');
    } finally {
      setIsCancelProcessing(false);
      setCancelingOrderId(null);
    }
  };
  const [activitySubTab, setActivitySubTab] = useState<'groups' | 'events'>('groups');
  const [groupParticipations, setGroupParticipations] = useState<any[]>([]);
  const [eventParticipations, setEventParticipations] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [expandedInquiry, setExpandedInquiry] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Profile edit state
  const [name, setName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [deletingInquiry, setDeletingInquiry] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [zonecode, setZonecode] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelingBookOrderId, setCancelingBookOrderId] = useState<string | null>(null);

  const handleCancelBookOrder = async (bookOrderId: string) => {
    if (!window.confirm('선택한 도서 신청을 취소하시겠습니까?')) return;
    setCancelingBookOrderId(bookOrderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const res = await fetch(`/api/book-orders/${bookOrderId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '취소 중 오류가 발생했습니다.');
      alert('도서 신청이 취소되었습니다.');
      // Update local state instead of full reload for better UX if needed, or reload:
      window.location.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCancelingBookOrderId(null);
    }
  };

  const handleDeleteInquiry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('이 문의를 삭제하시겠습니까?')) return;

    setDeletingInquiry(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        throw new Error('삭제에 실패했습니다.');
      }

      alert('문의가 삭제되었습니다.');
      setInquiries(prev => prev.filter(inq => inq.id !== id));
    } catch (err: any) {
      alert(err.message || '오류가 발생했습니다.');
    } finally {
      setDeletingInquiry(null);
    }
  };

  // Password change state
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("로그인이 필요합니다.");
        router.push('/');
        return;
      }
      setUser(session.user);

      // 프로필 정보 초기화
      const meta = session.user.user_metadata || {};
      setName(meta.name || '');
      setPhone(meta.phone || '');
      const fullAddress = meta.address || '';
      // [우편번호] 주소 상세주소 형태 파싱
      const zipMatch = fullAddress.match(/^\[(\d+)\]\s*/);
      if (zipMatch) {
        setZonecode(zipMatch[1]);
        const rest = fullAddress.replace(zipMatch[0], '');
        // 상세주소는 마지막 공백 기준으로 분리 시도
        const lastSpaceIdx = rest.lastIndexOf(' ');
        if (lastSpaceIdx > 10) {
          setAddress(rest.substring(0, lastSpaceIdx));
          setDetailAddress(rest.substring(lastSpaceIdx + 1));
        } else {
          setAddress(rest);
        }
      } else {
        setAddress(fullAddress);
      }

      setOrdersLoading(true);

      const { data: doneOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*, cycle:cycles!fk_orders_cycle_id(id, name, label, subscription_end_date, book_order_start_date, book_order_end_date, status, max_book_count, shipping_start)')
        .eq('user_id', session.user.id)
        .neq('payment_status', 'PENDING')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('orders fetch error:', ordersError);
        setOrdersFetchError(true);
        setOrdersLoading(false);
      } else if (doneOrders) {
        setOrdersFetchError(false);
        const orderIds = doneOrders.map(o => o.id);
        
        let bookOrderRows: any[] | null = null;
        let bookItemRows: any[] | null = null;
        let bookRows: any[] | null = null;
        let bookOrdersError = null;
        let bookItemsError = null;
        let booksError = null;

        if (orderIds.length > 0) {
          const { data: boData, error: boErr } = await supabase
            .from('book_orders')
            .select('id, subscription_order_id, user_id, cycle_id, order_status, created_at, updated_at')
            .eq('user_id', session.user.id)
            .in('subscription_order_id', orderIds)
            .order('created_at', { ascending: false });

          if (boErr) {
            console.error('book orders fetch error:', boErr);
            bookOrdersError = boErr;
          } else {
            bookOrderRows = boData;
          }
        }

        if (bookOrderRows && bookOrderRows.length > 0) {
          const bookOrderIds = bookOrderRows.map(bo => bo.id);
          const { data: itemsData, error: itemsErr } = await supabase
            .from('book_order_items')
            .select('id, book_order_id, book_id, title_snapshot, quantity, created_at')
            .in('book_order_id', bookOrderIds);
            
          if (itemsErr) {
            console.error('book order items fetch error:', itemsErr);
            bookItemsError = itemsErr;
          } else {
            bookItemRows = itemsData;
          }
        }

        if (bookItemRows && bookItemRows.length > 0) {
          const uniqueBookIds = Array.from(new Set(bookItemRows.map(item => item.book_id).filter(id => id)));
          if (uniqueBookIds.length > 0) {
            const { data: bData, error: bErr } = await supabase
              .from('books')
              .select('id, title, author, cover_url')
              .in('id', uniqueBookIds);
              
            if (bErr) {
              console.error('books fetch error:', bErr);
              booksError = bErr;
            } else {
              bookRows = bData;
            }
          }
        }

        const booksById = new Map(
          (bookRows || []).map(book => [String(book.id), book])
        );

        const itemsByOrderId = new Map<string, any[]>();
        (bookItemRows || []).forEach(item => {
          const key = String(item.book_order_id);
          const current = itemsByOrderId.get(key) || [];
          current.push({
            ...item,
            book: item.book_id ? (booksById.get(String(item.book_id)) || null) : null,
          });
          itemsByOrderId.set(key, current);
        });

        let hydratedBookOrders = null;
        if (bookOrderRows) {
          hydratedBookOrders = bookOrderRows.map(bo => ({
            ...bo,
            book_order_items: itemsByOrderId.get(String(bo.id)) || [],
          }));
        }

        const combined = doneOrders.map(o => ({
          ...o,
          bookOrdersError: !!bookOrdersError || !!bookItemsError,
          book_orders: hydratedBookOrders ? hydratedBookOrders.filter((bo: any) => bo.subscription_order_id === o.id) : []
        }));
        
        setOrders(combined);
        setOrdersLoading(false);
      } else {
        setOrdersFetchError(false);
        setOrders([]);
        setOrdersLoading(false);
      }

      // 활동내역 가져오기
      const { data: memberParts, error: partsErr } = await supabase
        .from('group_participants')
        .select('group_id, role, created_at, group_title')
        .eq('user_id', session.user.id)
        .eq('role', 'member')
        .order('created_at', { ascending: false });
      if (partsErr) console.error('parts fetch error:', partsErr);

      const groupIds = memberParts?.map((row) => row.group_id) ?? [];
      const { data: joinedGroups, error: groupsError } = groupIds.length > 0
        ? await supabase.from('groups').select('*').in('id', groupIds)
        : { data: [], error: null };
      if (groupsError) console.error('groups fetch error:', groupsError);

      const joinedList: any[] = (memberParts || []).reduce((acc: any[], p) => {
        const group = joinedGroups?.find(g => g.id === p.group_id);
        acc.push({
          id: p.group_id + '-member',
          original_id: group ? p.group_id : null,
          group_title: group ? group.title : p.group_title || '삭제된 독서모임',
          is_deleted: !group,
          role: 'member',
          created_at: p.created_at
        });
        return acc;
      }, []);

      const { data: createdGroups, error: createdErr } = await supabase
        .from('groups')
        .select('*')
        .eq('creator_id', session.user.id)
        .order('created_at', { ascending: false });
      if (createdErr) console.error('created fetch error:', createdErr);

      const createdList = (createdGroups || []).map(g => ({
        id: g.id + '-leader',
        original_id: g.id,
        group_title: g.title,
        is_deleted: false,
        role: 'leader',
        created_at: g.created_at
      }));

      const allGroupActivities = [...createdList, ...joinedList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setGroupParticipations(allGroupActivities);

      const { data: ep } = await supabase.from('event_participants').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });

      const { data: existingEvents } = await supabase.from('events').select('id, title');
      const existingEventIds = new Set((existingEvents || []).map((e: any) => e.id));
      const existingEventMap = new Map((existingEvents || []).map((e: any) => [e.id, e.title]));
      if (ep) {
        // 같은 이벤트 중복 제거 (최신 1건만 유지)
        const uniqueMap = new Map();
        ep.forEach((p: any) => {
          if (!uniqueMap.has(p.event_id)) {
            uniqueMap.set(p.event_id, {
              ...p,
              original_id: existingEventIds.has(p.event_id) ? p.event_id : null,
              display_title: existingEventIds.has(p.event_id) ? (existingEventMap.get(p.event_id) || p.event_title || '이벤트') : (p.event_title || '삭제된 이벤트'),
              is_deleted: !existingEventIds.has(p.event_id)
            });
          }
        });
        setEventParticipations(Array.from(uniqueMap.values()));
      }

      const { data: inq } = await supabase.from('inquiries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (inq) {
        setInquiries(inq);
        // Resolve signed URLs for attachments
        const urls: Record<string, string> = {};
        for (const item of inq) {
          if (!item.attachment_url) continue;
          let filePath = item.attachment_url;
          if (filePath.startsWith('http')) {
            const marker = '/object/public/inquiry-attachments/';
            const idx = filePath.indexOf(marker);
            if (idx !== -1) { filePath = filePath.substring(idx + marker.length); }
            else {
              const sMarker = '/object/sign/inquiry-attachments/';
              const sIdx = filePath.indexOf(sMarker);
              if (sIdx !== -1) { filePath = filePath.substring(sIdx + sMarker.length).split('?')[0]; }
              else continue;
            }
          }
          const { data: signedData, error: signedErr } = await supabase.storage
            .from('inquiry-attachments')
            .createSignedUrl(filePath, 3600);
          if (signedErr) {
            console.warn(`[문의 ${item.id}] signed URL 실패:`, signedErr.message);
            const { data: pubData } = supabase.storage.from('inquiry-attachments').getPublicUrl(filePath);
            if (pubData?.publicUrl) urls[item.id] = pubData.publicUrl;
          } else if (signedData?.signedUrl) {
            urls[item.id] = signedData.signedUrl;
          }
        }
        setSignedUrls(urls);
      }

      setLoading(false);
    }
    fetchData();
  }, [router]);

  const handleProfileSave = async () => {
    if (!name || !phone) { alert('이름과 연락처를 입력해주세요.'); return; }
    setSaving(true);
    const fullAddress = zonecode ? `[${zonecode}] ${address} ${detailAddress}`.trim() : `${address} ${detailAddress}`.trim();
    const { error } = await supabase.auth.updateUser({
      data: { name, phone, address: fullAddress }
    });
    setSaving(false);
    if (error) { alert('프로필 수정 실패: ' + error.message); return; }
    alert('프로필이 수정되었습니다.');
  };

  const handlePasswordChange = async () => {
    if (!user?.email) { alert('이메일 정보를 확인할 수 없습니다.'); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + '/mypage?tab=profile',
    });
    setChangingPw(false);
    if (error) { alert('비밀번호 재설정 메일 발송 실패: ' + error.message); return; }
    setPasswordResetSent(true);
    alert('✉️ 비밀번호 재설정 링크가 이메일로 발송되었습니다.\n이메일을 확인해주세요.');
  };

  const getStatusDisplay = (order: any, isOrderAllowed: boolean) => {
    const ps = order.payment_status || 'PENDING';
    
    if (ps === 'PENDING') return { label: '결제 미완료', bg: '#fef3c7', color: '#d97706' };
    if (ps === 'CANCELLED') return { label: '취소', bg: '#fee2e2', color: '#dc2626' };
    if (ps === 'FAILED') return { label: '결제실패', bg: '#fee2e2', color: '#dc2626' };
    
    const cycle = order.cycle || {};
    const maxCount = cycle.max_book_count || 4;
    const activeBooksCount = (order.book_orders || [])
      .filter((bo: any) => bo.order_status !== '주문취소')
      .reduce((sum: number, bo: any) => sum + (bo.book_order_items?.length || 0), 0);
      
    if (activeBooksCount >= maxCount) return { label: '도서 선택 완료 (구독됨)', bg: '#ecfdf5', color: '#059669' };
    
    if (!isOrderAllowed) return { label: '도서 신청 대기', bg: '#f3f4f6', color: '#6b7280' };
    return { label: `도서 선택 대기 (${activeBooksCount}/${maxCount})`, bg: '#eef5ff', color: '#3b82f6' };
  };

  if (loading) return <div style={{ padding: '100px', textAlign: 'center', fontFamily: 'var(--sans)' }}>로딩중...</div>;

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--sans)' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--sans)' }}>
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '96px 5vw 60px' }}>
        {/* 헤더 */}
        <div style={{ marginBottom: '8px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', marginBottom: '8px' }}>마이페이지</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{user?.email}</p>
        </div>

        {/* 탭 네비게이션 */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border)', marginBottom: '32px', marginTop: '24px' }}>
          {([
            { key: 'orders' as TabType, label: '📦 구독내역' },
            { key: 'profile' as TabType, label: '👤 내 정보 수정' },
            { key: 'activity' as TabType, label: '📋 활동내역' },
            { key: 'inquiry' as TabType, label: '💬 1:1 문의' },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '14px 24px', fontSize: '0.9rem', fontWeight: activeTab === tab.key ? 700 : 500,
                background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--sans)', marginBottom: '-2px'
              }}
            >{tab.label}</button>
          ))}
        </div>
        {/* 탭 1: 구독 내역 */}
        {activeTab === 'orders' && (
          <>
            {ordersLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                불러오는 중...
              </div>
            ) : ordersFetchError ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                구독 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>아직 구독 내역이 없습니다.</p>
                <Link href="/" style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: '40px', fontWeight: 600 }}>구독 신청하러 가기</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {orders.map((order) => {
                  const cycle = order.cycle || {};
                  const isDone = order.payment_status === 'DONE';
                  const isCancelled = order.payment_status === 'CANCELLED';
                  const isFailed = order.payment_status === 'FAILED';
                  const activeBooksCount = (order.book_orders || [])
                    .filter((bo: any) => bo.order_status !== '주문취소')
                    .flatMap((bo: any) => bo.book_order_items || [])
                    .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
                  const maxCount = cycle.max_book_count || 4;
                  const hasSelectedBooks = activeBooksCount >= maxCount;
                  const hasActiveBookOrders = activeBooksCount > 0;
                  
                  const now = new Date();
                  const orderEnd = cycle.book_order_end_date ? new Date(cycle.book_order_end_date) : new Date('2099-12-31');
                  const subEnd = cycle.subscription_end_date ? new Date(cycle.subscription_end_date) : new Date('2099-12-31');
                  const isOrderAllowed = (now <= orderEnd && cycle.status !== 'closed');
                  const cycleDisplayName = cycle?.name || cycle?.label || '';
                  const subscriptionTitle = cycleDisplayName
                    ? `${cycleDisplayName} 구독권`
                    : '구독권';
                  const statusUI = getStatusDisplay(order, isOrderAllowed);
                  
                  const isRefundable = isDone && !!order.cycle_id && now <= subEnd && cycle.status !== 'closed' && !hasActiveBookOrders;

                  if (isCancelled) {
                    return (
                      <div key={order.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(order.created_at).toLocaleDateString('ko-KR')} · 주문번호: {order.payment_order_id}
                            </span>
                            <h3 style={{ fontSize: '1.1rem', marginTop: '4px' }}>{subscriptionTitle}</h3>
                          </div>
                          <div>
                            <span style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', background: statusUI.bg, color: statusUI.color }}>
                              {statusUI.label}
                            </span>
                          </div>
                        </div>
                        <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                          <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: 0 }}>해당 결제가 취소되어 전액 환불 처리되었습니다.</p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>결제 금액&nbsp;&nbsp;</span>
                          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1.05rem', textDecoration: 'line-through' }}>{(order.total_amount || 45000).toLocaleString()}원</span>
                        </div>
                      </div>
                    );
                  }

                  if (isFailed) {
                    return (
                      <div key={order.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(order.created_at).toLocaleDateString('ko-KR')} · 주문번호: {order.payment_order_id}
                            </span>
                            <h3 style={{ fontSize: '1.1rem', marginTop: '4px' }}>결제 실패 내역</h3>
                          </div>
                          <div>
                            <span style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', background: statusUI.bg, color: statusUI.color }}>
                              {statusUI.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                  <div key={order.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    {/* 주문 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(order.created_at).toLocaleDateString('ko-KR')} · 주문번호: {order.payment_order_id}
                        </span>
                        <h3 style={{ fontSize: '1.1rem', marginTop: '4px' }}>{subscriptionTitle}</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap',
                          background: statusUI.bg,
                          color: statusUI.color,
                        }}>
                          {statusUI.label}
                        </span>
                        {isDone && !hasSelectedBooks && isOrderAllowed && (
                          <Link href={{ pathname: '/books', query: { subOrderId: order.id } }} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}>
                            {hasActiveBookOrders ? '도서 추가 선택' : '도서 선택하기'}
                          </Link>
                        )}
                        {isRefundable && (
                          <button 
                            onClick={() => setCancelingOrderId(order.id)}
                            style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', background: '#f3f4f6', color: '#4b5563', border: 'none', cursor: 'pointer' }}
                          >
                            구독 취소
                          </button>
                        )}
                      </div>
                      </div>
                      

                      {isDone && !isRefundable && (
                        <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                          <p style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: 1.6, margin: 0, flex: 1 }}>
                            도서 신청 기간이 시작된 이후에는 마이페이지에서 직접 구독을 취소할 수 없습니다.<br/>
                            웰컴키트 및 도서 발송이 진행될 수 있으므로, 환불을 원하시는 경우 1:1 문의를 통해 요청해주세요.<br/>
                            발송된 웰컴키트·도서 비용과 배송비 등이 환불금에서 차감될 수 있습니다.
                          </p>
                          <Link href="/inquiry" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, background: '#fff', color: '#92400e', border: '1px solid #fcd34d', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            1:1 환불 문의
                          </Link>
                        </div>
                      )}
                      
                      {isDone && (
                        <>
                          <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '0.9rem', marginBottom: '16px', color: 'var(--text)', fontWeight: 700 }}>도서 주문 현황 (현재 선택: {activeBooksCount}/{maxCount}권)</h4>
                      {order.bookOrdersError ? (
                        <p style={{ fontSize: '0.85rem', color: '#ef4444' }}>도서 주문 내역을 불러오지 못했습니다.</p>
                      ) : (!order.book_orders || order.book_orders.length === 0) ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>아직 신청한 도서 주문이 없습니다.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {order.book_orders.map((bo: any) => {
                            const isEditable = bo.order_status === '주문접수';
                            const displayStatus = bo.order_status === '주문접수' ? '주문 접수'
                              : bo.order_status === '배송준비중' ? '배송 준비중'
                              : bo.order_status === '배송중' ? '배송중'
                              : bo.order_status === '배송완료' ? '배송완료'
                              : bo.order_status === '주문취소' ? '주문취소'
                              : bo.order_status;
                            return (
                            <div key={bo.id} style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  주문접수일: {new Date(bo.created_at).toLocaleDateString('ko-KR')}
                                </span>
                                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, background: bo.order_status === '주문취소' ? '#fef2f2' : '#e0e7ff', color: bo.order_status === '주문취소' ? '#ef4444' : '#4338ca' }}>
                                  발송 상태: {displayStatus}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {(bo.book_order_items || []).map((item: any) => {
                                  const displayTitle = item.book?.title || item.title_snapshot || '도서명 없음';
                                  return (
                                  <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    {item.book?.cover_url ? (
                                      <img src={item.book.cover_url} alt={displayTitle} style={{ width: '48px', height: '68px', objectFit: 'cover', borderRadius: '4px' }} />
                                    ) : (
                                      <div style={{ width: '48px', height: '68px', background: '#e2e8f0', borderRadius: '4px' }}></div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{displayTitle}</span>
                                      {item.book?.author && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.book.author}</span>}
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                              
                              <div style={{ marginTop: '16px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                                <p style={{ margin: '0 0 12px 0', color: 'var(--text)' }}>
                                  <strong>도서 신청이 완료되었습니다.</strong><br/>
                                  배송은 {order.cycle?.shipping_start ? new Date(order.cycle.shipping_start).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '지정된 날짜'}부터 순차적으로 시작됩니다.
                                </p>
                                <p style={{ margin: '0 0 8px 0', color: '#b45309', fontWeight: 600 }}>배송 준비중일 경우 취소 및 변경이 불가능합니다.</p>
                                <p style={{ margin: 0 }}>
                                  도서는 운영기간 매주 금요일, 주 1회 발송되며,<br/>
                                  택배 배송 특성상 지역에 따라 수령까지 3~5일 정도 소요될 수 있습니다.
                                </p>
                              </div>

                              {isEditable && (
                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                  <Link href={{ pathname: '/books', query: { subOrderId: order.id, editOrderId: bo.id } }} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, background: '#fff', color: 'var(--text)', border: '1px solid #cbd5e1', textDecoration: 'none' }}>
                                    선택 변경
                                  </Link>
                                  <button
                                    onClick={() => handleCancelBookOrder(bo.id)}
                                    disabled={cancelingBookOrderId === bo.id}
                                    style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', cursor: 'pointer' }}
                                  >
                                    {cancelingBookOrderId === bo.id ? '처리 중...' : '신청 취소'}
                                  </button>
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                        </>
                      )}
                      {/* 배송 정보 */}
                    <div style={{ background: '#f9fafb', padding: '14px 18px', borderRadius: '10px', fontSize: '0.84rem', lineHeight: 1.7, color: 'var(--text-mid)' }}>
                      <strong>배송지:</strong> {order.user_name} ({order.user_phone}) <br/>
                      {order.user_address}
                    </div>

                    {/* 결제 금액 */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>결제 금액&nbsp;&nbsp;</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.05rem' }}>{(order.total_amount || 45000).toLocaleString()}원</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}

{/* 탭 3: 활동내역 */}
        {activeTab === 'activity' && (
          <div>
            {/* 서브탭 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {[
                { key: 'groups' as const, label: '독서모임', icon: '📚' },
                { key: 'events' as const, label: '이벤트', icon: '🎟️' },
              ].map(st => (
                <button key={st.key} onClick={() => setActivitySubTab(st.key)}
                  style={{ padding: '10px 20px', borderRadius: '100px', border: activitySubTab === st.key ? 'none' : '1px solid var(--border)', background: activitySubTab === st.key ? 'var(--accent)' : '#fff', color: activitySubTab === st.key ? '#fff' : 'var(--text-mid)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {st.icon} {st.label}
                </button>
              ))}
            </div>

            {/* 독서모임 */}
            {activitySubTab === 'groups' && (
              groupParticipations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--text-muted)' }}>독서모임 활동 내역이 없습니다.</p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>신청일자</th>
                        <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>내용</th>
                        <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>진행사항</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupParticipations.map((gp) => (
                        <tr key={gp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{new Date(gp.created_at).toLocaleDateString('ko-KR')}</td>
                          <td style={{ padding: '14px 16px', fontSize: '0.85rem', fontWeight: 600 }}>
                            {gp.role === 'leader' ? (
                              <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: '4px' }}>[개설]</span>
                            ) : null}
                            {gp.is_deleted || !gp.original_id ? (
                              <span style={{ color: '#9ca3af' }}>{gp.group_title} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>(종료되었거나 삭제된 항목)</span></span>
                            ) : (
                              <Link href={`/groups?id=${encodeURIComponent(String(gp.original_id))}`} style={{ color: 'inherit', textDecoration: 'none' }} className="activity-link">
                                {gp.group_title}
                              </Link>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', background: gp.role === 'leader' ? '#dbeafe' : '#d1fae5', color: gp.role === 'leader' ? '#2563eb' : '#059669' }}>
                              {gp.role === 'leader' ? '모집중' : '신청완료'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 이벤트 */}
            {activitySubTab === 'events' && (
              eventParticipations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--text-muted)' }}>이벤트 신청 내역이 없습니다.</p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>신청일자</th>
                        <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>내용</th>
                        <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>진행사항</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventParticipations.map((ep) => (
                        <tr key={ep.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{new Date(ep.created_at).toLocaleDateString('ko-KR')}</td>
                          <td style={{ padding: '14px 16px', fontSize: '0.85rem', fontWeight: 600 }}>
                            {ep.is_deleted || !ep.original_id ? (
                              <span style={{ color: '#9ca3af' }}>{ep.display_title} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>(종료되었거나 삭제된 항목)</span></span>
                            ) : (
                              <Link href={`/events?id=${encodeURIComponent(String(ep.original_id))}`} style={{ color: 'inherit', textDecoration: 'none' }} className="activity-link">
                                {ep.display_title}
                              </Link>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', background: '#d1fae5', color: '#059669' }}>신청완료</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {/* 탭 2: 내 정보 수정 */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 기본 정보 */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '24px', color: 'var(--text)' }}>기본 정보</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>이메일</label>
                <input value={user?.email || ''} disabled style={{ ...inputStyle, background: '#f5f5f5', color: '#999' }} />
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>이메일은 변경할 수 없습니다.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>이름</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>연락처</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>배송지 주소</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input placeholder="우편번호" value={zonecode} readOnly style={{ ...inputStyle, flex: 1, background: '#f5f5f5' }} />
                  <button type="button" onClick={() => setIsPostcodeOpen(true)}
                    style={{ padding: '0 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'var(--sans)', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600 }}>주소 찾기</button>
                </div>
                <input placeholder="기본 주소" value={address} readOnly style={{ ...inputStyle, marginBottom: '8px', background: '#f5f5f5' }} />
                <input placeholder="상세 주소 (동, 호수 등)" value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleProfileSave} disabled={saving}
                  style={{ padding: '12px 32px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'var(--sans)' }}>
                  {saving ? '저장 중...' : '프로필 저장'}
                </button>
              </div>
            </div>

            {/* 비밀번호 변경 */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>비밀번호 변경</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                보안을 위해 비밀번호 변경은 <strong>이메일 인증</strong>을 통해 진행됩니다.<br />
                아래 버튼을 누르면 가입하신 이메일로 비밀번호 재설정 링크가 발송됩니다.
              </p>
              {passwordResetSent ? (
                <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.9rem', color: '#059669', fontWeight: 600 }}>✅ 이메일이 발송되었습니다</p>
                  <p style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '4px' }}>{user?.email}로 발송된 링크를 확인해주세요.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ flex: 1, fontSize: '0.85rem', color: '#6b7280' }}>📧 {user?.email}</div>
                  <button onClick={handlePasswordChange} disabled={changingPw}
                    style={{ padding: '12px 28px', background: '#333', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '0.88rem', fontWeight: 600, cursor: changingPw ? 'not-allowed' : 'pointer', opacity: changingPw ? 0.7 : 1, fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>
                    {changingPw ? '발송 중...' : '✉️ 재설정 메일 발송'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 탭 4: 1:1 문의 */}
        {activeTab === 'inquiry' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>내 문의 내역</h3>
              <Link href="/inquiry" style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 600 }}>➕ 새 문의 작성</Link>
            </div>
            {inquiries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💬</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>문의 내역이 없습니다.</p>
                <Link href="/inquiry" style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: '100px', fontWeight: 600, fontSize: '0.88rem' }}>1:1 문의하기</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {inquiries.map(inq => (
                  <div key={inq.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div onClick={() => setExpandedInquiry(expandedInquiry === inq.id ? null : inq.id)}
                      style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>{inq.category}</span>
                          <span style={{
                            padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
                            background: inq.status === '답변완료' ? '#d1fae5' : '#f3f4f6',
                            color: inq.status === '답변완료' ? '#059669' : '#6b7280'
                          }}>{inq.status}</span>
                        </div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inq.title}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(inq.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{expandedInquiry === inq.id ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {expandedInquiry === inq.id && (
                      <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ padding: '16px 0', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-mid)', whiteSpace: 'pre-wrap' }}>{inq.content}</div>
                        {inq.attachment_url && signedUrls[inq.id] && (
                          <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                            <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '6px' }}>📎 첨부 이미지</p>
                            <img
                              src={signedUrls[inq.id]}
                              alt="첨부 이미지"
                              onClick={() => setZoomedImage(signedUrls[inq.id])}
                              style={{ maxWidth: '200px', maxHeight: '160px', borderRadius: '8px', border: '1px solid var(--border)', objectFit: 'cover', cursor: 'pointer' }}
                              onError={(e) => { console.warn(`[문의 ${inq.id}] 이미지 로드 실패:`, signedUrls[inq.id]); (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        )}

                        {inq.admin_reply ? (
                          <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669', marginBottom: '8px' }}>📩 답변</p>
                            <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}>{inq.admin_reply}</p>
                          </div>
                        ) : (
                          <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '10px', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>답변 대기 중입니다.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 우편번호 검색 모달 */}
      {isPostcodeOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsPostcodeOpen(false); }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: 'min(400px, 90vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>주소 검색</h3>
              <button onClick={() => setIsPostcodeOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <DaumPostcodeEmbed onComplete={(data) => {
              setZonecode(data.zonecode);
              setAddress(data.address);
              setIsPostcodeOpen(false);
            }} />
          </div>
        </div>
      )}
      {/* 취소 모달 */}
      {cancelingOrderId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: 'min(400px, 90vw)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: '#111827' }}>구독 결제 취소</h3>
            <p style={{ fontSize: '0.9rem', color: '#4b5563', lineHeight: 1.6, marginBottom: '24px' }}>
              구독을 취소하면 결제금액 45,000원이 전액 취소되며,<br/>
              해당 기수의 도서 신청 권한도 사라집니다.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setCancelingOrderId(null)} 
                disabled={isCancelProcessing}
                style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: isCancelProcessing ? 'not-allowed' : 'pointer' }}
              >
                돌아가기
              </button>
              <button 
                onClick={() => handleCancelOrder(cancelingOrderId)} 
                disabled={isCancelProcessing}
                style={{ flex: 1, padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: isCancelProcessing ? 'not-allowed' : 'pointer', opacity: isCancelProcessing ? 0.7 : 1 }}
              >
                {isCancelProcessing ? '취소 처리 중...' : '구독 취소하기'}
              </button>
            </div>
          </div>
        </div>
      )}
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
