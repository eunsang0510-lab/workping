"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { SCREEN_LABELS, screenLabel } from "@/lib/screenLabels";

const SYSTEM_ADMIN_EMAIL = "eunsang0510@gmail.com";
const PAGE_SIZE = 50;

interface LogRow {
  id: string;
  path: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AccessLogsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [path, setPath] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toDateInput(d);
  });
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [fetching, setFetching] = useState(false);
  const router = useRouter();

  const fetchLogs = useCallback(async (targetPage: number) => {
    setFetching(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams({
        page: String(targetPage),
        page_size: String(PAGE_SIZE),
        start_date: startDate,
        end_date: endDate,
      });
      if (path) params.set("path", path);
      const res = await fetch(`${API_URL}/api/page-view/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(targetPage);
    } catch (error) {
      console.error("접속 로그 로딩 실패:", error);
    } finally {
      setFetching(false);
    }
  }, [path, startDate, endDate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      if (!u || u.email !== SYSTEM_ADMIN_EMAIL) {
        router.push("/login");
        return;
      }
      setLoading(false);
      fetchLogs(1);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          <h1 className="text-[#0a0a0a] text-lg font-black">화면 접속 로그</h1>
        </div>
        <Link href="/superadmin/page-stats" className="text-[#5b5ef4] text-xs font-bold hover:text-[#4a4de0] transition-colors">
          Hit 요약 →
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
          <div className="text-[#a0a0a0] text-xs mb-1">화면</div>
          <select
            value={path} onChange={(e) => setPath(e.target.value)}
            className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-3 py-2 outline-none focus:border-[#5b5ef4] transition-all text-sm"
          >
            <option value="">전체 화면</option>
            {Object.entries(SCREEN_LABELS).map(([p, label]) => (
              <option key={p} value={p}>{label} ({p})</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => fetchLogs(1)}
          disabled={fetching}
          className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all text-sm"
        >
          {fetching ? "조회 중..." : "조회"}
        </button>
      </div>

      <div className="text-[#a0a0a0] text-xs mb-2">총 {total.toLocaleString()}건</div>

      {/* 로그 목록 */}
      <div className="space-y-2">
        {logs.length === 0 ? (
          <div className="text-[#a0a0a0] text-sm text-center py-12">조회된 접속 기록이 없어요</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#0a0a0a] font-bold text-sm">{screenLabel(log.path)}</span>
                <span className="text-[#a0a0a0] text-xs">{formatDateTime(log.created_at)}</span>
              </div>
              <div className="text-[#6b6b6b] text-xs">
                {log.user_name || "이름 없음"}
                {log.user_email && <span className="text-[#a0a0a0]"> · {log.user_email}</span>}
                {!log.user_id && <span className="text-[#a0a0a0]"> · 비로그인</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {total > 0 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || fetching}
            className="bg-white border border-[#e5e5e5] disabled:opacity-40 text-[#6b6b6b] text-xs font-bold px-3 py-2 rounded-xl transition-all"
          >
            이전
          </button>
          <span className="text-[#6b6b6b] text-xs">{page} / {totalPages}</span>
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages || fetching}
            className="bg-white border border-[#e5e5e5] disabled:opacity-40 text-[#6b6b6b] text-xs font-bold px-3 py-2 rounded-xl transition-all"
          >
            다음
          </button>
        </div>
      )}
    </main>
  );
}
