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

interface Cycle {
  id: string;
  name: string;
  grade_distribution: { grade: string; ratio: number }[];
}

interface Entry {
  id: string;
  user_id: string;
  user_name: string;
  category: "performance" | "competency";
  plan_content: string | null;
  plan_status: string;
  actual_content: string | null;
  actual_status: string;
}

interface Person {
  user_id: string;
  user_name: string;
  ready: boolean;
  score: number | null;
  grade: string | null;
}

interface DistributionRow {
  grade: string;
  ratio: number;
  target: number;
  current: number;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

const CATEGORY_LABEL: Record<string, string> = { performance: "성과평가", competency: "역량평가" };

export default function EvaluationReviewPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [distribution, setDistribution] = useState<DistributionRow[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [gradeDraft, setGradeDraft] = useState<Record<string, { score: string; grade: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email === "eunsang0510@gmail.com") {
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
      await loadAll(cid);
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async (cid: string) => {
    const headers = await getAuthHeader();
    const cycleRes = await fetch(`${API_URL}/api/evaluation/cycles/active/${cid}`, { headers });
    const cycleData = await cycleRes.json();
    const activeCycle: Cycle | null = cycleData.cycle;
    setCycle(activeCycle);
    if (!activeCycle) return;

    const [entriesRes, resultsRes] = await Promise.all([
      fetch(`${API_URL}/api/evaluation/entries/review/${activeCycle.id}`, { headers }),
      fetch(`${API_URL}/api/evaluation/results/${activeCycle.id}`, { headers }),
    ]);
    const entriesData = await entriesRes.json();
    const resultsData = await resultsRes.json();
    setEntries(entriesData.entries || []);
    setPeople(resultsData.people || []);
    setDistribution(resultsData.distribution || []);
    setGradeDraft(
      Object.fromEntries(
        (resultsData.people || []).map((p: Person) => [
          p.user_id,
          { score: p.score != null ? String(p.score) : "", grade: p.grade || "" },
        ])
      )
    );
  };

  const review = async (entry: Entry, phase: "plan" | "actual", status: "approved" | "feedback") => {
    setBusy(`${entry.id}-${phase}`);
    try {
      const feedback = feedbackDraft[`${entry.id}-${phase}`] || "";
      const res = await fetch(`${API_URL}/api/evaluation/entries/${entry.id}/${phase}/review`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({ status, feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "처리에 실패했어요");
      showToast(status === "approved" ? "승인했어요" : "피드백을 보냈어요", "success");
      if (companyId) await loadAll(companyId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "처리에 실패했어요", "error");
    } finally {
      setBusy(null);
    }
  };

  const saveGrade = async (userId: string) => {
    if (!cycle) return;
    const draft = gradeDraft[userId];
    if (!draft?.grade) {
      showToast("등급을 선택해주세요", "error");
      return;
    }
    setBusy(`grade-${userId}`);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/results/${userId}/grade`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({
          cycle_id: cycle.id,
          grade: draft.grade,
          score: draft.score ? Number(draft.score) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "등급 부여에 실패했어요");
      showToast("등급을 저장했어요", "success");
      if (companyId) await loadAll(companyId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "등급 부여에 실패했어요", "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#6b6b6b] text-sm">불러오는 중...</div>;
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Link href="/evaluation" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[#6b6b6b] text-sm">
            소속 회사가 있어야 이용할 수 있어요
          </div>
        </div>
      </div>
    );
  }

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.user_id] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/evaluation" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <span className="text-[#0a0a0a] text-base font-bold">평가 검토</span>
          <div className="w-8" />
        </div>

        {!cycle ? (
          <div className="text-center text-[#6b6b6b] text-sm py-16">진행 중인 평가가 없어요</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center text-[#6b6b6b] text-sm py-16">검토할 대상이 없어요</div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([userId, userEntries]) => (
              <div key={userId} className="bg-white border border-[#e5e5e5] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[#0a0a0a] text-sm font-bold">{userEntries[0].user_name}</div>
                  {cycle && (
                    <Link
                      href={`/evaluation/one-on-one/record?cycleId=${cycle.id}&userId=${userId}`}
                      className="text-[#5b5ef4] text-[11px] font-bold"
                    >
                      🎙️ 1on1 녹음
                    </Link>
                  )}
                </div>
                {userEntries.map((entry) => (
                  <div key={entry.id} className="mb-3 last:mb-0">
                    <div className="text-[#0a0a0a] text-xs font-bold mb-1">{CATEGORY_LABEL[entry.category]}</div>

                    {entry.plan_status === "submitted" && (
                      <div className="bg-[#fafafa] rounded-lg p-3 mb-2">
                        <div className="text-[10px] text-[#b0b0b0] mb-1">계획 (검토 대기)</div>
                        <div className="text-xs text-[#0a0a0a] whitespace-pre-wrap mb-2">{entry.plan_content}</div>
                        <input
                          value={feedbackDraft[`${entry.id}-plan`] || ""}
                          onChange={(ev) => setFeedbackDraft((d) => ({ ...d, [`${entry.id}-plan`]: ev.target.value }))}
                          placeholder="피드백 (반려 시 필수 아님)"
                          className="w-full border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#5b5ef4] mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => review(entry, "plan", "feedback")}
                            disabled={busy === `${entry.id}-plan`}
                            className="flex-1 py-1.5 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold disabled:opacity-50"
                          >
                            피드백
                          </button>
                          <button
                            onClick={() => review(entry, "plan", "approved")}
                            disabled={busy === `${entry.id}-plan`}
                            className="flex-1 py-1.5 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                          >
                            승인
                          </button>
                        </div>
                      </div>
                    )}

                    {entry.actual_status === "submitted" && (
                      <div className="bg-[#fafafa] rounded-lg p-3">
                        <div className="text-[10px] text-[#b0b0b0] mb-1">실적 (검토 대기)</div>
                        <div className="text-xs text-[#0a0a0a] whitespace-pre-wrap mb-2">{entry.actual_content}</div>
                        <input
                          value={feedbackDraft[`${entry.id}-actual`] || ""}
                          onChange={(ev) => setFeedbackDraft((d) => ({ ...d, [`${entry.id}-actual`]: ev.target.value }))}
                          placeholder="피드백 (반려 시 필수 아님)"
                          className="w-full border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#5b5ef4] mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => review(entry, "actual", "feedback")}
                            disabled={busy === `${entry.id}-actual`}
                            className="flex-1 py-1.5 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold disabled:opacity-50"
                          >
                            피드백
                          </button>
                          <button
                            onClick={() => review(entry, "actual", "approved")}
                            disabled={busy === `${entry.id}-actual`}
                            className="flex-1 py-1.5 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                          >
                            승인
                          </button>
                        </div>
                      </div>
                    )}

                    {entry.plan_status !== "submitted" && entry.actual_status !== "submitted" && (
                      <div className="text-[11px] text-[#b0b0b0]">검토할 제출 내용이 없어요</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {cycle && people.length > 0 && (
          <div className="mt-6">
            <div className="text-[#0a0a0a] text-sm font-bold mb-3">등급 부여</div>

            {distribution.length > 0 && (
              <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3">
                <div className="text-[#0a0a0a] text-xs font-bold mb-2">담당 인원 등급 분포 (목표 vs 현재)</div>
                <div className="flex flex-col gap-1.5">
                  {distribution.map((d) => (
                    <div key={d.grade} className="flex items-center justify-between text-xs">
                      <span className="text-[#0a0a0a] font-semibold">{d.grade} ({d.ratio}%)</span>
                      <span className={d.current === d.target ? "text-[#6b6b6b]" : "text-[#ef4444] font-semibold"}>
                        목표 {d.target}명 · 현재 {d.current}명
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {people.map((p) => (
                <div key={p.user_id} className="bg-white border border-[#e5e5e5] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[#0a0a0a] text-sm font-bold">{p.user_name}</div>
                    {!p.ready && <span className="text-[10px] text-[#b0b0b0]">실적 승인 대기 중</span>}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={gradeDraft[p.user_id]?.grade || ""}
                      onChange={(ev) =>
                        setGradeDraft((d) => ({ ...d, [p.user_id]: { ...d[p.user_id], grade: ev.target.value } }))
                      }
                      disabled={!p.ready}
                      className="flex-1 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#5b5ef4] disabled:opacity-50"
                    >
                      <option value="">등급 선택</option>
                      {distribution.map((d) => (
                        <option key={d.grade} value={d.grade}>
                          {d.grade}
                        </option>
                      ))}
                    </select>
                    <input
                      value={gradeDraft[p.user_id]?.score || ""}
                      onChange={(ev) =>
                        setGradeDraft((d) => ({ ...d, [p.user_id]: { ...d[p.user_id], score: ev.target.value } }))
                      }
                      disabled={!p.ready}
                      placeholder="점수(선택)"
                      className="w-24 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#5b5ef4] disabled:opacity-50"
                    />
                    <button
                      onClick={() => saveGrade(p.user_id)}
                      disabled={!p.ready || busy === `grade-${p.user_id}`}
                      className="px-4 py-1.5 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
