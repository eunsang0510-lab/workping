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

interface DayRecord {
  checkin: string | null;
  checkout: string | null;
  checkin_address: string | null;
  checkout_address: string | null;
  work_minutes: number | null;
}

interface Leave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  is_half: boolean;
  reason: string;
  status: string;
}

interface Trip {
  id: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  status: string;
}

type EventPos = "start" | "middle" | "end" | "single" | null;

export default function CalendarPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DayRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [monthRecords, setMonthRecords] = useState<Record<string, boolean>>({});
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchMonthSummary(user.uid, currentMonth);
        fetchLeaves(user.uid);
        fetchTrips(user.uid);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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

  const fetchLeaves = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/leave/my/${userId}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setLeaves((data.leaves || []).filter((l: Leave) => l.status === "approved"));
    } catch {}
  };

  const fetchTrips = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/business-trip/my/${userId}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setTrips(
        (data.trips || []).filter(
          (t: Trip) => t.status === "approved" || t.status === "pending"
        )
      );
    } catch {}
  };

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
    const str = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
    const date = new Date(str);
    if (isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
  };

  const formatWorkTime = (minutes: number | null) => {
    if (!minutes) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const buildCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const toDateStr = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${month}-${d}`;
  };

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth.getMonth() === today.getMonth() &&
    currentMonth.getFullYear() === today.getFullYear();

  // 날짜가 이벤트 범위에서 어느 위치인지 반환
  const getEventPos = (
    dateStr: string,
    items: { start_date: string; end_date: string }[]
  ): EventPos => {
    const item = items.find(
      (i) => i.start_date <= dateStr && dateStr <= i.end_date
    );
    if (!item) return null;
    if (item.start_date === dateStr && item.end_date === dateStr) return "single";
    if (item.start_date === dateStr) return "start";
    if (item.end_date === dateStr) return "end";
    return "middle";
  };

  // 연속 이벤트 바 클래스 — 셀 경계를 넘어 이어지는 띠 효과
  // single/start는 왼쪽 인셋, end는 오른쪽 인셋으로 시작/끝 표시
  const barCls = (pos: EventPos, color: string): string => {
    const base = `h-[5px] ${color}`;
    if (pos === "single") return `${base} mx-[9px] rounded-full`;
    if (pos === "start")  return `${base} ml-[9px] rounded-l-full`;
    if (pos === "end")    return `${base} mr-[9px] rounded-r-full`;
    return base; // middle — 전체 너비, 모서리 없음
  };

  const cells = buildCalendar();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  const hasLeaves = leaves.length > 0;
  const hasTrips = trips.length > 0;

  const selectedLeave = selectedDate
    ? leaves.find((l) => l.start_date <= selectedDate && selectedDate <= l.end_date)
    : null;
  const selectedTrip = selectedDate
    ? trips.find((t) => t.start_date <= selectedDate && selectedDate <= t.end_date)
    : null;

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
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0ff] text-[#6b6b6b] hover:text-[#5b5ef4] transition-all font-bold">‹</button>
          <span className="text-[#0a0a0a] font-black text-base">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0ff] text-[#6b6b6b] hover:text-[#5b5ef4] transition-all font-bold">›</button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {weekdays.map((w, i) => (
            <div key={w} className={`text-center text-xs font-bold py-1 ${i === 0 ? "text-[#ef4444]" : i === 6 ? "text-[#5b5ef4]" : "text-[#a0a0a0]"}`}>
              {w}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            // 빈 칸 — 바 스페이서로 행 높이 통일
            if (!day) {
              return (
                <div key={idx} className="flex flex-col pb-1">
                  <div className="w-9 h-9 mx-auto" />
                  {hasLeaves && <div className="mt-0.5 h-[5px]" />}
                  {hasTrips  && <div className="mt-0.5 h-[5px]" />}
                </div>
              );
            }

            const dateStr = toDateStr(day);
            const hasRecord = monthRecords[dateStr];
            const isSelected = selectedDate === dateStr;
            const todayFlag = isToday(day);
            const isSun = idx % 7 === 0;
            const isSat = idx % 7 === 6;

            const leavePos = getEventPos(dateStr, leaves);
            const tripPos  = getEventPos(dateStr, trips);

            return (
              <div key={idx} className="flex flex-col pb-1">
                {/* 날짜 버튼 */}
                <button
                  onClick={() => handleDateClick(dateStr)}
                  className={`
                    relative mx-auto flex items-center justify-center w-9 h-9 rounded-xl text-sm font-semibold transition-all
                    ${isSelected
                      ? "bg-[#5b5ef4] text-white shadow-[0_4px_12px_rgba(91,94,244,0.35)]"
                      : todayFlag
                      ? "bg-[#f0f0ff] text-[#5b5ef4] border border-[#c7c8fa]"
                      : "hover:bg-[#f8f8f8] " + (isSun ? "text-[#ef4444]" : isSat ? "text-[#5b5ef4]" : "text-[#0a0a0a]")
                    }
                  `}
                >
                  {day}
                  {hasRecord && (
                    <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-[#5b5ef4]"}`} />
                  )}
                </button>

                {/* 연차 바 (없으면 높이 유지용 스페이서) */}
                {hasLeaves && (
                  leavePos
                    ? <div className={`mt-0.5 ${barCls(leavePos, "bg-[#16a34a]")}`} />
                    : <div className="mt-0.5 h-[5px]" />
                )}

                {/* 출장 바 (없으면 높이 유지용 스페이서) */}
                {hasTrips && (
                  tripPos
                    ? <div className={`mt-0.5 ${barCls(tripPos, "bg-[#f59e0b]")}`} />
                    : <div className="mt-0.5 h-[5px]" />
                )}
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        {(hasLeaves || hasTrips) && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#f0f0f0]">
            {hasLeaves && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-[5px] rounded-full bg-[#16a34a]" />
                <span className="text-[#6b6b6b] text-xs">연차</span>
              </div>
            )}
            {hasTrips && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-[5px] rounded-full bg-[#f59e0b]" />
                <span className="text-[#6b6b6b] text-xs">출장</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 선택된 날짜 상세 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {!selectedDate ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🗓️</div>
            <div className="text-[#a0a0a0] text-sm">날짜를 선택하면<br />기록을 볼 수 있어요</div>
          </div>
        ) : recordLoading ? (
          <div className="text-center py-8 text-[#5b5ef4] text-sm">불러오는 중...</div>
        ) : (
          <>
            <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">
              {selectedDate}
            </div>

            {/* 연차 카드 */}
            {selectedLeave && (
              <div className="flex items-stretch gap-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 mb-3">
                <div className="w-[3px] rounded-full bg-[#16a34a] shrink-0" />
                <div>
                  <div className="text-[#16a34a] text-[11px] font-bold mb-0.5">연차</div>
                  <div className="text-[#0a0a0a] text-sm font-bold">
                    {selectedLeave.is_half ? "반차" : `연차 ${selectedLeave.days}일`}
                  </div>
                  <div className="text-[#6b6b6b] text-xs mt-0.5">
                    {selectedLeave.start_date} ~ {selectedLeave.end_date}
                  </div>
                  {selectedLeave.reason && (
                    <div className="text-[#a0a0a0] text-xs mt-0.5">{selectedLeave.reason}</div>
                  )}
                </div>
              </div>
            )}

            {/* 출장 카드 */}
            {selectedTrip && (
              <div className="flex items-stretch gap-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl px-4 py-3 mb-3">
                <div className="w-[3px] rounded-full bg-[#f59e0b] shrink-0" />
                <div>
                  <div className="text-[#d97706] text-[11px] font-bold mb-0.5">
                    출장 {selectedTrip.status === "pending" ? "(승인대기)" : ""}
                  </div>
                  <div className="text-[#0a0a0a] text-sm font-bold">{selectedTrip.destination}</div>
                  <div className="text-[#6b6b6b] text-xs mt-0.5">
                    {selectedTrip.start_date} ~ {selectedTrip.end_date}
                  </div>
                  {selectedTrip.purpose && (
                    <div className="text-[#a0a0a0] text-xs mt-0.5">{selectedTrip.purpose}</div>
                  )}
                </div>
              </div>
            )}

            {/* 근로 기록 */}
            {!selectedRecord?.checkin ? (
              <div className="text-center py-4 text-[#a0a0a0] text-sm">
                {selectedLeave || selectedTrip ? "출퇴근 기록 없음" : "이 날의 기록이 없어요"}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#f8f8f8] rounded-xl p-4 flex items-center justify-between">
                  <div className="text-[#6b6b6b] text-sm">총 근무시간</div>
                  <div className="text-[#5b5ef4] text-xl font-black">{formatWorkTime(selectedRecord.work_minutes)}</div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#16a34a] mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[#0a0a0a] text-sm font-bold">출근</div>
                      <div className="text-[#16a34a] text-sm font-bold">{formatTime(selectedRecord.checkin)}</div>
                    </div>
                    {selectedRecord.checkin_address && (
                      <div className="text-[#6b6b6b] text-xs mt-0.5">📍 {selectedRecord.checkin_address}</div>
                    )}
                  </div>
                </div>

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
                      <div className="text-[#6b6b6b] text-xs mt-0.5">📍 {selectedRecord.checkout_address}</div>
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
