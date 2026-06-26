"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import Toast from "@/components/Toast";
import Confirm from "@/components/Confirm";

const AVAILABLE_SCREENS = [
  { path: "/dashboard", label: "출퇴근 대시보드" },
  { path: "/leave", label: "연차 관리" },
  { path: "/business-trip", label: "출장 관리" },
  { path: "/calendar", label: "근무 달력" },
  { path: "/report", label: "리포트" },
  { path: "/notice", label: "공지사항" },
  { path: "/manager", label: "팀장 페이지" },
];

interface Permission {
  id: string;
  name: string;
  description: string | null;
  allowed_screens: string[];
  created_at: string;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

export default function PermissionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  // 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Permission | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formScreens, setFormScreens] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);

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
      // company_id 없으면 사용자 회사로 자동 조회
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

  const fetchPermissions = useCallback(async (cid: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/permissions/company/${cid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPermissions(data.permissions || []);
    } catch {
      showToast("권한 목록을 불러오지 못했어요", "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (companyId) fetchPermissions(companyId);
  }, [companyId, fetchPermissions]);

  const openCreateForm = () => {
    setEditTarget(null);
    setFormName("");
    setFormDesc("");
    setFormScreens([]);
    setShowForm(true);
  };

  const openEditForm = (p: Permission) => {
    setEditTarget(p);
    setFormName(p.name);
    setFormDesc(p.description || "");
    setFormScreens(p.allowed_screens);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditTarget(null);
  };

  const toggleScreen = (path: string) => {
    setFormScreens((prev) =>
      prev.includes(path) ? prev.filter((s) => s !== path) : [...prev, path]
    );
  };

  const handleSubmit = async () => {
    if (!formName.trim()) { showToast("권한 이름을 입력해주세요", "error"); return; }
    if (!companyId) return;
    setFormLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (editTarget) {
        const res = await fetch(`${API_URL}/api/permissions/${editTarget.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: formName, description: formDesc, allowed_screens: formScreens }),
        });
        const data = await res.json();
        if (data.success) {
          showToast("권한이 수정되었어요", "success");
          closeForm();
          fetchPermissions(companyId);
        } else {
          showToast("수정 실패", "error");
        }
      } else {
        const res = await fetch(`${API_URL}/api/permissions/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ company_id: companyId, name: formName, description: formDesc, allowed_screens: formScreens }),
        });
        const data = await res.json();
        if (data.success) {
          showToast("권한이 생성되었어요", "success");
          closeForm();
          fetchPermissions(companyId);
        } else {
          showToast("생성 실패", "error");
        }
      }
    } catch {
      showToast("요청 실패", "error");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (p: Permission) => {
    showConfirm(`"${p.name}" 권한을 삭제할까요?\n이 권한이 부여된 모든 사용자에게서도 제거돼요.`, async () => {
      setConfirm(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${API_URL}/api/permissions/${p.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          showToast("삭제 완료", "success");
          fetchPermissions(companyId!);
        } else {
          showToast("삭제 실패", "error");
        }
      } catch {
        showToast("삭제 실패", "error");
      }
    });
  };

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              ←
            </div>
          </Link>
          <h1 className="text-[#0a0a0a] text-lg font-black">권한 목록 관리</h1>
        </div>
        <button
          onClick={openCreateForm}
          className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
        >
          + 권한 추가
        </button>
      </div>

      {/* 안내 */}
      <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-2xl p-4 mb-4">
        <div className="text-[#4a4de0] text-xs font-bold mb-1">권한이란?</div>
        <div className="text-[#6b6b6b] text-xs leading-relaxed">
          권한을 만들고 접근 가능한 화면을 지정하세요. 이후 사용자별 권한 설정에서 직원에게 권한을 부여할 수 있어요.
        </div>
      </div>

      {/* 권한 목록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-4">
          권한 목록 ({permissions.length}개)
        </div>

        {permissions.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">🔑</div>
            <div className="text-[#a0a0a0] text-sm">등록된 권한이 없어요</div>
            <div className="text-[#a0a0a0] text-xs mt-1">+ 권한 추가 버튼을 눌러 권한을 만들어보세요</div>
          </div>
        ) : (
          <div className="space-y-3">
            {permissions.map((p) => (
              <div key={p.id} className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-[#0a0a0a] font-black text-sm">{p.name}</div>
                    {p.description && (
                      <div className="text-[#6b6b6b] text-xs mt-0.5">{p.description}</div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(p)}
                      className="text-[#a0a0a0] hover:text-[#5b5ef4] text-xs transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-[#a0a0a0] hover:text-[#ef4444] text-xs transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.allowed_screens.length === 0 ? (
                    <span className="text-[#a0a0a0] text-xs">접근 허용 화면 없음</span>
                  ) : (
                    p.allowed_screens.map((s) => {
                      const screen = AVAILABLE_SCREENS.find((a) => a.path === s);
                      return (
                        <span
                          key={s}
                          className="bg-[#f0f0ff] border border-[#c7c8fa] text-[#4a4de0] text-xs px-2 py-0.5 rounded-lg font-medium"
                        >
                          {screen?.label || s}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 권한 생성/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[#0a0a0a] font-black">
                {editTarget ? "권한 수정" : "권한 추가"}
              </div>
              <button onClick={closeForm} className="text-[#a0a0a0] hover:text-[#0a0a0a] text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1.5">권한 이름 *</div>
                <input
                  type="text"
                  placeholder="예: HR 담당자, 영업팀장"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
              </div>

              <div>
                <div className="text-[#a0a0a0] text-xs mb-1.5">설명 (선택)</div>
                <input
                  type="text"
                  placeholder="권한에 대한 간단한 설명"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
              </div>

              <div>
                <div className="text-[#a0a0a0] text-xs mb-2">접근 허용 화면</div>
                <div className="space-y-2">
                  {AVAILABLE_SCREENS.map((s) => (
                    <label
                      key={s.path}
                      className="flex items-center gap-3 cursor-pointer bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl px-4 py-3 hover:border-[#5b5ef4] transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={formScreens.includes(s.path)}
                        onChange={() => toggleScreen(s.path)}
                        className="w-4 h-4 accent-[#5b5ef4]"
                      />
                      <div>
                        <div className="text-[#0a0a0a] text-sm font-medium">{s.label}</div>
                        <div className="text-[#a0a0a0] text-xs">{s.path}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={formLoading}
                className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                {formLoading ? "저장 중..." : editTarget ? "수정하기" : "생성하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
