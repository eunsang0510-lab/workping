"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { API_URL } from "@/lib/api";
import Link from "next/link";

type Tab = "leave" | "trip" | "status";

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

interface BalanceItem {
  user_id: string;
  user_name: string;
  user_email: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function ManagerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("leave");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [balanceYear, setBalanceYear] = useState<number>(new Date().getFullYear());

  const [rejectModal, setRejectModal] = useState<{ id: string; type: "leave" | "trip" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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

  const fetchBalances = useCallback(async (cid: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/leave/balance/company/${cid}`, { headers });
      const data = await res.json();
      setBalances(data.balances || []);
      if (data.year) setBalanceYear(data.year);
    } catch {
      showToast("현황 로딩 실패", "error");
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.uid);
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
        fetchBalances(data.company_id);
      } catch {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router, fetchLeaves, fetchTrips, fetchBalances]);

  const approveLeave = async (leaveId: string, status: "approved" | "rejected", reason = "") => {
    if (!companyId) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/leave/approve/${leaveId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(status === "approved" ? "연차 승인 완료" : "연차 반려 완료", "success");
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
        showToast(status === "approved" ? "출장 승인 완료" : "출장 반려 완료", "success");
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
    return <span className="text-xs font-bold text-[#f59e0b] bg-[#fffbeb] border border-[#fde68a] px-2 py-0.5 rounded-full">대기</span>;
  };

  const pendingLeaves = leaves.filter(l => l.status === "pending");
  const doneLeaves = leaves.filter(l => l.status !== "pending");
  const pendingTrips = trips.filter(t => t.status === "pending");
  const doneTrips = trips.filter(t => t.status !== "pending");

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

      {/* 반려 사유 모달 (출장만) */}
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
          <p className="text-[#6b6b6b] text-xs">팀원 연차·출장 승인 및 현황</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex bg-white border border-[#e5e5e5] rounded-2xl p-1 mb-5 shadow-sm">
        {([
          { key: "leave", label: "연차 승인", badge: pendingLeaves.length },
          { key: "trip", label: "출장 승인", badge: pendingTrips.length },
          { key: "status", label: "현황", badge: 0 },
        ] as { key: Tab; label: string; badge: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${tab === t.key ? "bg-[#5b5ef4] text-white shadow-sm" : "text-[#6b6b6b] hover:text-[#0a0a0a]"}`}
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
          {pendingLeaves.length === 0 && doneLeaves.length === 0 && (
            <div className="text-center py-12 text-[#a0a0a0] text-sm">연차 신청 내역이 없어요</div>
          )}

          {pendingLeaves.length > 0 && (
            <>
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1">대기 중 ({pendingLeaves.length})</div>
              {pendingLeaves.map(l => (
                <div key={l.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{l.user_name || "이름 없음"}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        {l.is_half ? "반차" : `연차 ${l.days}일`} · {l.start_date}{l.start_date !== l.end_date ? ` ~ ${l.end_date}` : ""}
                      </div>
                    </div>
                    {statusBadge(l.status)}
                  </div>
                  {l.reason && <div className="text-[#6b6b6b] text-xs bg-[#f8f8f8] rounded-lg px-3 py-2 mb-3">사유: {l.reason}</div>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveLeave(l.id, "approved")}
                      className="flex-1 bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-sm font-bold py-2 rounded-xl transition-all"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => setRejectModal({ id: l.id, type: "leave" })}
                      className="flex-1 border border-[#e5e5e5] text-[#ef4444] text-sm font-bold py-2 rounded-xl hover:bg-[#fef2f2] transition-all"
                    >
                      반려
                    </button>
                  </div>
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
          {pendingTrips.length === 0 && doneTrips.length === 0 && (
            <div className="text-center py-12 text-[#a0a0a0] text-sm">출장 신청 내역이 없어요</div>
          )}

          {pendingTrips.length > 0 && (
            <>
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1">대기 중 ({pendingTrips.length})</div>
              {pendingTrips.map(t => (
                <div key={t.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">{t.user_name || "이름 없음"}</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        📍 {t.destination} · {t.start_date}{t.start_date !== t.end_date ? ` ~ ${t.end_date}` : ""}
                      </div>
                    </div>
                    {statusBadge(t.status)}
                  </div>
                  {t.purpose && <div className="text-[#6b6b6b] text-xs bg-[#f8f8f8] rounded-lg px-3 py-2 mb-3">목적: {t.purpose}</div>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveTrip(t.id, "approved")}
                      className="flex-1 bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-sm font-bold py-2 rounded-xl transition-all"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => setRejectModal({ id: t.id, type: "trip" })}
                      className="flex-1 border border-[#e5e5e5] text-[#ef4444] text-sm font-bold py-2 rounded-xl hover:bg-[#fef2f2] transition-all"
                    >
                      반려
                    </button>
                  </div>
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

      {/* ── 현황 탭 ── */}
      {tab === "status" && (
        <div>
          <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider px-1 mb-3">{balanceYear}년 연차 현황</div>
          {balances.length === 0 ? (
            <div className="text-center py-12 text-[#a0a0a0] text-sm">팀원 데이터가 없어요</div>
          ) : (
            <div className="space-y-2">
              {balances.map(b => {
                const usedPct = b.total_days > 0 ? Math.min(100, (b.used_days / b.total_days) * 100) : 0;
                return (
                  <div key={b.user_id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[#0a0a0a] text-sm font-bold">{b.user_name}</div>
                        <div className="text-[#a0a0a0] text-xs">{b.user_email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#0a0a0a] text-sm font-black">{b.remaining_days}일</div>
                        <div className="text-[#a0a0a0] text-xs">잔여</div>
                      </div>
                    </div>
                    <div className="w-full bg-[#f0f0f0] rounded-full h-1.5 mb-1">
                      <div
                        className="bg-[#5b5ef4] h-1.5 rounded-full transition-all"
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-[#a0a0a0]">
                      <span>사용 {b.used_days}일</span>
                      <span>총 {b.total_days}일</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
