import type { Metadata } from "next";
import LandingClient from "./_landing";

export const metadata: Metadata = {
  title: "WorkPing — GPS 기반 스마트 근태관리 앱",
  description:
    "출퇴근 버튼 하나로 근로시간을 자동 기록. 포괄임금제 폐지 대비 GPS 출퇴근 관리, 연장근로 자동 계산, 법적 증빙 리포트. 5인 이하 무료.",
  keywords:
    "근태관리, 출퇴근관리, 근태관리앱, GPS출퇴근, 출퇴근앱, 포괄임금제폐지, 근로시간관리, 직원근태관리, 무료근태관리, 소상공인출퇴근",
  openGraph: {
    title: "WorkPing — GPS 기반 스마트 근태관리",
    description: "포괄임금제 폐지 시대, 자동으로 기록하고 법적으로 증명하세요.",
    url: "https://workping-kappa.vercel.app",
    siteName: "WorkPing",
    locale: "ko_KR",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://workping-kappa.vercel.app" },
  verification: {
    google: "AqSfQyOtx5O7uCyRg5xReyUFl4AY",
  },
};

export default function Page() {
  return <LandingClient />;
}