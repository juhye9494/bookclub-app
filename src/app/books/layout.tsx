import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '도서 선택',
  description: '한경 언더라인에서 추천하는 경제·경영 등 다양한 분야의 이달의 도서를 선택해보세요.',
  alternates: {
    canonical: '/books',
  },
  openGraph: {
    title: '도서 선택 | 한경 언더라인',
    description: '한경 언더라인에서 추천하는 경제·경영 등 다양한 분야의 이달의 도서를 선택해보세요.',
    url: '/books',
    siteName: '한경 언더라인',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '한경 언더라인' }],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '도서 선택 | 한경 언더라인',
    description: '한경 언더라인에서 추천하는 경제·경영 등 다양한 분야의 이달의 도서를 선택해보세요.',
    images: ['/twitter-image.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
