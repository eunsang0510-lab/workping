"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import { API_URL } from "@/lib/api";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

interface MeetingListItem {
  id: string;
  title: string;
  recorded_at: string;
  user_name: string | null;
  status: string;
  duration_seconds: number | null;
  todo_count: number;
  todo_done_count: number;
  edited: boolean;
}

interface ToastState { message: string; type: "success" | "error" | "info"; }
interface Quota { used: number; limit: number; remaining: number; message: string; }

function formatDuration(sec: number | null) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초`;
}

export default function MeetingListPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        fetchCompanyThenMeetings(u.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // 회의록 메뉴 진입 시 마이크 권한을 미리 요청 (녹음 화면에서 처음 물어보면 당황스러우니 미리 안내)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => stream.getTracks().forEach((t) => t.stop()))
      .catch(() => {
        showToast("마이크 권한이 없으면 녹음을 시작할 수 없어요. 브라우저 설정에서 마이크 권한을 허용해주세요", "info");
      });
  }, [showToast]);

  const fetchCompanyThenMeetings = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/my/${uid}`);
      const data = await res.json();
      const cid = data.company_id || null;
      setCompanyId(cid);
      await Promise.all([fetchMeetings(uid, cid), fetchQuota(uid)]);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuota = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/meeting/quota/${uid}`, { headers: await getAuthHeader() });
      const data = await res.json();
      setQuota(data);
    } catch {
      /* 조용히 무시 - 남은 횟수 표시만 안 됨 */
    }
  };

  // 회사 소속이면 회사 공유 회의록을, 없으면(개인 모드) 본인 회의록만 조회
  const fetchMeetings = async (uid: string, cid: string | null) => {
    try {
      const url = cid ? `${API_URL}/api/meeting/company/${cid}` : `${API_URL}/api/meeting/my/${uid}`;
      const res = await fetch(url, { headers: await getAuthHeader() });
      const data = await res.json();
      setMeetings(data.meetings || []);
    } catch {
      showToast("회의록 목록을 불러오지 못했어요", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/dashboard" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex items-center gap-1.5">
            <span className="text-[#0a0a0a] text-base font-bold">AI 회의록</span>
            <span className="text-[10px] font-bold text-[#4a4de0] bg-[#f0f0ff] rounded-full px-1.5 py-0.5">BETA</span>
          </div>
          <div className="w-8" />
        </div>

        {!companyId && (
          <div className="text-[11px] text-[#6b6b6b] bg-[#f8f8f8] rounded-lg px-3 py-2 mb-4">
            개인 모드로 사용 중이에요. 소속 회사가 없어 이 회의록은 본인에게만 보여요.
          </div>
        )}

        {companyId && (
          <Link href="/meeting/progress">
            <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl px-4 py-3 flex items-center gap-2.5 mb-4 transition-all cursor-pointer">
              <span className="text-lg">📊</span>
              <div className="text-[#0a0a0a] text-xs font-bold flex-1">팀 업무 진행 현황 보기</div>
              <span className="text-[#b0b0b0] text-xs">›</span>
            </div>
          </Link>
        )}

        {quota && quota.remaining <= 0 ? (
          <div className="bg-[#f8f8f8] rounded-2xl p-5 mb-5 text-center">
            <div className="text-2xl mb-2">🔒</div>
            <div className="text-[#6b6b6b] text-xs leading-relaxed">{quota.message}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-5">
            <Link href="/meeting/record">
              <div className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white rounded-2xl p-5 flex items-center gap-3 shadow-[0_8px_24px_rgba(91,94,244,0.25)] transition-all cursor-pointer">
                <span className="text-2xl">🎙️</span>
                <div>
                  <div className="text-sm font-bold">새 회의 녹음하기</div>
                  <div className="text-xs text-white/80">
                    녹음 후 AI가 자동으로 요약해요{quota ? ` · 이번 달 ${quota.used}/${quota.limit}회 사용` : ""}
                  </div>
                </div>
              </div>
            </Link>
            <Link href="/meeting/write">
              <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl px-4 py-3 flex items-center gap-2.5 transition-all cursor-pointer">
                <span className="text-lg">✍️</span>
                <div className="text-[#0a0a0a] text-xs font-bold flex-1">직접 타이핑해서 작성하기</div>
                <span className="text-[#b0b0b0] text-xs">›</span>
              </div>
            </Link>
          </div>
        )}

        {meetings.length === 0 ? (
          <div className="text-center text-[#6b6b6b] text-sm py-12">아직 회의록이 없어요</div>
        ) : (
          <div className="flex flex-col gap-3">
            {meetings.map((m) => (
              <Link key={m.id} href={`/meeting/${m.id}`}>
                <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[#0a0a0a] text-sm font-bold">{m.title}</div>
                    {m.status === "failed" && (
                      <span className="text-[10px] font-semibold text-[#ef4444] bg-[#fef2f2] rounded-full px-2 py-0.5 shrink-0">실패</span>
                    )}
                    {m.status === "processing" && (
                      <span className="text-[10px] font-semibold text-[#d97706] bg-[#fffbeb] rounded-full px-2 py-0.5 shrink-0">처리중</span>
                    )}
                  </div>
                  <div className="text-[#6b6b6b] text-xs mt-1">
                    {new Date(m.recorded_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {m.user_name ? ` · ${m.user_name}` : ""}
                    {m.duration_seconds ? ` · ${formatDuration(m.duration_seconds)}` : ""}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {m.todo_count > 0 && (
                      <span className="text-[11px] text-[#4a4de0] bg-[#f0f0ff] rounded-full px-2 py-0.5">
                        할일 {m.todo_done_count}/{m.todo_count}
                      </span>
                    )}
                    {m.edited && (
                      <span className="text-[11px] text-[#6b6b6b] bg-[#f8f8f8] rounded-full px-2 py-0.5">수정됨</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
