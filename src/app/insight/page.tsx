"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const INSIGHT_POSTS = [
  {
    id: 'insight-1',
    day: '월요일',
    type: '에디터 칼럼',
    title: '반도체 섹터 급등과 향후 실전 전망',
    author: '이성민 경제 에디터',
    date: '2026-06-01',
    summary: '반도체 섹터가 최근 사상 최고치를 경신했습니다. AI 혁명이 가져올 하드웨어 시장의 변화와 관련 추천 도서를 알아봅니다.',
    content: `
      최근 글로벌 시장에서 반도체 섹터의 지수가 연일 급등하며 사상 최고치를 경신했습니다. 엔비디아를 필두로 한 AI 가속기 시장의 독점이 지속되는 한편, 국내 메모리 반도체 리더들의 고대역폭 메모리(HBM) 경쟁도 더욱 뜨거워지고 있습니다.
      <br/><br/>
      이러한 현상은 단순한 단기 과열일까요, 아니면 새로운 메가 트렌드의 서막일까요? 역사적으로 반도체 사이클은 약 3~4년 주기로 호황과 불황을 반복해 왔습니다. 하지만 이번 AI 혁명은 하드웨어 인프라에 대한 수요의 근본적인 체질 개선을 요구하고 있습니다. 
      <br/><br/>
      <strong>■ 핵심 전망 포인트:</strong><br/>
      1. AI 데이터센터 인프라 확장 속도가 2027년까지 가속화될 것입니다.<br/>
      2. 온디바이스 AI(On-device AI) 시장의 개화로 스마트폰, 오토모티브 반도체의 단가가 급등할 것입니다.<br/>
      3. 차세대 패키징 공정의 지배력을 가진 소부장 기업들의 가치가 재평가될 것입니다.
      <br/><br/>
      이러한 흐름을 한발 앞서 분석하려면 이번 기수의 추천 도서인 <strong>[CES 2026]</strong>과 <strong>[사이클 투자 법칙]</strong>을 꼭 함께 읽어보시기를 권장합니다. 기술의 패러다임과 투자의 리듬을 동시에 읽는 안목을 기를 수 있을 것입니다.
    `,
    cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    likes: 42,
    commentsCount: 3
  },
  {
    id: 'insight-2',
    day: '수요일',
    type: '마케터 베스트 리뷰',
    title: '독자가 남긴 가장 울림 있는 리뷰: "정리로 시작하는 인생 리셋"',
    author: '박소현 마케터',
    date: '2026-05-27',
    summary: '정경자 대표의 책을 읽고 삶의 태도를 바꾼 30대 직장인 독자의 베스트 리뷰를 공유합니다.',
    content: `
      언더라인 독서클럽의 많은 회원분들이 남겨주신 주옥같은 서평 중, 이번 주 마케터가 꼽은 베스트 리뷰는 아이디 <em>'reading_star'</em> 님의 글입니다.
      <br/><br/>
      <strong>[독자 리뷰 본문 일부]</strong><br/>
      "하루 30분 책을 읽겠다는 나와의 약속이 벌써 한 달째 지켜지고 있습니다. 정경자 대표의 [정리로 시작하는 인생 리셋]을 읽으며, 물리적인 방의 가구 배치만을 바꾼 것이 아닙니다. 
      내 컴퓨터 바탕화면의 쓸모없는 파일들, 그리고 머릿속에서 부유하던 해묵은 고민들을 비워내기 시작했습니다. 
      비우는 법을 알게 되니 역설적으로 채울 수 있는 여유가 생겼고, 내 일상도 한층 가벼워졌습니다. 웰컴 굿즈로 받은 모래시계를 보며 매일 모래가 떨어지는 30분 동안 밑줄을 긋는 시간이 제 하루 중 가장 밀도 높은 행복입니다."
      <br/><br/>
      정리가 물건의 정리가 아니라 내 삶의 우선순위를 정렬하는 작업이라는 깨달음이 마케터에게도 큰 울림을 주었습니다. 여러분은 최근 일상에서 무엇을 비워내고 계시나요? 댓글로 여러분의 정리에 관한 소회를 나누어 주세요!
    `,
    cover: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80',
    likes: 35,
    commentsCount: 4
  },
  {
    id: 'insight-3',
    day: '금요일',
    type: '독서 습관 에세이',
    title: '하루 30분이 주는 삶의 고요와 성장',
    author: '김원준 본부장',
    date: '2026-05-29',
    summary: '출근 전 혹은 퇴근 후 30분, 그 짧은 몰입의 시간이 만드는 생각의 근육에 대하여 이야기합니다.',
    content: `
      현대인들은 매일 끝없는 스마트폰 피드와 숏폼 콘텐츠의 세례 속에서 살아갑니다. 도파민 중독의 시대, 우리 뇌는 가만히 멈춰서 긴 호흡의 글을 깊이 사색할 기회를 거의 잃어버렸습니다.
      <br/><br/>
      제가 매일 아침 출근 직후 컴퓨터를 켜기 전에 모래시계를 뒤집고 30분 동안 책을 읽기 시작한 지 3년이 되었습니다. 처음 10분은 눈앞의 활자가 잘 읽히지 않고 엉뚱한 업무 생각만 떠올랐습니다. 하지만 모래알이 떨어지는 소리 없는 집중 속에 20분을 넘어서면 어느새 뇌가 고요해지며 저자의 생각에 온전히 동화되는 것을 느낍니다.
      <br/><br/>
      하루 30분은 전체 하루의 단 2%에 불과합니다. 하지만 이 2%의 시간이 만드는 생각의 근육이 나머지 98%의 삶을 주도적으로 살아가게 하는 에너지가 됩니다. 
      <br/><br/>
      한 권의 책을 완벽히 소화하려 부담 가질 필요는 없습니다. 그 속에서 단 한 줄, 내 마음을 울린 밑줄(Underline)을 찾아내고 그것을 가슴에 새기는 것만으로도 충분합니다. 이번 주말, 단 30분만 스마트폰을 끄고 모래시계를 뒤집어 보는 것은 어떨까요?
    `,
    cover: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80',
    likes: 58,
    commentsCount: 5
  }
];

export default function PlusInsightPage() {
  const [posts, setPosts] = useState<any[]>(INSIGHT_POSTS);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any>({});
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [likes, setLikes] = useState<any>({});

  useEffect(() => {
    // Load posts from Supabase
    async function loadPosts() {
      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .order('order_idx', { ascending: true });
      if (data && data.length > 0) {
        setPosts(data);
      }
      // If empty or error, keep using INSIGHT_POSTS fallback
    }
    loadPosts();

    // Initial seeds for comments
    const initialComments: any = {
      'insight-1': [
        { id: 1, author: '김철수', content: '반도체 리츠 도서랑 같이 보니까 이해가 더 잘 되더라고요.', date: '2026-06-01' },
        { id: 2, author: '이영희', content: '엔비디아 주가 보면서 에디터님 글 읽으니 진짜 소름 돋네요.', date: '2026-06-01' }
      ],
      'insight-2': [
        { id: 1, author: '박지성', content: '저도 이 서평 보고 자극받아 독서노트 쓰기 시작했습니다!', date: '2026-05-28' }
      ],
      'insight-3': [
        { id: 1, author: '홍길동', content: '모래시계 진짜 최고의 굿즈입니다. 집중이 잘 돼요.', date: '2026-05-29' },
        { id: 2, author: '최지우', content: '2%의 법칙, 가슴에 깊이 새깁니다.', date: '2026-05-30' }
      ]
    };
    
    // Load from localStorage if present
    const savedComments = localStorage.getItem('insight_comments');
    if (savedComments) {
      setComments(JSON.parse(savedComments));
    } else {
      setComments(initialComments);
      localStorage.setItem('insight_comments', JSON.stringify(initialComments));
    }

    const savedLikes = localStorage.getItem('insight_likes');
    if (savedLikes) {
      setLikes(JSON.parse(savedLikes));
    } else {
      const initialLikes = { 'insight-1': 42, 'insight-2': 35, 'insight-3': 58 };
      setLikes(initialLikes);
      localStorage.setItem('insight_likes', JSON.stringify(initialLikes));
    }
  }, []);

  const handleLike = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = {
      ...likes,
      [postId]: (likes[postId] || 0) + 1
    };
    setLikes(updated);
    localStorage.setItem('insight_likes', JSON.stringify(updated));
  };

  const handleAddComment = (postId: string) => {
    if (!newComment.trim() || !authorName.trim()) {
      alert('이름과 댓글 내용을 모두 입력해주세요.');
      return;
    }

    const newCommentObj = {
      id: Date.now(),
      author: authorName,
      content: newComment,
      date: new Date().toISOString().slice(0, 10)
    };

    const postComments = comments[postId] || [];
    const updatedComments = {
      ...comments,
      [postId]: [...postComments, newCommentObj]
    };

    setComments(updatedComments);
    localStorage.setItem('insight_comments', JSON.stringify(updatedComments));
    setNewComment('');
    setAuthorName('');
  };

  return (
    <div style={{ background: 'var(--bg-warm)', minHeight: '100vh', fontFamily: 'var(--sans)', color: 'var(--text)', paddingTop: '64px' }}>
      
      {/* Styles */}
      <style>{`
        .insight-banner {
          background: linear-gradient(135deg, #1d1815 0%, #3e332c 100%);
          color: #fff;
          padding: 80px 5vw;
          text-align: center;
        }
        .insight-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 32px;
          max-width: 1200px;
          margin: -40px auto 80px;
          padding: 0 5vw;
        }
        .insight-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid var(--border);
          overflow: hidden;
          box-shadow: 0 10px 20px rgba(0,0,0,0.04);
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }
        .insight-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.08);
          border-color: rgba(252, 102, 64, 0.2);
        }
        .insight-day-badge {
          background: var(--accent-light);
          color: var(--accent);
          font-weight: 700;
          font-size: 0.72rem;
          padding: 4px 12px;
          border-radius: 30px;
          display: inline-block;
        }
        .comment-input-area {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: var(--bg-warm);
          padding: 16px;
          border-radius: 12px;
          margin-top: 24px;
        }
        .comment-row {
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
      `}</style>

      {/* Hero Banner */}
      <div className="insight-banner">
        <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase' }}>
          Weekly Plus Insight
        </span>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '2.8rem', fontWeight: 700, marginTop: '12px', marginBottom: '16px' }}>
          플러스 인사이트
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.8, maxWidth: '600px', margin: '0 auto' }}>
          매주 월, 수, 금 한경 에디터, 마케터, 그리고 경영진이<br />
          당신의 깊이 있는 독서와 성장을 돕기 위해 새로운 주제와 인사이트를 전해 드립니다.
        </p>
      </div>

      {/* Main Grid */}
      <div className="insight-grid">
        {posts.map(post => {
          const currentLikes = likes[post.id] || post.likes;
          const currentCommentsCount = (comments[post.id] || []).length;
          
          return (
            <div key={post.id} className="insight-card" onClick={() => setSelectedPost(post)}>
              <div style={{ aspectRatio: '16/10', overflow: 'hidden', position: 'relative' }}>
                <img src={post.cover} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: '12px', left: '12px' }}>
                  <span className="insight-day-badge">{post.day} 발행</span>
                </div>
              </div>
              
              <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {post.type}
                  </span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '8px 0 12px', color: 'var(--text)', lineHeight: 1.4 }}>
                    {post.title}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: '20px' }}>
                    {post.summary}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>{post.author}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ cursor: 'pointer' }} onClick={(e) => handleLike(post.id, e)}>❤️ {currentLikes}</span>
                    <span>💬 {currentCommentsCount}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Post Overlay Modal */}
      {selectedPost && (
        <div 
          className="modal-overlay open"
          style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedPost(null); }}
        >
          <div 
            style={{ 
              background: '#ffffff', 
              borderRadius: '24px', 
              width: 'min(780px, 95vw)', 
              maxHeight: '90vh', 
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden', 
              position: 'relative',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedPost(null)}
              style={{ position: 'absolute', top: '16px', right: '20px', background: 'rgba(255,255,255,0.9)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
            >
              ✕
            </button>

            {/* Poster Header */}
            <div style={{ height: '220px', position: 'relative', background: '#222' }}>
              <img src={selectedPost.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.7))' }} />
              <div style={{ position: 'absolute', bottom: '24px', left: '32px', right: '32px', color: '#fff' }}>
                <span className="insight-day-badge" style={{ marginBottom: '8px' }}>{selectedPost.day} 발행</span>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>{selectedPost.title}</h2>
              </div>
            </div>

            {/* Body (Scrollable) */}
            <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span>분류: <strong>{selectedPost.type}</strong></span>
                <span>작성자: <strong>{selectedPost.author}</strong> ({selectedPost.date})</span>
              </div>

              {/* Main Content text */}
              <div 
                style={{ fontSize: '0.96rem', lineHeight: '1.85', color: 'var(--text-mid)', wordBreak: 'break-all' }}
                dangerouslySetInnerHTML={{ __html: selectedPost.content }}
              />

              {/* Like bar */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0 16px' }}>
                <button 
                  onClick={(e) => handleLike(selectedPost.id, e)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 30px', background: 'var(--accent-light)', border: '1.5px solid var(--accent)', color: 'var(--accent)', borderRadius: '40px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ❤️ 유익한 글이에요! ({likes[selectedPost.id] || selectedPost.likes})
                </button>
              </div>

              {/* Comments Section */}
              <div style={{ marginTop: '40px', borderTop: '2px solid var(--text)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '24px', marginBottom: '16px' }}>
                  독자 댓글 ({(comments[selectedPost.id] || []).length}개)
                </h3>

                {/* Comment list */}
                <div>
                  {(comments[selectedPost.id] || []).map((c: any) => (
                    <div key={c.id} className="comment-row">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{c.author}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{c.date}</span>
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', margin: 0 }}>{c.content}</p>
                    </div>
                  ))}
                  {(comments[selectedPost.id] || []).length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '0.88rem' }}>첫 번째 댓글을 작성해 보세요!</p>
                  )}
                </div>

                {/* Comment Input */}
                <div className="comment-input-area">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="이름" 
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      style={{ width: '100px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.88rem', outline: 'none' }}
                    />
                    <input 
                      type="text" 
                      placeholder="따뜻한 한마디를 남겨주세요." 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.88rem', outline: 'none' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(selectedPost.id); }}
                    />
                    <button 
                      onClick={() => handleAddComment(selectedPost.id)}
                      style={{ padding: '8px 16px', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      등록
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
