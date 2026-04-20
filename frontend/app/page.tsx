"use client";

import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("로그인 성공:", result.user.email);
      router.push("/dashboard");
    } catch (error) {
      console.error("로그인 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#6366f1] rounded-2xl mb-6">
            <span className="text-white text-2xl font-bold">W</span>
          </div>
          <h1 className="text-white text-3xl font-bold tracking-tight">
            Work<span className="text-[#6366f1]">Ping</span>
          </h1>
          <p className="text-[#71717a] mt-2 text-sm">
            GPS 기반 스마트 근태관리
          </p>
        </div>

        {/* 기능 소개 */}
        <div className="space-y-3 mb-8">
          {[
            { icon: "📍", title: "GPS 자동 출퇴근", desc: "위치 기반 자동 기록" },
            { icon: "⏰", title: "실시간 근무 추적", desc: "분 단위 정확한 기록" },
            { icon: "📊", title: "리포트 자동 생성", desc: "주간/월간 분석" },
            { icon: "🏢", title: "팀 관리 기능", desc: "기업 근태 관리" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="text-white text-sm font-medium">{item.title}</div>
                <div className="text-[#71717a] text-xs">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "로그인 중..." : "Google로 시작하기"}
        </button>

        <p className="text-[#52525b] text-xs text-center mt-4">
          로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다
        </p>
      </div>
    </main>
  );
}