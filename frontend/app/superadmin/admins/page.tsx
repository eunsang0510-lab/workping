"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import Confirm from "@/components/Confirm";
import { API_URL } from "@/lib/api";
import { checkSystemAdmin } from "@/lib/systemAdmin";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

interface AdminRow {
  id: string;
  email: string;
  created_at: string;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export default function SystemAdminsPage() {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u || !(await checkSystemAdmin(u.email))) {
        router.push("/login");
        return;
      }
      await fetchAdmins();
      setLoading(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${API_URL}/api/superadmin/admins`, { headers: await getAuthHeader() });
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch {
      showToast("목록을 불러오지 못했어요", "error");
    }
  };

  const addAdmin = async () => {
    const email = newEmail.trim();
    if (!email) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/admins`, {
        method: "POST",
        headers: await getAuthHeader(),
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "추가에 실패했어요");
      showToast("시스템 관리자를 추가했어요", "success");
      setNewEmail("");
      await fetchAdmins();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "추가에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeAdmin = (admin: AdminRow) => {
    setConfirm({
      message: `${admin.email}을(를) 시스템 관리자에서 제외할까요?`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(true);
        try {
          const res = await fetch(`${API_URL}/api/superadmin/admins/${admin.id}`, {
            method: "DELETE",
            headers: await getAuthHeader(),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "삭제에 실패했어요");
          showToast("삭제했어요", "success");
          await fetchAdmins();
        } catch (e) {
          showToast(e instanceof Error ? e.message : "삭제에 실패했어요", "error");
        } finally {
          setBusy(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f8f8] p-5 flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <Confirm message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/superadmin">
          <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            ←
          </div>
        </Link>
        <h1 className="text-[#0a0a0a] text-lg font-black">시스템 관리자 계정</h1>
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[#0a0a0a] text-sm font-bold mb-2">관리자 추가</div>
        <div className="flex gap-2">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="이메일 주소"
            className="flex-1 border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#5b5ef4]"
          />
          <button
            onClick={addAdmin}
            disabled={busy || !newEmail.trim()}
            className="px-5 py-2 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white text-sm font-bold"
          >
            추가
          </button>
        </div>
        <div className="text-[#a0a0a0] text-xs mt-2">
          추가된 이메일 계정은 시스템 관리자 권한(모든 회사 데이터 접근, 평가 기능 등)을 갖게 돼요.
        </div>
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {admins.length === 0 ? (
          <div className="text-center text-[#a0a0a0] text-sm py-10">시스템 관리자가 없어요</div>
        ) : (
          admins.map((a, idx) => (
            <div
              key={a.id}
              className={`flex items-center justify-between px-5 py-4 ${idx > 0 ? "border-t border-[#f0f0f0]" : ""}`}
            >
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">{a.email}</div>
                <div className="text-[#a0a0a0] text-xs mt-0.5">
                  {new Date(a.created_at).toLocaleDateString("ko-KR")} 추가됨
                </div>
              </div>
              <button
                onClick={() => removeAdmin(a)}
                disabled={busy}
                className="text-[#ef4444] text-xs font-bold disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
