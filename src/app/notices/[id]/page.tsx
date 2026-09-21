import { supabase } from '@/lib/supabaseClient';
import { formatKoreanDate } from '@/utils/dateFormatter';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: notice } = await supabase.from('notices').select('title').eq('id', id).single();
  
  if (!notice) return { title: '공지사항 - 언더라인 독서클럽' };
  
  return {
    title: `${notice.title} - 언더라인 독서클럽`,
  };
}

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const { data: notice, error } = await supabase
    .from('notices')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !notice) {
    notFound();
  }

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '120px 20px 80px' }}>
      <div style={{ width: '100%', borderBottom: '2px solid #222', paddingBottom: '24px', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px' }}>
          {notice.is_pinned && <span style={{ color: 'var(--accent)', marginRight: '8px' }}>[공지]</span>}
          {notice.title}
        </h1>
        <div style={{ fontSize: '0.9rem', color: '#666', textAlign: 'right' }}>
          {formatKoreanDate(notice.created_at)}
        </div>
      </div>

      <div style={{ width: '100%', lineHeight: 1.8, fontSize: '1.05rem', color: '#333', minHeight: '300px', whiteSpace: 'pre-wrap' }}>
        {notice.content}
        
        {notice.image_urls && notice.image_urls.length > 0 && (
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {notice.image_urls.map((url: string, index: number) => (
              <img 
                key={index} 
                src={url} 
                alt={`첨부 이미지 ${index + 1}`} 
                style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '0 auto' }} 
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ width: '100%', marginTop: '60px', textAlign: 'center' }}>
        <Link 
          href="/notices" 
          style={{ 
            display: 'inline-block', 
            padding: '12px 32px', 
            backgroundColor: '#fff', 
            color: '#333', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'background-color 0.2s'
          }}
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}
