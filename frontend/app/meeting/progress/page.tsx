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

interface TeamOption {
  id: string;
  name: string;
}

interface ProgressItem {
  topic: string;
  status: string;
  description: string;
}

interface ProgressData {
  generated: boolean;
  overview?: string;
  items?: ProgressItem[];
  based_on_meeting_count?: number;
  generated_at?: string;
  generated_by_name?: string;
  stale?: boolean;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

const STATUS_STYLE: Record<string, string> = {
  진행중: "text-[#4a4de0] bg-[#f0f0ff]",
  완료: "text-[#16a34a] bg-[#f0fdf4]",
  보류: "text-[#d97706] bg-[#fffbeb]",
};

export default function MeetingProgressPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        init(u.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const init = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/my/${uid}`);
      const data = await res.json();
      const cid = data.company_id || null;
      setCompanyId(cid);
      if (!cid) return;

      const headers = await getAuthHeader();
      const [teamsRes, myTeamRes] = await Promise.all([
        fetch(`${API_URL}/api/team/company/${cid}`, { headers }),
        fetch(`${API_URL}/api/team/my/${uid}`, { headers }),
      ]);
      const teamsData = await teamsRes.json();
      const myTeamData = await myTeamRes.json();
      setTeams((teamsData.teams || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      setSelectedTeamId(myTeamData.member_teams?.[0]?.id || myTeamData.managed_teams?.[0]?.id || null);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = useCallback(
    async (cid: string, teamId: string | null) => {
      setProgressLoading(true);
      try {
        const url = `${API_URL}/api/meeting/progress/${cid}${teamId ? `?team_id=${teamId}` : ""}`;
        const res = await fetch(url, { headers: await getAuthHeader() });
        const data = await res.json();
        setProgress(data);
      } catch {
        showToast("진행 현황을 불러오지 못했어요", "error");
      } finally {
        setProgressLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (companyId) fetchProgress(companyId, selectedTeamId);
  }, [companyId, selectedTeamId, fetchProgress]);

  const regenerate = async () => {
    if (!companyId) return;
    setRegenerating(true);
    try {
      const url = `${API_URL}/api/meeting/progress/${companyId}${selectedTeamId ? `?team_id=${selectedTeamId}` : ""}`;
      const res = await fetch(url, { method: "POST", headers: await getAuthHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "정리에 실패했어요");
      setProgress(data);
      showToast("진행 현황을 새로 정리했어요", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "정리에 실패했어요", "error");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#6b6b6b] text-sm">불러오는 중...</div>;
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[#6b6b6b] text-sm">
            소속 회사가 있어야 팀 업무 진행 현황을 볼 수 있어요
          </div>
        </div>
      </div>
    );
  }

  let content: React.ReactNode;
  if (progressLoading) {
    content = <div className="text-center text-[#6b6b6b] text-sm py-16">불러오는 중...</div>;
  } else if (!progress || !progress.generated) {
    content = (
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 text-center">
        <div className="text-2xl mb-3">📊</div>
        <div className="text-[#6b6b6b] text-xs leading-relaxed mb-4">
          {progress?.stale
            ? "아직 이 범위의 진행 현황을 정리한 적이 없어요. AI가 회의록들을 읽고 정리해드릴게요."
            : "정리할 회의록이 아직 없어요"}
        </div>
        {progress?.stale && (
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="px-5 py-2.5 rounded-xl bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white text-sm font-bold"
          >
            {regenerating ? "정리하는 중..." : "AI로 정리하기"}
          </button>
        )}
      </div>
    );
  } else {
    const items = progress.items || [];
    content = (
      <div className="flex flex-col gap-4">
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="text-[#0a0a0a] text-xs font-black shrink-0">📝 전체 개요</div>
            {progress.generated_at && (
              <div className="text-[#b0b0b0] text-[10px] text-right">
                {new Date(progress.generated_at).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                기준 · 회의 {progress.based_on_meeting_count}건
              </div>
            )}
          </div>
          <div className="text-[#0a0a0a] text-xs leading-relaxed">{progress.overview}</div>
        </div>

        {progress.stale && (
          <div className="text-[11px] text-[#d97706] bg-[#fffbeb] rounded-lg px-3 py-2">
            새로운 회의록이 있어요. 최신 내용을 반영하려면 다시 정리해주세요.
          </div>
        )}

        <button
          onClick={regenerate}
          disabled={regenerating}
          className="w-full py-2.5 rounded-xl border border-[#5b5ef4] text-[#5b5ef4] text-xs font-bold disabled:opacity-50"
        >
          {regenerating ? "정리하는 중..." : "🔄 다시 정리하기"}
        </button>

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-center text-[#6b6b6b] text-sm py-8">추적할 만한 안건이 없어요</div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="bg-white border border-[#e5e5e5] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="text-[#0a0a0a] text-sm font-bold">{item.topic}</div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                      STATUS_STYLE[item.status] || "text-[#6b6b6b] bg-[#f8f8f8]"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="text-[#6b6b6b] text-xs leading-relaxed">{item.description}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <span className="text-[#0a0a0a] text-base font-bold">팀 업무 진행 현황</span>
          <div className="w-8" />
        </div>

        {teams.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mb-5 pb-1">
            <button
              onClick={() => setSelectedTeamId(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedTeamId === null ? "bg-[#5b5ef4] text-white" : "bg-white border border-[#e5e5e5] text-[#6b6b6b]"
              }`}
            >
              전체
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedTeamId === t.id ? "bg-[#5b5ef4] text-white" : "bg-white border border-[#e5e5e5] text-[#6b6b6b]"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {content}
      </div>
    </div>
  );
}
