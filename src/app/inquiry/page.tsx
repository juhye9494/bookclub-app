"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = ['가입문의', '배송문의', '교환문의', '환불문의', '저자 섭외 문의', '독서모임 활동비 신청', '기타 문의'];

export default function InquiryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        alert('로그인이 필요합니다.');
        router.push('/');
        return;
      }
      setUser(session.user);
      setName(session.user.user_metadata?.name || '');
      setPhone(session.user.user_metadata?.phone || '');
      setLoading(false);
    });
  }, [router]);

  const handleSubmit = async () => {
    if (!category) { alert('문의 유형을 선택해주세요.'); return; }
    if (!name) { alert('이름을 입력해주세요.'); return; }
    if (!phone) { alert('휴대폰 번호를 입력해주세요.'); return; }
    if (!title) { alert('제목을 입력해주세요.'); return; }
    if (!content) { alert('내용을 입력해주세요.'); return; }

    setSubmitting(true);

    let attachmentUrl = '';
    if (attachment) {
      const fileExt = attachment.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('inquiry-attachments')
        .upload(fileName, attachment);
      if (uploadError) {
        console.warn('파일 업로드 실패 (스토리지 미설정 가능):', uploadError.message);
      } else {
        const { data: urlData } = supabase.storage.from('inquiry-attachments').getPublicUrl(fileName);
        attachmentUrl = urlData?.publicUrl || '';
      }
    }

    const { error } = await supabase.from('inquiries').insert([{
      user_id: user.id,
      user_email: user.email,
      user_name: name,
      user_phone: phone,
      category,
      title,
      content,
      attachment_url: attachmentUrl,
      status: '접수완료',
      admin_reply: '',
    }]);

    setSubmitting(false);

    if (error) {
      alert('문의 접수 실패: ' + error.message);
      return;
    }

    setSubmitted(true);
  };

  if (loading) return <div style={{ padding: '100px', textAlign: 'center', fontFamily: 'var(--sans)' }}>로딩중...</div>;

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--sans)', transition: 'border 0.2s' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' };

  if (submitted) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '460px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.6rem', marginBottom: '12px' }}>문의가 접수되었습니다</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '28px' }}>
            담당자 확인 후 순차적으로 답변 드리겠습니다.<br />
            마이페이지에서 문의 내역과 답변을 확인하실 수 있습니다.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/mypage" style={{ padding: '12px 28px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: '100px', fontWeight: 600, fontSize: '0.9rem' }}>마이페이지에서 확인</Link>
            <Link href="/" style={{ padding: '12px 28px', background: '#f3f4f6', color: '#374151', textDecoration: 'none', borderRadius: '100px', fontWeight: 600, fontSize: '0.9rem' }}>홈으로</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--sans)' }}>
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '96px 5vw 60px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', marginBottom: '8px' }}>1:1 문의</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '32px' }}>
          문의 사항을 남겨주시면 담당자가 확인 후 답변 드리겠습니다.
        </p>

        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 문의 유형 */}
          <div>
            <label style={labelStyle}>문의 유형 <span style={{ color: 'var(--accent)' }}>*</span></label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{
                    padding: '8px 16px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                    background: category === cat ? 'var(--accent)' : '#fff',
                    color: category === cat ? '#fff' : 'var(--text-mid)',
                    border: category === cat ? 'none' : '1px solid var(--border)',
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 이름 & 휴대폰 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>이름 <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>휴대폰 <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" style={inputStyle} />
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label style={labelStyle}>제목 <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문의 제목을 입력해주세요" style={inputStyle} />
          </div>

          {/* 내용 */}
          <div>
            <label style={labelStyle}>내용 <span style={{ color: 'var(--accent)' }}>*</span></label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="문의 내용을 상세히 작성해주세요" rows={6}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {/* 첨부파일 */}
          <div>
            <label style={labelStyle}>첨부파일</label>
            <div style={{ position: 'relative' }}>
              <input type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                style={{ ...inputStyle, padding: '10px 16px', fontSize: '0.85rem' }} />
              {attachment && (
                <p style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: '4px' }}>📎 {attachment.name}</p>
              )}
            </div>
          </div>

          {/* 제출 */}
          <button onClick={handleSubmit} disabled={submitting}
            style={{
              padding: '14px 32px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '100px',
              fontSize: '0.95rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1, transition: 'all 0.2s', fontFamily: 'var(--sans)', marginTop: '8px'
            }}>
            {submitting ? '접수 중...' : '문의 접수하기'}
          </button>
        </div>
      </main>
    </div>
  );
}
