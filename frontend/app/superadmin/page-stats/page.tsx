"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { screenLabel } from "@/lib/screenLabels";

const SYSTEM_ADMIN_EMAIL = "eunsang0510@gmail.com";

type GroupBy = "day" | "week" | "month";

interface SummaryResponse {
  start_date: string;
  end_date: string;
  group_by: GroupBy;
  paths: string[];
  periods: string[];
  matrix: Record<string, Record<string, number>>;
  totals: Record<string, number>;
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function PageStatsPage() {
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toDateInput(d);
  });
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const router = useRouter();

  const fetchSummary = useCallback(async () => {
    setFetching(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate, group_by: groupBy });
      const res = await fetch(`${API_URL}/api/page-view/summary?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error("Hit 요약 로딩 실패:", error);
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate, groupBy]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      if (!u || u.email !== SYSTEM_ADMIN_EMAIL) {
        router.push("/login");
        return;
      }
      setLoading(false);
      fetchSummary();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const grandTotal = summary ? Object.values(summary.totals).reduce((a, b) => a + b, 0) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/superadmin">
            <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              ←
            </div>
          </Link>
          <h1 className="text-[#0a0a0a] text-lg font-black">화면별 Hit 요약</h1>
        </div>
        <Link href="/superadmin/access-logs" className="text-[#5b5ef4] text-xs font-bold hover:text-[#4a4de0] transition-colors">
          접속 로그 →
        </Link>
      </div>

      {/* 필터 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">시작일</div>
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-3 py-2 outline-none focus:border-[#5b5ef4] transition-all text-sm"
            />
          </div>
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">종료일</div>
            <input
              type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-3 py-2 outline-none focus:border-[#5b5ef4] transition-all text-sm"
            />
          </div>
        </div>
        <div className="mb-3">
          <div className="text-[#a0a0a0] text-xs mb-1">집계 단위</div>
          <div className="flex gap-2">
            {(["day", "week", "month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  groupBy === g
                    ? "bg-[#5b5ef4] text-white"
                    : "bg-white border border-[#e5e5e5] text-[#6b6b6b]"
                }`}
              >
                {g === "day" ? "일별" : g === "week" ? "주별" : "월별"}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={fetchSummary}
          disabled={fetching}
          className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all text-sm"
        >
          {fetching ? "조회 중..." : "조회"}
        </button>
      </div>

      {summary && (
        <div className="text-[#a0a0a0] text-xs mb-2">
          {summary.start_date} ~ {summary.end_date} · 전체 Hit <span className="text-[#0a0a0a] font-bold">{grandTotal.toLocaleString()}</span>
        </div>
      )}

      {/* 요약 테이블 */}
      {!summary || summary.paths.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl text-[#a0a0a0] text-sm text-center py-12 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          조회된 접속 기록이 없어요
        </div>
      ) : (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e5e5e5]">
                <th className="text-left px-4 py-3 text-[#6b6b6b] font-bold sticky left-0 bg-white whitespace-nowrap">화면</th>
                {summary.periods.map((p) => (
                  <th key={p} className="text-right px-3 py-3 text-[#6b6b6b] font-bold whitespace-nowrap">{p}</th>
                ))}
                <th className="text-right px-4 py-3 text-[#0a0a0a] font-bold whitespace-nowrap">합계</th>
              </tr>
            </thead>
            <tbody>
              {summary.paths.map((path) => (
                <tr key={path} className="border-b border-[#f0f0f0] last:border-0">
                  <td className="text-left px-4 py-2.5 text-[#0a0a0a] font-medium sticky left-0 bg-white whitespace-nowrap">
                    {screenLabel(path)}
                  </td>
                  {summary.periods.map((p) => (
                    <td key={p} className="text-right px-3 py-2.5 text-[#6b6b6b] whitespace-nowrap">
                      {(summary.matrix[path]?.[p] ?? 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="text-right px-4 py-2.5 text-[#5b5ef4] font-bold whitespace-nowrap">
                    {summary.totals[path].toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
