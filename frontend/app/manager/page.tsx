"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { API_URL } from "@/lib/api";
import Link from "next/link";

type Tab = "leave" | "trip" | "attendance" | "status";

interface LeaveItem {
  id: string;
  user_id: string;
  user_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  is_half: boolean;
  reason: string;
  status: string;
  created_at: string;
}

interface TripItem {
  id: string;
  user_id: string;
  user_name: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
}

interface AttendanceMember {
  user_id: string;
  user_name: string;
  user_email: string;
  status: string;
  checkin: string | null;
  checkin_address: string | null;
  checkout: string | null;
  is_missing_checkout: boolean;
}

interface MemberReport {
  user_id: string;
  user_name: string;
  user_email: string;
  work_days: number;
  total_work_hours: string;
  total_minutes: number;
  daily: Record<string, { checkin: string | null; checkout: string | null; work_minutes: number }>;
}

interface CompanyReport {
  period: string;
  period_start: string;
  period_end: string;
  members: MemberReport[];
}

interface Toast {
  message: string;
  type: "success" | "error";
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function getWeekLabel(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} ~ ${sun.getMonth() + 1}/${sun.getDate()}`;
}

function getMonthLabel(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function isCurrentWeek(mon: Date): boolean {
  return mon.getTime() === getCurrentMonday().getTime();
}

function isCurrentMonth(d: Date): boolean {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

function formatTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function ManagerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("leave");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMember[]>([]);

  const [rejectModal, setRejectModal] = useState<{ id: string; type: "leave" | "trip" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 기간 네비게이션 상태 (전체 탭 공유)
  const [reportType, setReportType] = useState<"weekly" | "monthly">("weekly");
  const [reportWeekStart, setReportWeekStart] = useState<Date>(getCurrentMonday);
  const [reportMonthDate, setReportMonthDate] = useState<Date>(getCurrentMonthStart);
  const [companyReport, setCompanyReport] = useState<CompanyReport | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getAuthHeader = async () => {
    const token = await auth.currentUser?.getIdToken();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  const fetchLeaves = useCallback(async (cid: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/leave/company/${cid}`, { headers });
      const data = await res.json();
      setLeaves(data.leaves || []);
    } catch {
      showToast("연차 목록 로딩 실패", "error");
    }
  }, []);

  const fetchTrips = useCallback(async (cid: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/business-trip/company/${cid}`, { headers });
      const data = await res.json();
      setTrips(data.trips || []);
    } catch {
      showToast("출장 목록 로딩 실패", "error");
    }
  }, []);

  const fetchAttendance = useCallback(async (cid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/attendance/${cid}`);
      const data = await res.json();
      setAttendance(data.attendance || []);
    } catch {
      showToast("근태현황 로딩 실패", "error");
    }
  }, []);

  const fetchCompanyReport = useCallback(async (
    cid: string,
    type: "weekly" | "monthly",
    wStart: Date,
    mDate: Date
  ) => {
    try {
      const headers = await getAuthHeader();
      let url = `${API_URL}/api/attendance/company-report/${cid}?type=${type}`;
      if (type === "weekly") {
        url += `&start_date=${toYMD(wStart)}`;
      } else {
        url += `&year=${mDate.getFullYear()}&month=${mDate.getMonth() + 1}`;
      }
      const res = await fetch(url, { headers });
      const data = await res.json();
      setCompanyReport(data);
    } catch {
      showToast("리포트 로딩 실패", "error");
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const res = await fetch(`${API_URL}/api/company/my/${user.uid}`);
        const data = await res.json();
        if (!data.company_id || (!data.is_manager && !data.is_admin)) {
          router.push("/dashboard");
          return;
        }
        setCompanyId(data.company_id);
        fetchLeaves(data.company_id);
        fetchTrips(data.company_id);
        fetchAttendance(data.company_id);
      } catch {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router, fetchLeaves, fetchTrips, fetchAttendance]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === "attendance" && companyId) {
      fetchCompanyReport(companyId, reportType, reportWeekStart, reportMonthDate);
    }
  };

  const handleReportTypeChange = (type: "weekly" | "monthly") => {
    setReportType(type);
    if (companyId && tab === "attendance") {
      fetchCompanyReport(companyId, type, reportWeekStart, reportMonthDate);
    }
  };

  const handleReportPrev = () => {
    if (reportType === "weekly") {
      const prev = new Date(reportWeekStart);
      prev.setDate(prev.getDate() - 7);
      setReportWeekStart(prev);
      if (companyId && tab === "attendance") fetchCompanyReport(companyId, "weekly", prev, reportMonthDate);
    } else {
      const prev = new Date(reportMonthDate);
      prev.setMonth(prev.getMonth() - 1);
      setReportMonthDate(prev);
      if (companyId && tab === "attendance") fetchCompanyReport(companyId, "monthly", reportWeekStart, prev);
    }
  };

  const handleReportNext = () => {
    if (reportType === "weekly") {
      if (isCurrentWeek(reportWeekStart)) return;
      const next = new Date(reportWeekStart);
      next.setDate(next.getDate() + 7);
      setReportWeekStart(next);
      if (companyId && tab === "attendance") fetchCompanyReport(companyId, "weekly", next, reportMonthDate);
    } else {
      if (isCurrentMonth(reportMonthDate)) return;
      const next = new Date(reportMonthDate);
      next.setMonth(next.getMonth() + 1);
      setReportMonthDate(next);
      if (companyId && tab === "attendance") fetchCompanyReport(companyId, "monthly", reportWeekStart, next);
    }
  };

  const approveLeave = async (leaveId: string, status: "approved" | "rejected") => {
    if (!companyId) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/leave/approve/${leaveId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const d = await res.json();
        const msg =
          d.status === "cancelled" ? "연차 취소 승인 완료" :
          d.status === "approved" && status === "rejected" ? "연차 취소 반려 완료" :
          status === "approved" ? "연차 승인 완료" : "연차 반려 완료";
        showToast(msg, "success");
        fetchLeaves(companyId);
      } else {
        const d = await res.json();
        showToast(d.detail || "처리 실패", "error");
      }
    } catch {
      showToast("처리 중 오류", "error");
    }
  };

  const approveTrip = async (tripId: string, status: "approved" | "rejected", reason = "") => {
    if (!companyId) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/business-trip/approve/${tripId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status, reject_reason: reason }),
      });
      if (res.ok) {
        const d = await res.json();
        const msg =
          d.status === "cancelled" ? "출장 취소 승인 완료" :
          d.status === "approved" && status === "rejected" ? "출장 취소 반려 완료" :
          status === "approved" ? "출장 승인 완료" : "출장 반려 완료";
        showToast(msg, "success");
        fetchTrips(companyId);
      } else {
        const d = await res.json();
        showToast(d.detail || "처리 실패", "error");
      }
    } catch {
      showToast("처리 중 오류", "error");
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (rejectModal.type === "leave") {
      await approveLeave(rejectModal.id, "rejected");
    } else {
      await approveTrip(rejectModal.id, "rejected", rejectReason);
    }
    setRejectModal(null);
    setRejectReason("");
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="text-xs font-bold text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded-full">승인</span>;
    if (status === "rejected") return <span className="text-xs font-bold text-[#ef4444] bg-[#fef2f2] border border-[#fecaca] px-2 py-0.5 rounded-full">반려</span>;
    if (status === "cancel_requested") return <span className="text-xs font-bold text-[#c2410c] bg-[#fff7ed] border border-[#fed7aa] px-2 py-0.5 rounded-full">취소신청</span>;
    if (status === "cancelled") return <span className="text-xs font-bold text-[#9ca3af] bg-[#f3f4f6] border border-[#e5e7eb] px-2 py-0.5 rounded-full">취소됨</span>;
    return <span className="text-xs font-bold text-[#f59e0b] bg-[#fffbeb] border border-[#fde68a] px-2 py-0.5 rounded-full">대기</span>;
  };

  // 기간 범위 계산
  const getPeriodRange = () => {
    if (reportType === "weekly") {
      const start = toYMD(reportWeekStart);
      const end = toYMD(new Date(reportWeekStart.getFullYear(), reportWeekStart.getMonth(), reportWeekStart.getDate() + 6));
      return { start, end };
    } else {
      const start = toYMD(reportMonthDate);
      const lastDay = new Date(reportMonthDate.getFullYear(), reportMonthDate.getMonth() + 1, 0);
      return { start, end: toYMD(lastDay) };
    }
  };

  const { start: pStart, end: pEnd } = getPeriodRange();

  // 탭 배지: 전체 미처리 건수
  const totalPendingLeaves = leaves.filter(l => l.status === "pending" || l.status === "cancel_requested");
  const totalPendingTrips = trips.filter(t => t.status === "pending" || t.status === "cancel_requested");

  // 연차 탭: 기간 필터 적용
  const periodLeaves = leaves.filter(l => l.start_date <= pEnd && l.end_date >= pStart);
  const pendingLeaves = periodLeaves.filter(l => l.status === "pending" || l.status === "cancel_requested");
  const doneLeaves = periodLeaves.filter(l => l.status !== "pending" && l.status !== "cancel_requested" && l.status !== "cancelled");

  // 출장 탭: 기간 필터 적용
  const periodTrips = trips.filter(t => t.start_date <= pEnd && t.end_date >= pStart);
  const pendingTrips = periodTrips.filter(t => t.status === "pending" || t.status === "cancel_requested");
  const doneTrips = periodTrips.filter(t => t.status !== "pending" && t.status !== "cancel_requested" && t.status !== "cancelled");

  // 현황 탭: 승인된 휴가·출장 기간 필터
  const approvedHistory: { date: string; end_date: string; name: string; label: string; detail: string }[] = [
    ...leaves
      .filter(l => l.status === "approved")
      .map(l => ({
        date: l.start_date,
        end_date: l.end_date,
        name: l.user_name || "이름 없음",
        label: "🏖️ 휴가",
        detail: l.is_half ? `반차 (${l.start_date})` : `${l.start_date}${l.start_date !== l.end_date ? ` ~ ${l.end_date}` : ""} · ${l.days}일`,
      })),
    ...trips
      .filter(t => t.status === "approved")
      .map(t => ({
        date: t.start_date,
        end_date: t.end_date,
        name: t.user_name || "이름 없음",
        label: "✈️ 출장",
        detail: `${t.destination} · ${t.start_date}${t.start_date !== t.end_date ? ` ~ ${t.end_date}` : ""}`,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filteredHistory = approvedHistory.filter(h => h.date <= pEnd && h.end_date >= pStart);

  // 근태현황 분류 (오늘 실시간)
  const checkinCount = attendance.filter(m => m.status === "출근중").length;
  const checkoutCount = attendance.filter(m => m.status === "퇴근").length;
  const absentCount = attendance.filter(m => m.status === "미출근").length;
  const missingCount = attendance.filter(m => m.status === "미퇴근").length;

  const statusColor = (s: string) => {
    if (s === "출근중") return "text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]";
    if (s === "퇴근") return "text-[#5b5ef4] bg-[#f5f5ff] border-[#c7c8fa]";
    if (s === "미퇴근") return "text-[#f59e0b] bg-[#fffbeb] border-[#fde68a]";
    return "text-[#a0a0a0] bg-[#f8f8f8] border-[#e5e5e5]";
  };

  const atCurrentPeriod = reportType === "weekly" ? isCurrentWeek(reportWeekStart) : isCurrentMonth(reportMonthDate);

  // 공통 기간 네비게이션 컴포넌트 (leave/trip 탭용 — attendance 탭은 별도 핸들러)
  const PeriodNav = (
    <div className="mb-4">
      <div className="flex gap-2 mb-3 bg-white border border-[#e5e5e5] rounded-xl p-1 shadow-sm">
        {(["weekly", "monthly"] as const).map(t => (
          <button
            key={t}
            onClick={() => setReportType(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              reportType === t ? "bg-[#5b5ef4] text-white" : "text-[#6b6b6b] hover:text-[#0a0a0a]"
            }`}
          >
            {t === "weekly" ? "주간" : "월간"}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 shadow-sm">
        <button
          onClick={() => {
            if (reportType === "weekly") {
              const prev = new Date(reportWeekStart);
              prev.setDate(prev.getDate() - 7);
              setReportWeekStart(prev);
            } else {
              const prev = new Date(reportMonthDate);
              prev.setMonth(prev.getMonth() - 1);
              setReportMonthDate(prev);
            }
          }}
          className="w-8 h-8 flex items-center justify-center text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f0f0f0] rounded-lg transition-all"
        >←</button>
        <span className="text-[#0a0a0a] text-sm font-semibold">
          {reportType === "weekly" ? getWeekLabel(reportWeekStart) : getMonthLabel(reportMonthDate)}
        </span>
        <button
          onClick={() => {
            if (reportType === "weekly") {
              if (isCurrentWeek(reportWeekStart)) return;
              const next = new Date(reportWeekStart);
              next.setDate(next.getDate() + 7);
              setReportWeekStart(next);
            } else {
              if (isCurrentMonth(reportMonthDate)) return;
              const next = new Date(reportMonthDate);
              next.setMonth(next.getMonth() + 1);
              setReportMonthDate(next);
            }
          }}
          disabled={atCurrentPeriod}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
            atCurrentPeriod ? "text-[#d0d0d0] cursor-not-allowed" : "text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f0f0f0]"
          }`}
        >→</button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5 pb-10">
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[999] px-4 py-3 rounded-xl text-white text-sm font-bold shadow-lg ${toast.type === "success" ? "bg-[#16a34a]" : "bg-[#ef4444]"}`}>
          {toast.message}
        </div>
      )}

      {/* 반려 사유 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="font-black text-[#0a0a0a] mb-3">반려 사유</div>
            {rejectModal.type === "trip" && (
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요 (선택)"
                rows={3}
                className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#5b5ef4] mb-3 resize-none"
              />
            )}
            {rejectModal.type === "leave" && (
              <p className="text-[#6b6b6b] text-sm mb-3">반려 처리하시겠어요?</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }} className="flex-1 border border-[#e5e5e5] text-[#6b6b6b] font-bold py-2.5 rounded-xl text-sm">취소</button>
              <button onClick={handleReject} className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-2.5 rounded-xl text-sm">반려</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <button className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-sm">←</button>
        </Link>
        <div>
          <h1 className="text-[#0a0a0a] text-lg font-black">팀장 권한</h1>
          <p className="text-[#6b6b6b] text-xs">팀원 연차·출장 승인 및 근태현황</p>
        </div>
      </div>

      {/* 탭 — 배지는 전체 미처리 건수 */}
      <div className="grid grid-cols-4 bg-white border border-[#e5e5e5] rounded-2xl p-1 mb-5 shadow-sm gap-0.5">
        {([
          { key: "leave", label: "연차", badge: totalPendingLeaves.length },
          { key: "trip", label: "출장", badge: totalPendingTrips.length },
          { key: "attendance", label: "근태", badge: 0 },
          { key: "status", label: "현황", badge: 0 },
        ] as { key: Tab; label: string; badge: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1 ${tab === t.key ? "bg-[#5b5ef4] text-white shadow-sm" : "text-[#6b6b6b] hover:text-[#0a0a0a]"}`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${tab === t.key ? "bg-white/30 text-white" : "bg-[#ef4444] text-white"}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 연차 승인 탭 ── */}
      {tab === "leave" && (
        <div className="space-y-3">
          {PeriodNav}
          {pendingLeaves.length === 0 && doneLeaves.length === 0 && (
            <div className="text-center py-12 text-[#a0a0a0] text-sm">해당 기간에 연차 신청 내역이 없어요</div>
          )}
          {pendingLeaves.length > 0 && (
            <>
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1">대기 중 ({pendingLeaves.length})</div>
              {pendingLeaves.map(l => (
                <div key={l.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${l.status === "cancel_requested" ? "border-[#fed7aa]" : "border-[#e5e5e5]"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{l.user_name || "이름 없음"}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        {l.is_half ? "반차" : `연차 ${l.days}일`} · {l.start_date}{l.start_date !== l.end_date ? ` ~ ${l.end_date}` : ""}
                      </div>
                      {l.status === "cancel_requested" && (
                        <div className="text-[#c2410c] text-xs mt-1 font-medium">취소 신청이 들어왔어요</div>
                      )}
                    </div>
                    {statusBadge(l.status)}
                  </div>
                  {l.reason && <div className="text-[#6b6b6b] text-xs bg-[#f8f8f8] rounded-lg px-3 py-2 mb-3">사유: {l.reason}</div>}
                  {l.status === "cancel_requested" ? (
                    <div className="flex gap-2">
                      <button onClick={() => approveLeave(l.id, "approved")} className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-bold py-2 rounded-xl transition-all">취소 승인</button>
                      <button onClick={() => setRejectModal({ id: l.id, type: "leave" })} className="flex-1 border border-[#e5e5e5] text-[#6b6b6b] text-sm font-bold py-2 rounded-xl hover:bg-[#f8f8f8] transition-all">취소 반려</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => approveLeave(l.id, "approved")} className="flex-1 bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-sm font-bold py-2 rounded-xl transition-all">승인</button>
                      <button onClick={() => setRejectModal({ id: l.id, type: "leave" })} className="flex-1 border border-[#e5e5e5] text-[#ef4444] text-sm font-bold py-2 rounded-xl hover:bg-[#fef2f2] transition-all">반려</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {doneLeaves.length > 0 && (
            <>
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1 mt-4">처리 완료</div>
              {doneLeaves.map(l => (
                <div key={l.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm opacity-70">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{l.user_name || "이름 없음"}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        {l.is_half ? "반차" : `연차 ${l.days}일`} · {l.start_date}{l.start_date !== l.end_date ? ` ~ ${l.end_date}` : ""}
                      </div>
                    </div>
                    {statusBadge(l.status)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── 출장 승인 탭 ── */}
      {tab === "trip" && (
        <div className="space-y-3">
          {PeriodNav}
          {pendingTrips.length === 0 && doneTrips.length === 0 && (
            <div className="text-center py-12 text-[#a0a0a0] text-sm">해당 기간에 출장 신청 내역이 없어요</div>
          )}
          {pendingTrips.length > 0 && (
            <>
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1">대기 중 ({pendingTrips.length})</div>
              {pendingTrips.map(t => (
                <div key={t.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${t.status === "cancel_requested" ? "border-[#fed7aa]" : "border-[#e5e5e5]"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{t.user_name || "이름 없음"}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">📍 {t.destination} · {t.start_date}{t.start_date !== t.end_date ? ` ~ ${t.end_date}` : ""}</div>
                      {t.status === "cancel_requested" && (
                        <div className="text-[#c2410c] text-xs mt-1 font-medium">취소 신청이 들어왔어요</div>
                      )}
                    </div>
                    {statusBadge(t.status)}
                  </div>
                  {t.purpose && <div className="text-[#6b6b6b] text-xs bg-[#f8f8f8] rounded-lg px-3 py-2 mb-3">목적: {t.purpose}</div>}
                  {t.status === "cancel_requested" ? (
                    <div className="flex gap-2">
                      <button onClick={() => approveTrip(t.id, "approved")} className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-bold py-2 rounded-xl transition-all">취소 승인</button>
                      <button onClick={() => setRejectModal({ id: t.id, type: "trip" })} className="flex-1 border border-[#e5e5e5] text-[#6b6b6b] text-sm font-bold py-2 rounded-xl hover:bg-[#f8f8f8] transition-all">취소 반려</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => approveTrip(t.id, "approved")} className="flex-1 bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-sm font-bold py-2 rounded-xl transition-all">승인</button>
                      <button onClick={() => setRejectModal({ id: t.id, type: "trip" })} className="flex-1 border border-[#e5e5e5] text-[#ef4444] text-sm font-bold py-2 rounded-xl hover:bg-[#fef2f2] transition-all">반려</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {doneTrips.length > 0 && (
            <>
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1 mt-4">처리 완료</div>
              {doneTrips.map(t => (
                <div key={t.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm opacity-70">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{t.user_name || "이름 없음"}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">📍 {t.destination} · {t.start_date}{t.start_date !== t.end_date ? ` ~ ${t.end_date}` : ""}</div>
                      {t.reject_reason && <div className="text-[#ef4444] text-xs mt-1">반려 사유: {t.reject_reason}</div>}
                    </div>
                    {statusBadge(t.status)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── 근태현황 탭 ── */}
      {tab === "attendance" && (
        <div>
          {/* 오늘 실시간 요약 */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "출근중", count: checkinCount, color: "text-[#16a34a]", bg: "bg-[#f0fdf4]" },
              { label: "퇴근", count: checkoutCount, color: "text-[#5b5ef4]", bg: "bg-[#f5f5ff]" },
              { label: "미출근", count: absentCount, color: "text-[#a0a0a0]", bg: "bg-[#f8f8f8]" },
              { label: "미퇴근", count: missingCount, color: "text-[#f59e0b]", bg: "bg-[#fffbeb]" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                <div className={`text-lg font-black ${s.color}`}>{s.count}</div>
                <div className="text-[#6b6b6b] text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 주간/월간 토글 */}
          <div className="flex gap-2 mb-3 bg-white border border-[#e5e5e5] rounded-xl p-1 shadow-sm">
            {(["weekly", "monthly"] as const).map(t => (
              <button
                key={t}
                onClick={() => handleReportTypeChange(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                  reportType === t ? "bg-[#5b5ef4] text-white" : "text-[#6b6b6b] hover:text-[#0a0a0a]"
                }`}
              >
                {t === "weekly" ? "주간" : "월간"}
              </button>
            ))}
          </div>

          {/* 기간 네비게이션 */}
          <div className="flex items-center justify-between bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 mb-4 shadow-sm">
            <button onClick={handleReportPrev} className="w-8 h-8 flex items-center justify-center text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f0f0f0] rounded-lg transition-all">←</button>
            <span className="text-[#0a0a0a] text-sm font-semibold">
              {reportType === "weekly" ? getWeekLabel(reportWeekStart) : getMonthLabel(reportMonthDate)}
            </span>
            <button
              onClick={handleReportNext}
              disabled={atCurrentPeriod}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                atCurrentPeriod ? "text-[#d0d0d0] cursor-not-allowed" : "text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f0f0f0]"
              }`}
            >→</button>
          </div>

          {/* 팀원별 근무 리포트 */}
          {!companyReport ? (
            <div className="text-center py-8 text-[#a0a0a0] text-sm">기간을 선택하면 리포트가 표시돼요</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1">
                  팀원별 근무 ({companyReport.period})
                </div>
                <button
                  onClick={() => companyId && fetchCompanyReport(companyId, reportType, reportWeekStart, reportMonthDate)}
                  className="text-[#5b5ef4] text-xs hover:text-[#4a4de0] transition-colors"
                >
                  새로고침
                </button>
              </div>
              {companyReport.members.map(m => (
                <div key={m.user_id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{m.user_name || m.user_email}</div>
                      <div className="text-[#a0a0a0] text-xs mt-0.5">{m.user_email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#5b5ef4] font-bold text-sm">{m.total_minutes > 0 ? m.total_work_hours : "-"}</div>
                      <div className="text-[#a0a0a0] text-xs">{m.work_days > 0 ? `${m.work_days}일 출근` : "출근 없음"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 현황 탭 ── */}
      {tab === "status" && (
        <div>
          {PeriodNav}
          <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1 mb-3">
            휴가 · 출장 이력
          </div>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-[#a0a0a0] text-sm">해당 기간에 승인된 휴가·출장 내역이 없어요</div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((h, i) => (
                <div key={i} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{h.name}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">{h.detail}</div>
                    </div>
                    <span className="text-xs font-bold text-[#5b5ef4] bg-[#f5f5ff] border border-[#c7c8fa] px-2 py-0.5 rounded-full whitespace-nowrap">
                      {h.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
