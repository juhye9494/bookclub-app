import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이벤트',
  description: '저자 북토크, 세미나 등 한경 언더라인이 준비한 다채로운 오프라인 이벤트와 네트워킹에 함께하세요.',
  alternates: {
    canonical: '/events',
  },
  openGraph: {
    title: '이벤트 | 한경 언더라인',
    description: '저자 북토크, 세미나 등 한경 언더라인이 준비한 다채로운 오프라인 이벤트와 네트워킹에 함께하세요.',
    url: '/events',
    siteName: '한경 언더라인',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '한경 언더라인' }],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '이벤트 | 한경 언더라인',
    description: '저자 북토크, 세미나 등 한경 언더라인이 준비한 다채로운 오프라인 이벤트와 네트워킹에 함께하세요.',
    images: ['/twitter-image.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
