"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;

interface Subscription {
  plan: string;
  status: string;
  expires_at: string | null;
}

const PLANS = [
  {
    id: "free",
    name: "무료",
    price: 0,
    period: "",
    priceLabel: "0원",
    features: ["직원 10명 이하", "기본 출퇴근 기록", "오늘 근태 현황"],
    highlight: false,
  },
  {
    id: "starter",
    name: "스타터",
    price: 50000,
    period: "/ 월 (회사별)",
    priceLabel: "50,000원",
    features: ["직원 20명 이하", "출근 구역 설정", "엑셀 다운로드", "주간·월간 리포트"],
    highlight: true,
    badge: "인기",
  },
  {
    id: "business",
    name: "비즈니스",
    price: 0,
    period: "",
    priceLabel: "협의",
    features: ["직원 무제한", "스타터 기능 전체", "우선 고객 지원"],
    highlight: false,
  },
];

export default function PricingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [searchResults, setSearchResults] = useState<{id: string; name: string}[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{id: string; name: string} | null>(null);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUser(user);
      await fetchCompanyAndSubscription(user.uid);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchCompanyAndSubscription = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/my/${userId}`);
      const data = await res.json();
      if (data.company_id) {
        setCompanyId(data.company_id);
        setSelectedCompany({ id: data.company_id, name: data.company_name || "내 회사" });
        const subRes = await fetch(`${API_URL}/api/payment/subscription/${data.company_id}`);
        const subData = await subRes.json();
        setSubscription(subData);
      }
    } catch (e) {
      console.error("정보 로딩 실패:", e);
    }
  };

  const handleSearchCompany = async () => {
    if (!companySearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/api/company/search?name=${companySearch}`);
      const data = await res.json();
      setSearchResults(data.companies || []);
    } catch {
      alert("검색 실패");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCompany = async (company: {id: string; name: string}) => {
    setSelectedCompany(company);
    setCompanyId(company.id);
    setSearchResults([]);
    setCompanySearch("");
    try {
      const subRes = await fetch(`${API_URL}/api/payment/subscription/${company.id}`);
      const subData = await subRes.json();
      setSubscription(subData);
    } catch {}
  };

  const handlePayment = async (plan: { id: string; name: string; price: number }) => {
    if (!companyId) {
      alert("먼저 회사를 선택해주세요.");
      return;
    }
    setPayLoading(plan.id);
    try {
      const prepRes = await fetch(`${API_URL}/api/payment/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, plan: plan.id }),
      });
      const { order_id, amount } = await prepRes.json();

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: companyId });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: amount },
        orderId: order_id,
        orderName: `WorkPing ${plan.name} 플랜 - ${selectedCompany?.name}`,
        successUrl: `${window.location.origin}/pricing/success`,
        failUrl: `${window.location.origin}/pricing/fail`,
        customerEmail: user?.email || "",
        customerName: user?.displayName || "사용자",
      });
    } catch (e: any) {
      console.error("결제 에러:", e);
      if (e?.code !== "USER_CANCEL") {
        alert(`결제 중 오류가 발생했어요.\n${e?.message || e?.code || ""}`);
      }
    } finally {
      setPayLoading(null);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/dashboard">
          <button className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            ←
          </button>
        </Link>
        <h1 className="text-[#0a0a0a] text-xl font-black tracking-tight">
          Work<span className="text-[#5b5ef4]">Ping</span>
        </h1>
        <div className="w-9" />
      </div>

      <div className="text-center mb-6">
        <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-1">Pricing</div>
        <h2 className="text-[#0a0a0a] text-2xl font-black tracking-tight">요금제 선택</h2>
      </div>

      {/* 회사 선택 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-3">회사 선택</div>
        {!selectedCompany ? (
          <>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="회사 이름 검색"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchCompany()}
                className="flex-1 bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
              />
              <button
                onClick={handleSearchCompany}
                disabled={searching}
                className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white px-4 rounded-xl transition-all text-sm font-bold disabled:opacity-50"
              >
                {searching ? "..." : "검색"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCompany(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f8f8f8] transition-all border-b border-[#e5e5e5] last:border-0 text-left"
                  >
                    <span>🏢</span>
                    <span className="text-[#0a0a0a] text-sm">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
            {searchResults.length === 0 && companySearch && !searching && (
              <div className="text-[#a0a0a0] text-sm text-center py-3">검색 결과가 없어요</div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between bg-[#f0f0ff] border border-[#c7c8fa] rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span>🏢</span>
              <span className="text-[#0a0a0a] text-sm font-bold">{selectedCompany.name}</span>
            </div>
            <button
              onClick={() => { setSelectedCompany(null); setCompanyId(null); setSubscription(null); }}
              className="text-[#4a4de0] text-xs hover:text-[#0a0a0a]"
            >
              변경
            </button>
          </div>
        )}
      </div>

      {/* 현재 구독 상태 */}
      {subscription && subscription.plan !== "free" && (
        <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-2xl p-4 mb-5 flex items-center justify-between">
          <div>
            <div className="text-[#4a4de0] text-xs font-semibold mb-0.5">현재 플랜</div>
            <div className="text-[#0a0a0a] font-black capitalize">{subscription.plan}</div>
          </div>
          <div className="text-right">
            <div className="text-[#a0a0a0] text-xs">만료일</div>
            <div className="text-[#0a0a0a] text-sm font-bold">{formatDate(subscription.expires_at)}</div>
          </div>
        </div>
      )}

      {/* 요금제 카드 */}
      <div className="space-y-4 mb-6">
        {PLANS.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-5 border-2 ${
                plan.highlight
                  ? "bg-[#5b5ef4] border-[#5b5ef4] shadow-[0_8px_32px_rgba(91,94,244,0.3)]"
                  : "bg-white border-[#e5e5e5] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`font-black text-base ${plan.highlight ? "text-white" : "text-[#0a0a0a]"}`}>
                  {plan.name}
                </div>
                <div className="flex items-center gap-2">
                  {isCurrent && (
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${plan.highlight ? "bg-white/20 text-white" : "bg-[#f0f0ff] text-[#5b5ef4]"}`}>
                      현재 플랜
                    </span>
                  )}
                  {plan.badge && !isCurrent && (
                    <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{plan.badge}</span>
                  )}
                </div>
              </div>

              <div className="flex items-end gap-1 mb-4">
                <span className={`text-3xl font-black tracking-tight ${plan.highlight ? "text-white" : "text-[#0a0a0a]"}`}>
                  {plan.priceLabel}
                </span>
                <span className={`text-sm mb-1 ${plan.highlight ? "text-white/70" : "text-[#6b6b6b]"}`}>{plan.period}</span>
              </div>

              <div className="space-y-2 mb-4">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className={`text-xs ${plan.highlight ? "text-white/80" : "text-[#16a34a]"}`}>✓</span>
                    <span className={`text-sm ${plan.highlight ? "text-white/90" : "text-[#6b6b6b]"}`}>{f}</span>
                  </div>
                ))}
              </div>

              {plan.id === "business" ? (
                <a href="mailto:eunsang0510@gmail.com">
                  <button className="w-full py-3 rounded-xl text-sm font-bold transition-all bg-[#5b5ef4] text-white hover:bg-[#4a4de0] shadow-[0_4px_16px_rgba(91,94,244,0.3)]">
                    문의하기
                  </button>
                </a>
              ) : plan.price > 0 && (
                <button
                  onClick={() => handlePayment(plan)}
                  disabled={isCurrent || payLoading === plan.id || !companyId}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    plan.highlight
                      ? "bg-white text-[#5b5ef4] hover:bg-white/90"
                      : "bg-[#5b5ef4] text-white hover:bg-[#4a4de0] shadow-[0_4px_16px_rgba(91,94,244,0.3)]"
                  }`}
                >
                  {payLoading === plan.id ? "처리중..." : isCurrent ? "현재 이용중" : !companyId ? "회사를 선택해주세요" : "결제하기"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[#a0a0a0] text-xs text-center">
        결제 관련 문의: eunsang0510@gmail.com
      </p>
    </main>
  );
}