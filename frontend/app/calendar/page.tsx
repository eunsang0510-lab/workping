"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Authorization": `Bearer ${token}` };
};

interface DayRecord {
  checkin: string | null;
  checkout: string | null;
  checkin_address: string | null;
  checkout_address: string | null;
  work_minutes: number | null;
}

export default function CalendarPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DayRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [monthRecords, setMonthRecords] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchMonthSummary(user.uid, currentMonth);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 해당 월에 기록 있는 날짜 가져오기
  const fetchMonthSummary = async (userId: string, month: Date) => {
    try {
      const year = month.getFullYear();
      const m = month.getMonth() + 1;
      const res = await fetch(`${API_URL}/api/attendance/month/${userId}?year=${year}&month=${m}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setMonthRecords(data.dates || {});
    } catch {
      setMonthRecords({});
    }
  };


  // 특정 날짜 기록 가져오기
  const fetchDayRecord = async (userId: string, dateStr: string) => {
    setRecordLoading(true);
    setSelectedRecord(null);
    try {
      const res = await fetch(`${API_URL}/api/attendance/day/${userId}?date=${dateStr}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setSelectedRecord(data);
    } catch {
      setSelectedRecord(null);
    } finally {
      setRecordLoading(false);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    if (user) fetchDayRecord(user.uid, dateStr);
  };

  const prevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
    setSelectedDate(null);
    setSelectedRecord(null);
    if (user) fetchMonthSummary(user.uid, d);
  };

  const nextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
    setSelectedDate(null);
    setSelectedRecord(null);
    if (user) fetchMonthSummary(user.uid, d);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "--:--";
    return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatWorkTime = (minutes: number | null) => {
    if (!minutes) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  // 달력 날짜 배열 만들기
  const buildCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=일
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // 6줄 맞추기
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const toDateStr = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${month}-${d}`;
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const cells = buildCalendar();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

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

      {/* 달력 카드 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">

        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0ff] text-[#6b6b6b] hover:text-[#5b5ef4] transition-all font-bold"
          >
            ‹
          </button>
          <span className="text-[#0a0a0a] font-black text-base">
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0ff] text-[#6b6b6b] hover:text-[#5b5ef4] transition-all font-bold"
          >
            ›
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-2">
          {weekdays.map((w, i) => (
            <div
              key={w}
              className={`text-center text-xs font-bold py-1 ${
                i === 0 ? "text-[#ef4444]" : i === 6 ? "text-[#5b5ef4]" : "text-[#a0a0a0]"
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateStr = toDateStr(day);
            const hasRecord = monthRecords[dateStr];
            const isSelected = selectedDate === dateStr;
            const todayFlag = isToday(day);
            const isSun = idx % 7 === 0;
            const isSat = idx % 7 === 6;

            return (
              <button
                key={idx}
                onClick={() => handleDateClick(dateStr)}
                className={`
                  relative mx-auto flex flex-col items-center justify-center w-9 h-9 rounded-xl text-sm font-semibold transition-all
                  ${isSelected
                    ? "bg-[#5b5ef4] text-white shadow-[0_4px_12px_rgba(91,94,244,0.35)]"
                    : todayFlag
                    ? "bg-[#f0f0ff] text-[#5b5ef4] border border-[#c7c8fa]"
                    : "hover:bg-[#f8f8f8] " + (isSun ? "text-[#ef4444]" : isSat ? "text-[#5b5ef4]" : "text-[#0a0a0a]")
                  }
                `}
              >
                {day}
                {/* 기록 있는 날 점 표시 */}
                {hasRecord && (
                  <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-[#5b5ef4]"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 근로기록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {!selectedDate ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🗓️</div>
            <div className="text-[#a0a0a0] text-sm">날짜를 선택하면<br />근로 기록을 볼 수 있어요</div>
          </div>
        ) : recordLoading ? (
          <div className="text-center py-8 text-[#5b5ef4] text-sm">불러오는 중...</div>
        ) : (
          <>
            <div className="text-[#a0a0a0] text-xs font-semibold mb-4 uppercase tracking-wider">
              {selectedDate} 근로 기록
            </div>

            {!selectedRecord?.checkin ? (
              <div className="text-center py-6 text-[#a0a0a0] text-sm">이 날의 기록이 없어요</div>
            ) : (
              <div className="space-y-4">

                {/* 근무 시간 요약 */}
                <div className="bg-[#f8f8f8] rounded-xl p-4 flex items-center justify-between">
                  <div className="text-[#6b6b6b] text-sm">총 근무시간</div>
                  <div className="text-[#5b5ef4] text-xl font-black">
                    {formatWorkTime(selectedRecord.work_minutes)}
                  </div>
                </div>

                {/* 출근 기록 */}
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#16a34a] mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[#0a0a0a] text-sm font-bold">출근</div>
                      <div className="text-[#16a34a] text-sm font-bold">
                        {formatTime(selectedRecord.checkin)}
                      </div>
                    </div>
                    {selectedRecord.checkin_address && (
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        📍 {selectedRecord.checkin_address}
                      </div>
                    )}
                  </div>
                </div>

                {/* 퇴근 기록 */}
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${selectedRecord.checkout ? "bg-[#ef4444]" : "bg-[#e5e5e5]"}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[#0a0a0a] text-sm font-bold">퇴근</div>
                      <div className={`text-sm font-bold ${selectedRecord.checkout ? "text-[#ef4444]" : "text-[#a0a0a0]"}`}>
                        {formatTime(selectedRecord.checkout)}
                      </div>
                    </div>
                    {selectedRecord.checkout_address && (
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        📍 {selectedRecord.checkout_address}
                      </div>
                    )}
                    {!selectedRecord.checkout && (
                      <div className="text-[#a0a0a0] text-xs mt-0.5">퇴근 기록 없음</div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}