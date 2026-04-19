"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DailyData {
  checkin: string | null;
  checkout: string | null;
  checkin_address?: string;
  checkout_address?: string;
  work_hours: string;
  work_minutes: number;
}

interface WeeklyReport {
  period: string;
  total_work_hours: string;
  daily: Record<string, DailyData>;
}

export default function Report() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchReports(user.uid);
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchReports = async (userId: string) => {
    try {
      const [weeklyRes, monthlyRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/attendance/weekly/${userId}`),
        fetch(`http://127.0.0.1:8000/api/attendance/monthly/${userId}`)
      ]);
      const weekly = await weeklyRes.json();
      const monthly = await monthlyRes.json();
      setWeeklyReport(weekly);
      setMonthlyReport(monthly);
    } catch (error) {
      console.error("리포트 로딩 실패:", error);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    );
  }

  const report = activeTab === "weekly" ? weeklyReport : monthlyReport;

  return (
    <main className="min-h-screen bg-gray-950 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center cursor-pointer hover:bg-gray-700">
              <span className="text-white">←</span>
            </div>
          </Link>
          <h1 className="text-white text-xl font-bold">근태 리포트</h1>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {(["weekly", "monthly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {tab === "weekly" ? "주간" : "월간"}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      {report && (
        <>
          <div className="bg-blue-600 rounded-2xl p-6 mb-6">
            <p className="text-blue-200 text-sm mb-1">{report.period}</p>
            <h2 className="text-white text-2xl font-bold">
              총 {report.total_work_hours}
            </h2>
            {activeTab === "monthly" && (
              <div className="flex gap-4 mt-3">
                <div>
                  <p className="text-blue-200 text-xs">출근일수</p>
                  <p className="text-white font-bold">{report.work_days}일</p>
                </div>
                <div>
                  <p className="text-blue-200 text-xs">일평균</p>
                  <p className="text-white font-bold">{report.avg_work_hours}</p>
                </div>
              </div>
            )}
          </div>

          {/* 일별 기록 */}
          <div className="bg-gray-900 rounded-2xl p-5">
            <h3 className="text-white font-bold mb-4">📋 일별 기록</h3>
            {Object.keys(report.daily).length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8">
                기록이 없어요
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(report.daily)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, data]: [string, any]) => (
                    <div key={date} className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-sm">
                          {formatDate(date)}
                        </span>
                        <span className="text-blue-400 font-bold text-sm">
                          {data.work_hours}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-gray-500 text-xs">출근 </span>
                          <span className="text-green-400 text-xs">
                            {formatTime(data.checkin)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">퇴근 </span>
                          <span className="text-red-400 text-xs">
                            {formatTime(data.checkout)}
                          </span>
                        </div>
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