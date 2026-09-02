"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { checkSystemAdmin } from "@/lib/systemAdmin";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

interface Session {
  id: string;
  evaluator_name: string;
  evaluatee_name: string;
  status: string;
  ai_analysis: string | null;
  recorded_at: string;
  duration_seconds: number | null;
}

const STATUS_LABEL: Record<string, string> = { processing: "분석 중", completed: "완료", failed: "실패" };

export default function OneOnOneMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && (await checkSystemAdmin(u.email))) init(u.uid);
      else router.push("/login");
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const init = async (uid: string) => {
    try {
      // 화면 진입에 필요한 데이터를 한 번의 요청(/bootstrap/one-on-one)으로 모아 받는다.
      // 이전엔 company/my → cycles/active → one-on-one 목록 순으로 요청이 3번
      // 이어져서(왕복마다 지연 발생) 화면 진입이 느렸다.
      const res = await fetch(`${API_URL}/api/evaluation/bootstrap/one-on-one`, { headers: await getAuthHeader() });
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      setCompanyId(data.company_id || null);
      setSessions(data.sessions || []);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#6b6b6b] text-sm">불러오는 중...</div>;
  }

  if (!companyId || forbidden) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Link href="/evaluation" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[#6b6b6b] text-sm">
            평가관리자(회사 관리자 또는 상위 관리자)만 열람할 수 있어요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/evaluation" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <span className="text-[#0a0a0a] text-base font-bold">1on1 모니터링</span>
          <div className="w-8" />
        </div>

        {sessions.length === 0 ? (
          <div className="text-center text-[#6b6b6b] text-sm py-16">아직 녹음된 1on1이 없어요</div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s) => (
              <div key={s.id} className="bg-white border border-[#e5e5e5] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[#0a0a0a] text-sm font-bold">
                    {s.evaluator_name} → {s.evaluatee_name}
                  </div>
                  <span
                    className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                      s.status === "completed"
                        ? "text-[#16a34a] bg-[#f0fdf4]"
                        : s.status === "failed"
                        ? "text-[#ef4444] bg-[#fef2f2]"
                        : "text-[#d97706] bg-[#fffbeb]"
                    }`}
                  >
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                </div>
                <div className="text-[#b0b0b0] text-[11px] mb-2">
                  {new Date(s.recorded_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                {s.ai_analysis && (
                  <div className="text-[#0a0a0a] text-xs leading-relaxed whitespace-pre-wrap bg-[#fafafa] rounded-lg px-3 py-2">
                    {s.ai_analysis}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
