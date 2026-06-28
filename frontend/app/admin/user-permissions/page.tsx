"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import Toast from "@/components/Toast";
import Confirm from "@/components/Confirm";

interface PermissionRef {
  id: string;
  name: string;
  description: string | null;
  allowed_screens: string[];
}

interface UserPermissionEntry {
  user_permission_id: string;
  permission_id: string;
  permission_name: string;
  allowed_screens: string[];
}

interface MemberWithPermissions {
  user_id: string;
  user_name: string | null;
  user_email: string;
  is_admin: boolean;
  is_manager: boolean;
  permissions: UserPermissionEntry[];
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

function UserPermissionsPageContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionRef[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [assignModal, setAssignModal] = useState<MemberWithPermissions | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirm({ message, onConfirm });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      setUser(u);

      const cid = searchParams.get("company_id");
      if (cid) {
        setCompanyId(cid);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/company/info/${u.uid}`);
        const data = await res.json();
        if (data.company?.id) {
          setCompanyId(data.company.id);
        } else {
          router.push("/admin");
        }
      } catch {
        router.push("/admin");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, searchParams]);

  const fetchData = useCallback(async (cid: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [membersRes, permsRes] = await Promise.all([
        fetch(`${API_URL}/api/permissions/users/${cid}`, { headers }),
        fetch(`${API_URL}/api/permissions/company/${cid}`, { headers }),
      ]);
      const membersData = await membersRes.json();
      const permsData = await permsRes.json();
      setMembers(membersData.members || []);
      setAllPermissions(permsData.permissions || []);
    } catch {
      showToast("데이터를 불러오지 못했어요", "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (companyId) fetchData(companyId);
  }, [companyId, fetchData]);

  const handleAssign = async (permissionId: string) => {
    if (!assignModal || !companyId) return;
    setAssignLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/permissions/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          company_id: companyId,
          user_id: assignModal.user_id,
          permission_id: permissionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("권한이 부여되었어요", "success");
        setAssignModal(null);
        fetchData(companyId);
      } else {
        showToast(data.detail || "부여 실패", "error");
      }
    } catch {
      showToast("요청 실패", "error");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRevoke = (member: MemberWithPermissions, up: UserPermissionEntry) => {
    showConfirm(
      `${member.user_name || member.user_email}에게서 "${up.permission_name}" 권한을 제거할까요?`,
      async () => {
        setConfirm(null);
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch(`${API_URL}/api/permissions/assign/${up.user_permission_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            showToast("권한이 제거되었어요", "success");
            fetchData(companyId!);
          } else {
            showToast("제거 실패", "error");
          }
        } catch {
          showToast("요청 실패", "error");
        }
      }
    );
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.user_name || "").toLowerCase().includes(q) ||
      m.user_email.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  const backHref = companyId ? `/admin?company_id=${companyId}` : "/admin";

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <Confirm message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref}>
          <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            ←
          </div>
        </Link>
        <h1 className="text-[#0a0a0a] text-lg font-black">사용자별 권한 설정</h1>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="이름 또는 이메일로 검색"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0] mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      />

      {allPermissions.length === 0 && (
        <div className="bg-[#fff8e6] border border-[#fde68a] rounded-2xl p-4 mb-4">
          <div className="text-[#92400e] text-xs font-bold mb-1">권한이 없어요</div>
          <div className="text-[#92400e] text-xs">
            먼저{" "}
            <Link
              href={companyId ? `/admin/permissions?company_id=${companyId}` : "/admin/permissions"}
              className="underline font-bold"
            >
              권한 목록 관리
            </Link>
            에서 권한을 만들어주세요.
          </div>
        </div>
      )}

      {/* 직원 목록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-4">
          직원 목록 ({filteredMembers.length}명)
        </div>

        {filteredMembers.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">👤</div>
            <div className="text-[#a0a0a0] text-sm">직원이 없어요</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((m) => (
              <div key={m.user_id} className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#0a0a0a] font-black text-sm">
                        {m.user_name || m.user_email}
                      </span>
                      {m.is_admin && (
                        <span className="bg-[#f0f0ff] border border-[#c7c8fa] text-[#4a4de0] text-xs px-1.5 py-0.5 rounded-md font-medium">
                          관리자
                        </span>
                      )}
                      {m.is_manager && (
                        <span className="bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-xs px-1.5 py-0.5 rounded-md font-medium">
                          팀장
                        </span>
                      )}
                    </div>
                    {m.user_name && (
                      <div className="text-[#a0a0a0] text-xs mt-0.5">{m.user_email}</div>
                    )}
                  </div>
                  <button
                    onClick={() => setAssignModal(m)}
                    disabled={allPermissions.length === 0}
                    className="bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                  >
                    + 권한 부여
                  </button>
                </div>

                {/* 현재 권한 목록 */}
                {m.permissions.length === 0 ? (
                  <div className="text-[#a0a0a0] text-xs pl-1">부여된 권한 없음</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {m.permissions.map((up) => (
                      <div
                        key={up.user_permission_id}
                        className="flex items-center gap-1 bg-white border border-[#e5e5e5] rounded-lg px-2.5 py-1"
                      >
                        <span className="text-[#0a0a0a] text-xs font-medium">{up.permission_name}</span>
                        <button
                          onClick={() => handleRevoke(m, up)}
                          className="text-[#a0a0a0] hover:text-[#ef4444] text-xs transition-colors ml-0.5"
                          aria-label="권한 제거"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 권한 부여 모달 */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[#0a0a0a] font-black">권한 부여</div>
                <div className="text-[#6b6b6b] text-xs mt-0.5">
                  {assignModal.user_name || assignModal.user_email}
                </div>
              </div>
              <button
                onClick={() => setAssignModal(null)}
                className="text-[#a0a0a0] hover:text-[#0a0a0a] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {allPermissions.map((p) => {
                const alreadyHas = assignModal.permissions.some(
                  (up) => up.permission_id === p.id
                );
                return (
                  <div key={p.id} className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[#0a0a0a] font-bold text-sm">{p.name}</div>
                        {p.description && (
                          <div className="text-[#a0a0a0] text-xs mt-0.5 truncate">{p.description}</div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.allowed_screens.length === 0 ? (
                            <span className="text-[#a0a0a0] text-xs">접근 화면 없음</span>
                          ) : (
                            p.allowed_screens.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="bg-[#f0f0ff] text-[#4a4de0] text-xs px-1.5 py-0.5 rounded"
                              >
                                {s}
                              </span>
                            ))
                          )}
                          {p.allowed_screens.length > 3 && (
                            <span className="text-[#a0a0a0] text-xs">
                              +{p.allowed_screens.length - 3}개
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssign(p.id)}
                        disabled={alreadyHas || assignLoading}
                        className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                          alreadyHas
                            ? "bg-[#f8f8f8] border border-[#e5e5e5] text-[#a0a0a0] cursor-not-allowed"
                            : "bg-[#5b5ef4] hover:bg-[#4a4de0] text-white disabled:opacity-50"
                        }`}
                      >
                        {alreadyHas ? "부여됨" : "부여"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function UserPermissionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="text-[#5b5ef4]">로딩 중...</div></div>}>
      <UserPermissionsPageContent />
    </Suspense>
  );
}
