"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import { API_URL } from "@/lib/api";

interface ToastState { message: string; type: "success" | "error" | "info"; }
interface Quota { used: number; limit: number; remaining: number; message: string; }

const MAX_CONTENT_CHARS = 20000;

export default function MeetingWritePage() {
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const router = useRouter();

  const showToast = (message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setUserName(u.displayName || "");
        fetch(`${API_URL}/api/company/my/${u.uid}`)
          .then((r) => r.json())
          .then((d) => setCompanyId(d.company_id || null));

        u.getIdToken().then((token) => {
          fetch(`${API_URL}/api/meeting/quota/${u.uid}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((d) => setQuota(d))
            .finally(() => setQuotaLoading(false));
        });
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  const submit = async () => {
    if (!user) return;
    const trimmed = content.trim();
    if (!trimmed) {
      showToast("회의 내용을 입력해주세요", "error");
      return;
    }
    setSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/meeting/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          company_id: companyId || "",
          user_id: user.uid,
          user_name: userName,
          title: title.trim(),
          recorded_at: new Date().toISOString(),
          content: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "등록에 실패했어요");
      showToast("회의록을 준비하고 있어요. 완료되면 알려드릴게요!", "success");
      router.push(`/meeting/${data.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "등록에 실패했어요", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!quotaLoading && quota && quota.remaining <= 0) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="max-w-lg mx-auto">
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="text-3xl">🔒</div>
            <div className="text-[#0a0a0a] text-sm font-medium max-w-xs">{quota.message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="text-[#0a0a0a] text-base font-bold">회의록 수기 작성</div>
          <div className="w-8" />
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="회의 제목 (선택)"
          className="w-full border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm text-[#0a0a0a] outline-none focus:border-[#5b5ef4] mb-3"
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT_CHARS))}
          placeholder="회의에서 논의된 내용, 결정사항, 할 일 등을 자유롭게 적어주세요. AI가 요약과 할 일 목록을 정리해드려요."
          rows={14}
          className="w-full border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm text-[#0a0a0a] outline-none focus:border-[#5b5ef4] resize-none"
        />
        <div className="text-[#b0b0b0] text-[11px] text-right mt-1">
          {content.length.toLocaleString()} / {MAX_CONTENT_CHARS.toLocaleString()}자
        </div>

        {quota && (
          <div className="text-[#b0b0b0] text-[11px] mt-2 text-center">
            베타 기간 이번 달 {quota.used}/{quota.limit}회 사용
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !content.trim()}
          className="w-full mt-4 py-3.5 rounded-xl bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white text-sm font-bold transition-all"
        >
          {submitting ? "등록하는 중..." : "AI 요약 받기"}
        </button>
      </div>
    </div>
  );
}
