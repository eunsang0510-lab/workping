"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function FailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제가 취소됐어요";

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-5">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4">😢</div>
        <h2 className="text-[#0a0a0a] text-2xl font-black mb-2">결제 실패</h2>
        <p className="text-[#6b6b6b] text-sm mb-6">{message}</p>
        <div className="space-y-3">
          <Link href="/pricing">
            <button className="w-full bg-[#5b5ef4] text-white py-4 rounded-xl font-bold text-sm shadow-[0_4px_16px_rgba(91,94,244,0.3)]">
              다시 시도하기
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="w-full bg-white border border-[#e5e5e5] text-[#6b6b6b] py-4 rounded-xl font-bold text-sm">
              대시보드로 이동
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#5b5ef4]">로딩 중...</div>}>
      <FailContent />
    </Suspense>
  );
}