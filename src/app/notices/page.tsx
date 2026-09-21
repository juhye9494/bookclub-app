import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { formatKoreanDate } from '@/utils/dateFormatter';

export const metadata = {
  title: '공지사항 - 언더라인 독서클럽',
};

// Next.js ISR/SSR configuration
export const revalidate = 60; // 60 seconds

export default async function NoticesPage() {
  const { data: notices, error } = await supabase
    .from('notices')
    .select('id, title, is_pinned, created_at')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load notices:', error);
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '120px 20px 80px' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>공지사항</h1>
      
      <div style={{ borderTop: '2px solid #222', borderBottom: '1px solid #ddd' }}>
        {notices && notices.length > 0 ? (
          notices.map((notice: any) => (
            <Link 
              key={notice.id} 
              href={`/notices/${notice.id}`}
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                padding: '16px', 
                borderBottom: '1px solid #eee', 
                textDecoration: 'none', 
                color: 'inherit',
                backgroundColor: notice.is_pinned ? '#f8f9fa' : 'transparent',
                transition: 'background-color 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {notice.is_pinned && (
                  <span style={{ 
                    backgroundColor: 'var(--accent)', 
                    color: 'white', 
                    fontSize: '0.75rem', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    fontWeight: 600
                  }}>
                    공지
                  </span>
                )}
                <h2 style={{ fontSize: '1.1rem', fontWeight: notice.is_pinned ? 600 : 500, margin: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {notice.title}
                </h2>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666', textAlign: 'right' }}>
                {formatKoreanDate(notice.created_at)}
              </div>
            </Link>
          ))
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            등록된 공지사항이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
