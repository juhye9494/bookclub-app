import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '독서모임',
  description: '책의 깊이를 더하는 한경 언더라인의 다양한 독서모임에 참여하고 인사이트를 나누어보세요.',
  alternates: {
    canonical: '/groups',
  },
  openGraph: {
    title: '독서모임 | 한경 언더라인',
    description: '책의 깊이를 더하는 한경 언더라인의 다양한 독서모임에 참여하고 인사이트를 나누어보세요.',
    url: '/groups',
    siteName: '한경 언더라인',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '한경 언더라인' }],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '독서모임 | 한경 언더라인',
    description: '책의 깊이를 더하는 한경 언더라인의 다양한 독서모임에 참여하고 인사이트를 나누어보세요.',
    images: ['/twitter-image.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
