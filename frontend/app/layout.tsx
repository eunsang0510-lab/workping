import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import KeepAlive from "./_keep-alive";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorkPing - 중소기업 무료 GPS 근태관리",
  description: "GPS 기반 출퇴근 기록, 연차관리, 팀 근태현황을 무료로 시작하세요.",
  keywords: "근태관리 앱, 출장 신청 시스템, 직원 출퇴근 관리, 중소기업 근태관리, GPS 출퇴근 앱, 근로시간관리, 무료근로시간관리, 근태관리앱, 포괄임금제폐지",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WorkPing",
  },
  openGraph: {
    title: "WorkPing - 중소기업 무료 GPS 근태관리",
    description: "GPS 기반 출퇴근 기록, 연차관리, 팀 근태현황을 무료로 시작하세요.",
    url: "https://workping-kappa.vercel.app",
    siteName: "WorkPing",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <Script
          id="service-worker"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
         if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
           });
          }
         `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <KeepAlive />
        {children}
      </body>
    </html>
  );
}
