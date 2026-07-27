import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '플러스 인사이트',
  description: '글로벌 경제 트렌드와 산업 동향을 짚어주는 한경 언더라인 회원 전용 프리미엄 인사이트입니다.',
  alternates: {
    canonical: '/insight',
  },
  openGraph: {
    title: '플러스 인사이트 | 한경 언더라인',
    description: '글로벌 경제 트렌드와 산업 동향을 짚어주는 한경 언더라인 회원 전용 프리미엄 인사이트입니다.',
    url: '/insight',
    siteName: '한경 언더라인',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '한경 언더라인' }],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '플러스 인사이트 | 한경 언더라인',
    description: '글로벌 경제 트렌드와 산업 동향을 짚어주는 한경 언더라인 회원 전용 프리미엄 인사이트입니다.',
    images: ['/twitter-image.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
