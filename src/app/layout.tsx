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
  title: "한경 언더라인",
  description: "여기를 눌러 링크를 확인하세요.",
  metadataBase: new URL("https://underline.hankyung.com"),
  openGraph: {
    title: "한경 언더라인",
    description: "여기를 눌러 링크를 확인하세요.",
    url: "https://underline.hankyung.com",
    siteName: "한경 언더라인",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "한경 언더라인",
    description: "여기를 눌러 링크를 확인하세요.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientLayout>{children}</ClientLayout>
        <Script src="https://js.tosspayments.com/v2/standard" strategy="afterInteractive" />
      </body>
    </html>
  );
}
