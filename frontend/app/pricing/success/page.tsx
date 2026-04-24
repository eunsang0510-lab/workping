"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [plan, setPlan] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = Number(searchParams.get("amount"));

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }

      try {
        // 회사 ID 가져오기
        const API_URL_LOCAL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const companyRes = await fetch(`${API_URL_LOCAL}/api/company/my/${user.uid}`);
        const companyData = await companyRes.json();

        // order_id에서 플랜 추출
        const paymentRes = await fetch(`${API_URL_LOCAL}/api/payment/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_key: paymentKey,
            order_id: orderId,
            amount,
            company_id: companyData.company_id,
            plan: companyData.pending_plan || "starter",
          }),
        });

        const data = await paymentRes.json();
        if (data.success) {
          setPlan(data.plan);
          setExpiresAt(new Date(data.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }));
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    });

    return () => unsubscribe();
  }, [searchParams, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3">⏳</div>
          <div className="text-[#5b5ef4] font-bold">결제 확인 중...</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-5">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-[#0a0a0a] text-xl font-black mb-2">결제 처리 실패</h2>
          <p className="text-[#6b6b6b] text-sm mb-6">결제는 완료됐으나 처리 중 오류가 발생했어요.<br />관리자에게 문의해주세요.</p>
          <Link href="/dashboard">
            <button className="bg-[#5b5ef4] text-white px-8 py-3 rounded-xl font-bold text-sm">
              대시보드로 이동
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-5">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-[#0a0a0a] text-2xl font-black mb-2">결제 완료!</h2>
        <p className="text-[#6b6b6b] text-sm mb-6">
          <span className="text-[#5b5ef4] font-bold capitalize">{plan}</span> 플랜이 활성화됐어요
        </p>
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#a0a0a0] text-sm">플랜</span>
            <span className="text-[#0a0a0a] font-black capitalize">{plan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#a0a0a0] text-sm">만료일</span>
            <span className="text-[#0a0a0a] font-bold">{expiresAt}</span>
          </div>
        </div>
        <Link href="/dashboard">
          <button className="w-full bg-[#5b5ef4] text-white py-4 rounded-xl font-bold text-sm shadow-[0_4px_16px_rgba(91,94,244,0.3)]">
            대시보드로 이동
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#5b5ef4]">로딩 중...</div>}>
      <SuccessContent />
    </Suspense>
  );
}