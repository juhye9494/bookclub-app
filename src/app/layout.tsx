import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://underline.hankyung.com"),
  title: {
    default: "한경 언더라인 | 경제·경영 독서클럽",
    template: "%s | 한경 언더라인"
  },
  description: "경제·경영·인문·예술 분야의 엄선된 도서와 북토크, 독서모임, 플러스 인사이트를 만나는 한경 언더라인 독서클럽입니다.",
  applicationName: "한경 언더라인",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "한경 언더라인 | 경제·경영 독서클럽",
    description: "경제·경영·인문·예술 분야의 엄선된 도서와 북토크, 독서모임, 플러스 인사이트를 만나는 한경 언더라인 독서클럽입니다.",
    url: "/",
    siteName: "한경 언더라인",
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '한경 언더라인' }],
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "한경 언더라인 | 경제·경영 독서클럽",
    description: "경제·경영·인문·예술 분야의 엄선된 도서와 북토크, 독서모임, 플러스 인사이트를 만나는 한경 언더라인 독서클럽입니다.",
    images: ['/twitter-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "한경 언더라인",
        "url": "https://underline.hankyung.com"
      },
      {
        "@type": "Organization",
        "name": "(주)한경매거진앤북",
        "url": "https://underline.hankyung.com"
      }
    ]
  };

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ClientLayout>{children}</ClientLayout>
        <Script src="https://js.tosspayments.com/v2/standard" strategy="afterInteractive" />
      </body>
    </html>
  );
}
