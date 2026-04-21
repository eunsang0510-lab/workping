"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface DailyData {
  checkin: string | null;
  checkout: string | null;
  work_hours: string;
  work_minutes: number;
}

interface Report {
  period: string;
  total_work_hours: string;
  work_days?: number;
  avg_work_hours?: string;
  daily: Record<string, DailyData>;
}

export default function Report() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [report, setReport] = useState<Report | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchReport(user.uid, "weekly");
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchReport = async (userId: string, type: "weekly" | "monthly") => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/${type}/${userId}`);
      const data = await res.json();
      setReport(data);
    } catch (error) {
      console.error("리포트 로딩 실패:", error);
    }
  };

  const handleTabChange = (tab: "weekly" | "monthly") => {
    setActiveTab(tab);
    if (user) fetchReport(user.uid, tab);
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  const getWorkBarWidth = (minutes: number) => {
    const max = 600;
    return Math.min((minutes / max) * 100, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-[#6366f1]">로딩 중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] p-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <div className="w-9 h-9 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-center text-[#71717a] hover:border-[#6366f1] transition-all cursor-pointer">
            ←
          </div>
        </Link>
        <h1 className="text-white text-lg font-bold">근태 리포트</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-5 bg-[#18181b] border border-[#27272a] rounded-xl p-1">
        {(["weekly", "monthly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-[#6366f1] text-white"
                : "text-[#71717a] hover:text-white"
            }`}
          >
            {tab === "weekly" ? "주간" : "월간"}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      {report && (
        <>
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 mb-4">
            <div className="text-[#71717a] text-xs mb-1">{report.period}</div>
            <div className="text-white text-3xl font-bold tracking-tight mb-3">
              {report.total_work_hours}
            </div>
            {activeTab === "monthly" && (
              <div className="flex gap-6 pt-3 border-t border-[#27272a]">
                <div>
                  <div className="text-[#71717a] text-xs mb-1">출근일수</div>
                  <div className="text-white font-semibold">
                    {report.work_days}일
                  </div>
                </div>
                <div>
                  <div className="text-[#71717a] text-xs mb-1">일평균</div>
                  <div className="text-white font-semibold">
                    {report.avg_work_hours}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 일별 기록 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5">
            <div className="text-[#71717a] text-xs font-semibold mb-4 uppercase tracking-wider">
              일별 기록
            </div>
            {Object.keys(report.daily).length === 0 ? (
              <div className="text-[#52525b] text-sm text-center py-8">
                기록이 없어요
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(report.daily)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, data]: [string, any]) => (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[#a1a1aa] text-sm">
                          {formatDate(date)}
                        </span>
                        <span className="text-[#6366f1] text-sm font-semibold">
                          {data.work_hours}
                        </span>
                      </div>
                      <div className="bg-[#27272a] rounded-full h-1.5 mb-2">
                        <div
                          className="bg-[#6366f1] rounded-full h-1.5 transition-all"
                          style={{
                            width: `${getWorkBarWidth(data.work_minutes)}%`,
                          }}
                        ></div>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-[#71717a] text-xs">
                          출근{" "}
                          <span className="text-[#22c55e]">
                            {formatTime(data.checkin)}
                          </span>
                        </span>
                        <span className="text-[#71717a] text-xs">
                          퇴근{" "}
                          <span className="text-[#ef4444]">
                            {formatTime(data.checkout)}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
