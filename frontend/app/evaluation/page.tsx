"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import RadarChart from "@/components/RadarChart";
import { API_URL } from "@/lib/api";
import { checkSystemAdmin } from "@/lib/systemAdmin";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

interface Cycle {
  id: string;
  name: string;
  plan_start: string | null;
  plan_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  review_start: string | null;
  review_end: string | null;
  status: string;
}

interface Entry {
  id: string;
  category: "performance" | "competency";
  evaluator_name: string;
  plan_content: string | null;
  plan_status: string;
  plan_feedback: string | null;
  actual_content: string | null;
  actual_status: string;
  actual_feedback: string | null;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface MyResult {
  score: number | null;
  grade: string | null;
  ai_career_analysis: string | null;
  ai_career_generated_at: string | null;
  ai_growth_analysis: string | null;
  ai_competencies: { axis: string; score: number }[];
  ai_growth_generated_at: string | null;
}

const CATEGORY_LABEL: Record<string, string> = { performance: "성과평가", competency: "역량평가" };
const STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  submitted: "제출됨 · 검토 대기",
  approved: "승인됨",
  feedback: "피드백 반영 필요",
};
const STATUS_STYLE: Record<string, string> = {
  draft: "text-[#6b6b6b] bg-[#f8f8f8]",
  submitted: "text-[#d97706] bg-[#fffbeb]",
  approved: "text-[#16a34a] bg-[#f0fdf4]",
  feedback: "text-[#ef4444] bg-[#fef2f2]",
};

const today = () => new Date().toISOString().slice(0, 10);
const inPeriod = (start: string | null, end: string | null) =>
  !!start && !!end && start <= today() && today() <= end;

export default function EvaluationPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { plan: string; actual: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobTitleDraft, setJobTitleDraft] = useState("");
  const [myResult, setMyResult] = useState<MyResult | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && (await checkSystemAdmin(u.email))) {
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
      await loadBootstrap();
    } finally {
      setLoading(false);
    }
  };

  // 화면 진입에 필요한 데이터를 한 번의 요청(/bootstrap)으로 모아 받는다.
  // 이전엔 company/my → cycles/active → entries/my + results/me 순으로 요청이 3~4번
  // 이어져서(왕복마다 지연 발생) 화면 진입이 느렸다.
  const loadBootstrap = async () => {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/evaluation/bootstrap`, { headers });
    const data = await res.json();
    setCompanyId(data.company_id || null);
    // 이 화면은 이미 시스템 관리자만 들어올 수 있으므로(진입 시 checkSystemAdmin으로 가드),
    // 회사 관리자 여부(CompanyMember.is_admin)와 무관하게 설정 화면 진입 권한을 준다.
    setIsAdmin(true);
    setIsManager(!!data.is_manager);
    setJobTitle(data.job_title || "");
    setJobTitleDraft(data.job_title || "");
    setCycle(data.cycle || null);
    const list: Entry[] = data.entries || [];
    setEntries(list);
    setDrafts(
      Object.fromEntries(
        list.map((e) => [e.id, { plan: e.plan_content || "", actual: e.actual_content || "" }])
      )
    );
    setMyResult(data.result || null);
  };

  const saveJobTitle = async () => {
    if (!companyId || !jobTitleDraft.trim()) return;
    setAiBusy("job-title");
    try {
      const res = await fetch(`${API_URL}/api/evaluation/job-title`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({ company_id: companyId, job_title: jobTitleDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장에 실패했어요");
      setJobTitle(data.job_title);
      showToast("직무를 저장했어요", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "저장에 실패했어요", "error");
    } finally {
      setAiBusy(null);
    }
  };

  const runAiAnalysis = async (kind: "career" | "growth") => {
    if (!cycle) return;
    setAiBusy(kind);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/results/${cycle.id}/${kind}-analysis`, {
        method: "POST",
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "분석에 실패했어요");
      setMyResult(data);
      showToast("AI 분석을 받았어요", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "분석에 실패했어요", "error");
    } finally {
      setAiBusy(null);
    }
  };

  const saveEntry = async (entry: Entry, phase: "plan" | "actual", submit: boolean) => {
    setSaving(`${entry.id}-${phase}`);
    try {
      const content = drafts[entry.id]?.[phase] || "";
      const res = await fetch(`${API_URL}/api/evaluation/entries/${entry.id}/${phase}`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({ content, submit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장에 실패했어요");
      showToast(submit ? "제출했어요" : "임시저장했어요", "success");
      await loadBootstrap();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "저장에 실패했어요", "error");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#6b6b6b] text-sm">불러오는 중...</div>;
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[#6b6b6b] text-sm">
            소속 회사가 있어야 평가를 이용할 수 있어요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/dashboard" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <span className="text-[#0a0a0a] text-base font-bold">AI 평가</span>
          <div className="w-8" />
        </div>

        {(isAdmin || isManager) && (
          <div className="flex gap-2 mb-5">
            {isAdmin && (
              <Link href="/evaluation/settings" className="flex-1">
                <div className="w-full text-center py-2 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold">
                  평가 설정
                </div>
              </Link>
            )}
            {(isAdmin || isManager) && (
              <Link href="/evaluation/one-on-one/monitor" className="flex-1">
                <div className="w-full text-center py-2 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold">
                  1on1 모니터링
                </div>
              </Link>
            )}
            {isManager && (
              <Link href="/evaluation/review" className="flex-1">
                <div className="w-full text-center py-2 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold">
                  평가 검토하기
                </div>
              </Link>
            )}
          </div>
        )}

        {!cycle ? (
          <div className="text-center text-[#6b6b6b] text-sm py-16">진행 중인 평가가 없어요</div>
        ) : (
          <>
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-5">
              <div className="text-[#0a0a0a] text-sm font-bold mb-1">{cycle.name}</div>
              <div className="text-[#6b6b6b] text-[11px] leading-relaxed">
                계획 {cycle.plan_start}~{cycle.plan_end} · 실적 {cycle.actual_start}~{cycle.actual_end} · 평가{" "}
                {cycle.review_start}~{cycle.review_end}
              </div>
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-5">
              <div className="text-[#0a0a0a] text-xs font-bold mb-2">직무</div>
              {jobTitle ? (
                <div className="flex items-center justify-between">
                  <span className="text-[#0a0a0a] text-xs">{jobTitle}</span>
                  <button
                    onClick={() => setJobTitle("")}
                    className="text-[#b0b0b0] text-[11px]"
                  >
                    수정
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={jobTitleDraft}
                    onChange={(e) => setJobTitleDraft(e.target.value)}
                    placeholder="예: 백엔드 개발자, 영업 매니저"
                    className="flex-1 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#5b5ef4]"
                  />
                  <button
                    onClick={saveJobTitle}
                    disabled={aiBusy === "job-title"}
                    className="px-4 py-1.5 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
              )}
              <div className="text-[#b0b0b0] text-[10px] mt-1.5">AI 커리어·성장 분석에 사용돼요</div>
            </div>

            <div className="flex flex-col gap-4">
              {entries.map((entry) => {
                const planEditable = entry.plan_status === "draft" || entry.plan_status === "feedback";
                const actualEditable =
                  entry.plan_status === "approved" &&
                  (entry.actual_status === "draft" || entry.actual_status === "feedback");
                const planPeriodOpen = inPeriod(cycle.plan_start, cycle.plan_end);
                const actualPeriodOpen = inPeriod(cycle.actual_start, cycle.actual_end);

                return (
                  <div key={entry.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[#0a0a0a] text-sm font-bold">{CATEGORY_LABEL[entry.category]}</div>
                      <div className="text-[#b0b0b0] text-[11px]">평가자: {entry.evaluator_name}</div>
                    </div>

                    {/* 계획 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[#0a0a0a] text-xs font-bold">계획</div>
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLE[entry.plan_status]}`}>
                          {STATUS_LABEL[entry.plan_status]}
                        </span>
                      </div>
                      {entry.plan_feedback && planEditable && (
                        <div className="text-[11px] text-[#ef4444] bg-[#fef2f2] rounded-lg px-3 py-2 mb-2">
                          {entry.plan_feedback}
                        </div>
                      )}
                      {planEditable ? (
                        <>
                          <textarea
                            value={drafts[entry.id]?.plan || ""}
                            onChange={(ev) =>
                              setDrafts((d) => ({ ...d, [entry.id]: { ...d[entry.id], plan: ev.target.value } }))
                            }
                            placeholder="이번 기간 계획을 작성해주세요"
                            rows={4}
                            className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] resize-none"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => saveEntry(entry, "plan", false)}
                              disabled={saving === `${entry.id}-plan`}
                              className="flex-1 py-2 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold disabled:opacity-50"
                            >
                              임시저장
                            </button>
                            <button
                              onClick={() => saveEntry(entry, "plan", true)}
                              disabled={saving === `${entry.id}-plan` || !planPeriodOpen}
                              className="flex-1 py-2 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                            >
                              제출
                            </button>
                          </div>
                          {!planPeriodOpen && (
                            <div className="text-[10px] text-[#b0b0b0] mt-1.5">계획 입력기간이 아니면 제출할 수 없어요</div>
                          )}
                        </>
                      ) : (
                        <div className="text-[#0a0a0a] text-xs leading-relaxed whitespace-pre-wrap bg-[#fafafa] rounded-lg px-3 py-2">
                          {entry.plan_content || "(내용 없음)"}
                        </div>
                      )}
                    </div>

                    {/* 실적 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[#0a0a0a] text-xs font-bold">실적</div>
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLE[entry.actual_status]}`}>
                          {STATUS_LABEL[entry.actual_status]}
                        </span>
                      </div>
                      {entry.plan_status !== "approved" ? (
                        <div className="text-[11px] text-[#b0b0b0]">계획이 승인되면 실적을 입력할 수 있어요</div>
                      ) : (
                        <>
                          {entry.actual_feedback && actualEditable && (
                            <div className="text-[11px] text-[#ef4444] bg-[#fef2f2] rounded-lg px-3 py-2 mb-2">
                              {entry.actual_feedback}
                            </div>
                          )}
                          {actualEditable ? (
                            <>
                              <textarea
                                value={drafts[entry.id]?.actual || ""}
                                onChange={(ev) =>
                                  setDrafts((d) => ({ ...d, [entry.id]: { ...d[entry.id], actual: ev.target.value } }))
                                }
                                placeholder="이번 기간 실적을 작성해주세요"
                                rows={4}
                                className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] resize-none"
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => saveEntry(entry, "actual", false)}
                                  disabled={saving === `${entry.id}-actual`}
                                  className="flex-1 py-2 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold disabled:opacity-50"
                                >
                                  임시저장
                                </button>
                                <button
                                  onClick={() => saveEntry(entry, "actual", true)}
                                  disabled={saving === `${entry.id}-actual` || !actualPeriodOpen}
                                  className="flex-1 py-2 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                                >
                                  제출
                                </button>
                              </div>
                              {!actualPeriodOpen && (
                                <div className="text-[10px] text-[#b0b0b0] mt-1.5">실적 입력기간이 아니면 제출할 수 없어요</div>
                              )}
                            </>
                          ) : (
                            <div className="text-[#0a0a0a] text-xs leading-relaxed whitespace-pre-wrap bg-[#fafafa] rounded-lg px-3 py-2">
                              {entry.actual_content || "(내용 없음)"}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#0a0a0a] text-sm font-bold">🧭 AI 커리어 분석</div>
                {myResult?.ai_career_analysis && (
                  <button
                    onClick={() => runAiAnalysis("career")}
                    disabled={aiBusy === "career" || !jobTitle}
                    className="text-[#5b5ef4] text-[11px] font-bold disabled:opacity-50"
                  >
                    다시 분석하기
                  </button>
                )}
              </div>
              {myResult?.ai_career_analysis ? (
                <div className="text-[#0a0a0a] text-xs leading-relaxed whitespace-pre-wrap">
                  {myResult.ai_career_analysis}
                </div>
              ) : (
                <>
                  <div className="text-[#6b6b6b] text-xs mb-3">
                    작성한 계획을 바탕으로 AI가 커리어 성장 방향을 조언해줘요.
                  </div>
                  <button
                    onClick={() => runAiAnalysis("career")}
                    disabled={aiBusy === "career" || !jobTitle}
                    className="w-full py-2.5 rounded-xl bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {aiBusy === "career" ? "분석 중..." : "AI로 분석받기"}
                  </button>
                  {!jobTitle && <div className="text-[10px] text-[#b0b0b0] mt-1.5">직무를 먼저 입력해주세요</div>}
                </>
              )}
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#0a0a0a] text-sm font-bold">📈 AI 성장 · 역량 분석</div>
                {myResult?.ai_growth_analysis && (
                  <button
                    onClick={() => runAiAnalysis("growth")}
                    disabled={aiBusy === "growth" || !jobTitle}
                    className="text-[#5b5ef4] text-[11px] font-bold disabled:opacity-50"
                  >
                    다시 분석하기
                  </button>
                )}
              </div>
              {myResult?.ai_growth_analysis ? (
                <>
                  <div className="text-[#0a0a0a] text-xs leading-relaxed whitespace-pre-wrap mb-3">
                    {myResult.ai_growth_analysis}
                  </div>
                  {myResult.ai_competencies.length > 0 && (
                    <div className="flex justify-center">
                      <RadarChart data={myResult.ai_competencies} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-[#6b6b6b] text-xs mb-3">
                    작성한 실적을 바탕으로 AI가 직무 적합도·성장 분석과 역량 그래프를 만들어줘요.
                  </div>
                  <button
                    onClick={() => runAiAnalysis("growth")}
                    disabled={aiBusy === "growth" || !jobTitle}
                    className="w-full py-2.5 rounded-xl bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {aiBusy === "growth" ? "분석 중..." : "AI로 분석받기"}
                  </button>
                  {!jobTitle && <div className="text-[10px] text-[#b0b0b0] mt-1.5">직무를 먼저 입력해주세요</div>}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
