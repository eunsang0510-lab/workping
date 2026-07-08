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
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
};

interface Leave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  is_half: boolean;
  reason: string;
  status: string;
  created_at: string;
}

interface Balance {
  total_days: number;
  used_days: number;
  remaining_days: number;
  year: number;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export default function LeavePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalf, setIsHalf] = useState(false);
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const router = useRouter();

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setUserName(user.displayName || "");
        fetchMyCompany(user.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchMyCompany = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/my/${userId}`);
      const data = await res.json();
      if (data.company_id) {
        setCompanyId(data.company_id);
        fetchBalance(userId);
        fetchLeaves(userId);
      }
    } catch (error) {
      console.error("회사 정보 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/leave/balance/${userId}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setBalance(data.balance);
    } catch (error) {
      console.error("연차 잔여 로딩 실패:", error);
    }
  };

  const fetchLeaves = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/leave/my/${userId}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setLeaves(data.leaves || []);
    } catch (error) {
      console.error("연차 내역 로딩 실패:", error);
    }
  };

  const handleApply = async () => {
    if (!startDate) {
      showToast("시작일을 선택해주세요", "error");
      return;
    }
    if (!isHalf && !endDate) {
      showToast("종료일을 선택해주세요", "error");
      return;
    }
    if (!companyId) {
      showToast("소속 회사가 없어요", "error");
      return;
    }

    // 기존 연차와 날짜 중복 체크
    const applyEnd = isHalf ? startDate : endDate;
    const conflict = leaves.find((leave) => {
      if (leave.status === "rejected") return false;
      const ls = leave.start_date.slice(0, 10);
      const le = leave.end_date.slice(0, 10);
      return startDate <= le && applyEnd >= ls;
    });
    if (conflict) {
      const typeLabel = conflict.is_half ? "반차" : "연차";
      const statusLabel = conflict.status === "approved" ? "승인된" : "신청 중인";
      const dateLabel =
        conflict.start_date.slice(0, 10) === conflict.end_date.slice(0, 10)
          ? formatDate(conflict.start_date)
          : `${formatDate(conflict.start_date)} ~ ${formatDate(conflict.end_date)}`;
      showToast(`${dateLabel}에 이미 ${statusLabel} ${typeLabel}가 있어요`, "error");
      return;
    }

    setApplying(true);
    try {
      const res = await fetch(`${API_URL}/api/leave/apply`, {
        method: "POST",
        headers: await getAuthHeader(),
        body: JSON.stringify({
          company_id: companyId,
          user_id: user?.uid,
          user_name: userName,
          start_date: startDate,
          end_date: isHalf ? startDate : endDate,
          is_half: isHalf,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("연차 신청 완료!", "success");
        setShowForm(false);
        setStartDate("");
        setEndDate("");
        setIsHalf(false);
        setReason("");
        fetchBalance(user!.uid);
        fetchLeaves(user!.uid);
      } else {
        showToast(data.detail || "신청 실패", "error");
      }
    } catch (error) {
      showToast("신청 실패", "error");
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = async (leaveId: string) => {
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leave/cancel/${leaveId}`, {
        method: "POST",
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      if (data.success) {
        if (data.action === "cancel_requested") {
          showToast("취소 신청 완료! 관리자 승인 후 취소됩니다", "info");
        } else {
          showToast("연차 신청이 취소됐어요", "success");
        }
        fetchBalance(user!.uid);
        fetchLeaves(user!.uid);
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

  const statusLabel = (status: string) => {
    if (status === "pending") return { text: "대기중", bg: "bg-[#fef9c3]", color: "text-[#854d0e]", border: "border-[#fde047]" };
    if (status === "approved") return { text: "승인", bg: "bg-[#f0fdf4]", color: "text-[#16a34a]", border: "border-[#bbf7d0]" };
    if (status === "cancel_requested") return { text: "취소신청중", bg: "bg-[#fff7ed]", color: "text-[#c2410c]", border: "border-[#fed7aa]" };
    if (status === "cancelled") return { text: "취소됨", bg: "bg-[#f3f4f6]", color: "text-[#9ca3af]", border: "border-[#e5e7eb]" };
    return { text: "반려", bg: "bg-[#fef2f2]", color: "text-[#ef4444]", border: "border-[#fecaca]" };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <button className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            ←
          </button>
        </Link>
        <h1 className="text-[#0a0a0a] text-xl font-black tracking-tight">연차관리</h1>
      </div>

      {/* 연차 잔여 카드 */}
      {balance ? (
        <div className="bg-[#5b5ef4] rounded-2xl p-5 mb-4 shadow-[0_4px_16px_rgba(91,94,244,0.3)]">
          <div className="text-white/70 text-xs mb-1">{balance.year}년 연차 현황</div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-white text-5xl font-black">{balance.remaining_days}</span>
            <span className="text-white/70 text-lg mb-1">일 남음</span>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-white/60 text-xs">총 부여</div>
              <div className="text-white font-bold">{balance.total_days}일</div>
            </div>
            <div>
              <div className="text-white/60 text-xs">사용</div>
              <div className="text-white font-bold">{balance.used_days}일</div>
            </div>
            <div>
              <div className="text-white/60 text-xs">잔여</div>
              <div className="text-white font-bold">{balance.remaining_days}일</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#5b5ef4] rounded-2xl p-5 mb-4 shadow-[0_4px_16px_rgba(91,94,244,0.3)]">
          <div className="text-white/70 text-xs mb-1">연차 현황</div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-white text-5xl font-black">∞</span>
            <span className="text-white/70 text-lg mb-1">제한 없음</span>
          </div>
          <div className="text-white/70 text-xs">연차 일수 제한 없이 자유롭게 신청할 수 있어요</div>
        </div>
      )}

      {/* 연차 신청 버튼 */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-white border border-dashed border-[#5b5ef4] hover:bg-[#f0f0ff] text-[#5b5ef4] font-bold py-3 rounded-xl transition-all text-sm mb-4"
      >
        {showForm ? "✕ 취소" : "+ 연차 신청"}
      </button>

      {/* 신청 폼 */}
      {showForm && (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-4">연차 신청</div>
          <div className="space-y-3">
            {/* 반차 토글 */}
            <label className="flex items-center justify-between bg-[#f8f8f8] rounded-xl px-4 py-3 cursor-pointer">
              <span className="text-[#0a0a0a] text-sm font-medium">반차 신청</span>
              <div
                onClick={() => setIsHalf(!isHalf)}
                className={`w-12 h-6 rounded-full transition-all relative ${isHalf ? "bg-[#5b5ef4]" : "bg-[#e5e5e5]"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isHalf ? "left-7" : "left-1"}`} />
              </div>
            </label>

            {/* 시작일 */}
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">{isHalf ? "날짜" : "시작일"}</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm"
              />
            </div>

            {/* 종료일 (반차 아닐 때만) */}
            {!isHalf && (
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">종료일</div>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm"
                />
              </div>
            )}

            {/* 사유 */}
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">사유 (선택)</div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="연차 사유를 입력해주세요"
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
        {leaves.filter(l => l.status !== "cancelled").length === 0 ? (
          <div className="text-[#a0a0a0] text-sm text-center py-8">신청 내역이 없어요</div>
        ) : (
          <div className="space-y-3">
            {leaves.filter(l => l.status !== "cancelled").map((leave) => {
              const s = statusLabel(leave.status);
              return (
                <div key={leave.id} className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">
                        {leave.is_half ? "반차" : `연차 ${leave.days}일`}
                      </div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">
                        {formatDate(leave.start_date)}
                        {!leave.is_half && leave.start_date !== leave.end_date && ` ~ ${formatDate(leave.end_date)}`}
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${s.bg} ${s.color} ${s.border}`}>
                      {s.text}
                    </span>
                  </div>
                  {leave.reason && (
                    <div className="text-[#a0a0a0] text-xs mb-2">{leave.reason}</div>
                  )}
                  {/* 신청취소 / 취소신청 버튼 */}
                  {(leave.status === "pending" || leave.status === "approved") && (
                    cancelConfirm === leave.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-[#6b6b6b] flex-1">
                          {leave.status === "pending" ? "신청을 취소할까요?" : "취소를 신청할까요?"}
                        </span>
                        <button
                          onClick={() => handleCancel(leave.id)}
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
                        onClick={() => setCancelConfirm(leave.id)}
                        className={`mt-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          leave.status === "pending"
                            ? "text-[#ef4444] border-[#fecaca] hover:bg-[#fef2f2]"
                            : "text-[#f59e0b] border-[#fde68a] hover:bg-[#fffbeb]"
                        }`}
                      >
                        {leave.status === "pending" ? "신청취소" : "취소신청"}
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