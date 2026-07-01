"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { API_URL } from "@/lib/api";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Authorization": `Bearer ${token}` };
};

interface DailyData {
  checkin: string | null;
  checkout: string | null;
  work_hours: string;
  work_minutes: number;
}

interface Report {
  period: string;
  week_start?: string;
  year?: number;
  month?: number;
  total_work_hours: string;
  work_days?: number;
  avg_work_hours?: string;
  daily: Record<string, DailyData>;
}

function getCurrentMonday(): Date {
  const today = new Date();
  const d = today.getDay();
  const diff = d === 0 ? -6 : 1 - d;
  const mon = new Date(today);
  mon.setDate(today.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getCurrentMonthStart(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekLabel(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} ~ ${sun.getMonth() + 1}/${sun.getDate()}`;
}

function getMonthLabel(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function isCurrentWeek(mon: Date): boolean {
  const current = getCurrentMonday();
  return mon.getTime() === current.getTime();
}

function isCurrentMonth(d: Date): boolean {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

export default function Report() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [report, setReport] = useState<Report | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(getCurrentMonday);
  const [monthDate, setMonthDate] = useState<Date>(getCurrentMonthStart);
  const router = useRouter();

  const fetchReport = async (
    userId: string,
    type: "weekly" | "monthly",
    wStart: Date,
    mDate: Date
  ) => {
    try {
      let url = `${API_URL}/api/attendance/${type}/${userId}`;
      if (type === "weekly") {
        url += `?start_date=${toYMD(wStart)}`;
      } else {
        url += `?year=${mDate.getFullYear()}&month=${mDate.getMonth() + 1}`;
      }
      const res = await fetch(url, { headers: await getAuthHeader() });
      const data = await res.json();
      setReport(data);
    } catch (error) {
      console.error("리포트 로딩 실패:", error);
    }
  };

  useEffect(() => {
    const mon = getCurrentMonday();
    const mDate = getCurrentMonthStart();
    setWeekStart(mon);
    setMonthDate(mDate);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchReport(user.uid, "weekly", mon, mDate);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleTabChange = (tab: "weekly" | "monthly") => {
    setActiveTab(tab);
    if (user) fetchReport(user.uid, tab, weekStart, monthDate);
  };

  const handlePrev = () => {
    if (activeTab === "weekly") {
      const prev = new Date(weekStart);
      prev.setDate(prev.getDate() - 7);
      setWeekStart(prev);
      if (user) fetchReport(user.uid, "weekly", prev, monthDate);
    } else {
      const prev = new Date(monthDate);
      prev.setMonth(prev.getMonth() - 1);
      setMonthDate(prev);
      if (user) fetchReport(user.uid, "monthly", weekStart, prev);
    }
  };

  const handleNext = () => {
    if (activeTab === "weekly") {
      if (isCurrentWeek(weekStart)) return;
      const next = new Date(weekStart);
      next.setDate(next.getDate() + 7);
      setWeekStart(next);
      if (user) fetchReport(user.uid, "weekly", next, monthDate);
    } else {
      if (isCurrentMonth(monthDate)) return;
      const next = new Date(monthDate);
      next.setMonth(next.getMonth() + 1);
      setMonthDate(next);
      if (user) fetchReport(user.uid, "monthly", weekStart, next);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
  };

  const getWorkBarWidth = (minutes: number) => {
    return Math.min((minutes / 600) * 100, 100);
  };

  const atCurrentPeriod = activeTab === "weekly" ? isCurrentWeek(weekStart) : isCurrentMonth(monthDate);

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
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            ←
          </div>
        </Link>
        <h1 className="text-[#0a0a0a] text-lg font-black">근태 리포트</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-3 bg-white border border-[#e5e5e5] rounded-xl p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {(["weekly", "monthly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab ? "bg-[#5b5ef4] text-white" : "text-[#6b6b6b] hover:text-[#0a0a0a]"
            }`}
          >
            {tab === "weekly" ? "주간" : "월간"}
          </button>
        ))}
      </div>

      {/* 기간 네비게이션 */}
      <div className="flex items-center justify-between bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <button
          onClick={handlePrev}
          className="w-8 h-8 flex items-center justify-center text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f0f0f0] rounded-lg transition-all"
        >
          ←
        </button>
        <span className="text-[#0a0a0a] text-sm font-semibold">
          {activeTab === "weekly" ? getWeekLabel(weekStart) : getMonthLabel(monthDate)}
        </span>
        <button
          onClick={handleNext}
          disabled={atCurrentPeriod}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
            atCurrentPeriod
              ? "text-[#d0d0d0] cursor-not-allowed"
              : "text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f0f0f0]"
          }`}
        >
          →
        </button>
      </div>

      {report && (
        <>
          {/* 요약 카드 */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="text-[#a0a0a0] text-xs mb-1">{report.period}</div>
            <div className="text-[#0a0a0a] text-3xl font-black tracking-tight mb-3">{report.total_work_hours}</div>
            {activeTab === "monthly" && (
              <div className="flex gap-6 pt-3 border-t border-[#e5e5e5]">
                <div>
                  <div className="text-[#a0a0a0] text-xs mb-1">출근일수</div>
                  <div className="text-[#0a0a0a] font-bold">{report.work_days}일</div>
                </div>
                <div>
                  <div className="text-[#a0a0a0] text-xs mb-1">일평균</div>
                  <div className="text-[#0a0a0a] font-bold">{report.avg_work_hours}</div>
                </div>
              </div>
            )}
          </div>

          {/* 일별 기록 */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="text-[#a0a0a0] text-xs font-semibold mb-4 uppercase tracking-wider">일별 기록</div>
            {Object.keys(report.daily).length === 0 ? (
              <div className="text-[#a0a0a0] text-sm text-center py-8">기록이 없어요</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(report.daily)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, data]: [string, any]) => (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[#6b6b6b] text-sm">{formatDate(date)}</span>
                        <span className="text-[#5b5ef4] text-sm font-bold">{data.work_hours}</span>
                      </div>
                      <div className="bg-[#f0f0f0] rounded-full h-1.5 mb-2">
                        <div
                          className="bg-[#5b5ef4] rounded-full h-1.5 transition-all"
                          style={{ width: `${getWorkBarWidth(data.work_minutes)}%` }}
                        />
                      </div>
                      <div className="flex gap-4">
                        <span className="text-[#a0a0a0] text-xs">
                          출근 <span className="text-[#16a34a] font-medium">{formatTime(data.checkin)}</span>
                        </span>
                        <span className="text-[#a0a0a0] text-xs">
                          퇴근 <span className="text-[#ef4444] font-medium">{formatTime(data.checkout)}</span>
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
