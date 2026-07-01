"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import { API_URL } from "@/lib/api";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

interface Trip {
  id: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
}

interface ToastState { message: string; type: "success" | "error" | "info"; }

export default function BusinessTripPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setUserName(u.displayName || "");
        fetchCompany(u.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  const fetchCompany = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/my/${uid}`);
      const data = await res.json();
      if (data.company_id) {
        setCompanyId(data.company_id);
        fetchTrips(uid);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTrips = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/business-trip/my/${uid}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setTrips(data.trips || []);
    } catch { /* ignore */ }
  };

  const handleApply = async () => {
    if (!destination.trim()) { showToast("출장지를 입력해주세요", "error"); return; }
    if (!startDate) { showToast("출발일을 선택해주세요", "error"); return; }
    if (!endDate) { showToast("복귀일을 선택해주세요", "error"); return; }
    if (startDate > endDate) { showToast("복귀일이 출발일보다 빠를 수 없어요", "error"); return; }
    if (!companyId) { showToast("소속 회사가 없어요", "error"); return; }

    setApplying(true);
    try {
      const res = await fetch(`${API_URL}/api/business-trip/apply`, {
        method: "POST",
        headers: await getAuthHeader(),
        body: JSON.stringify({
          company_id: companyId,
          user_id: user?.uid,
          user_name: userName,
          destination: destination.trim(),
          purpose: purpose.trim(),
          start_date: startDate,
          end_date: endDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("출장 신청 완료!", "success");
        setShowForm(false);
        setDestination(""); setPurpose(""); setStartDate(""); setEndDate("");
        fetchTrips(user!.uid);
      } else {
        showToast(data.detail || "신청 실패", "error");
      }
    } catch {
      showToast("신청 실패", "error");
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = async (tripId: string) => {
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/business-trip/cancel/${tripId}`, {
        method: "POST",
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      if (data.success) {
        if (data.action === "cancel_requested") {
          showToast("취소 신청 완료! 관리자 승인 후 취소됩니다", "info");
        } else {
          showToast("출장 신청이 취소됐어요", "success");
        }
        fetchTrips(user!.uid);
      } else {
        showToast(data.detail || "취소 실패", "error");
      }
    } catch {
      showToast("취소 처리 실패", "error");
    } finally {
      setCancelLoading(false);
      setCancelConfirm(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "pending")          return { text: "대기중",    bg: "bg-[#fef9c3]", color: "text-[#854d0e]", border: "border-[#fde047]" };
    if (status === "approved")         return { text: "승인",      bg: "bg-[#f0fdf4]", color: "text-[#16a34a]", border: "border-[#bbf7d0]" };
    if (status === "cancel_requested") return { text: "취소신청중", bg: "bg-[#fff7ed]", color: "text-[#c2410c]", border: "border-[#fed7aa]" };
    if (status === "cancelled")        return { text: "취소됨",    bg: "bg-[#f3f4f6]", color: "text-[#9ca3af]", border: "border-[#e5e7eb]" };
    return                                    { text: "반려",      bg: "bg-[#fef2f2]", color: "text-[#ef4444]", border: "border-[#fecaca]" };
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  const nights = (s: string, e: string) => {
    const diff = (new Date(e).getTime() - new Date(s).getTime()) / 86400000;
    return diff === 0 ? "당일" : `${diff}박 ${diff + 1}일`;
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-[#5b5ef4]">로딩 중...</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <button className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            ←
          </button>
        </Link>
        <h1 className="text-[#0a0a0a] text-xl font-black tracking-tight">출장신청</h1>
      </div>

      {/* 신청 버튼 */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-white border border-dashed border-[#5b5ef4] hover:bg-[#f0f0ff] text-[#5b5ef4] font-bold py-3 rounded-xl transition-all text-sm mb-4"
      >
        {showForm ? "✕ 취소" : "+ 출장 신청"}
      </button>

      {/* 신청 폼 */}
      {showForm && (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-4">출장 신청</div>
          <div className="space-y-3">
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">출장지 *</div>
              <input
                type="text"
                placeholder="예) 부산 본사, 도쿄 파트너사"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
              />
            </div>
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">출발일 *</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm"
              />
            </div>
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">복귀일 *</div>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm"
              />
            </div>
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">출장 목적 (선택)</div>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="출장 목적을 입력해주세요"
                rows={3}
                className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0] resize-none"
              />
            </div>
            <button
              onClick={handleApply}
              disabled={applying}
              className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm"
            >
              {applying ? "신청 중..." : "신청하기"}
            </button>
          </div>
        </div>
      )}

      {/* 신청 내역 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-4">신청 내역</div>
        {trips.length === 0 ? (
          <div className="text-[#a0a0a0] text-sm text-center py-8">출장 신청 내역이 없어요</div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => {
              const s = statusBadge(trip.status);
              return (
                <div key={trip.id} className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{trip.destination}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        {fmtDate(trip.start_date)} ~ {fmtDate(trip.end_date)}
                        <span className="ml-1 text-[#a0a0a0]">({nights(trip.start_date, trip.end_date)})</span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${s.bg} ${s.color} ${s.border}`}>
                      {s.text}
                    </span>
                  </div>
                  {trip.purpose && (
                    <div className="text-[#a0a0a0] text-xs mb-2">{trip.purpose}</div>
                  )}
                  {trip.status === "rejected" && trip.reject_reason && (
                    <div className="text-[#ef4444] text-xs bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 mb-2">
                      반려 사유: {trip.reject_reason}
                    </div>
                  )}
                  {(trip.status === "pending" || trip.status === "approved") && (
                    cancelConfirm === trip.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-[#6b6b6b] flex-1">
                          {trip.status === "pending" ? "신청을 취소할까요?" : "취소를 신청할까요?"}
                        </span>
                        <button
                          onClick={() => handleCancel(trip.id)}
                          disabled={cancelLoading}
                          className="text-xs text-white bg-[#ef4444] px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                        >
                          {cancelLoading ? "처리중" : "예"}
                        </button>
                        <button
                          onClick={() => setCancelConfirm(null)}
                          className="text-xs text-[#6b6b6b] border border-[#e5e5e5] bg-white px-3 py-1.5 rounded-lg"
                        >
                          아니오
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCancelConfirm(trip.id)}
                        className={`mt-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          trip.status === "pending"
                            ? "text-[#ef4444] border-[#fecaca] hover:bg-[#fef2f2]"
                            : "text-[#f59e0b] border-[#fde68a] hover:bg-[#fffbeb]"
                        }`}
                      >
                        {trip.status === "pending" ? "신청취소" : "취소신청"}
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
