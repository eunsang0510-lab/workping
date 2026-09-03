"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

interface Member {
  user_id: string;
  user_name: string | null;
  user_email: string;
  org_level: number | null;
}

interface Assignment {
  id: string;
  evaluatee_user_id: string;
  evaluatee_name: string;
  evaluator_user_id: string;
  evaluator_name: string;
  source: string;
}

interface Team {
  id: string;
  name: string;
  parent_team_id: string | null;
}

interface GradeRow {
  grade: string;
  ratio: number;
}

interface Cycle {
  id: string;
  code: string;
  name: string;
  plan_start: string | null;
  plan_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  review_start: string | null;
  review_end: string | null;
  grade_distribution: GradeRow[];
  status: string;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

type Tab = "toggle" | "cycles";

export default function EvaluationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("cycles");
  const [enabled, setEnabled] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cycleForm, setCycleForm] = useState<Cycle | null>(null);
  const [assignmentsCycle, setAssignmentsCycle] = useState<Cycle | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    // 시스템 관리자 확인과 실제 데이터 조회를 동시에 시작한다(순서대로 하면 요청
    // 왕복이 하나 더 늘어 화면 진입이 느려짐). 관리자가 아니면 로그인 화면으로 보낸다.
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      init(u.uid);
      checkSystemAdmin(u.email).then((ok) => {
        if (!ok) router.push("/login");
      });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const init = async (uid: string) => {
    try {
      await reloadAll();
    } finally {
      setLoading(false);
    }
  };

  // 화면 진입에 필요한 데이터를 한 번의 요청(/bootstrap/settings)으로 모아 받는다.
  // 이전엔 company/my → members + assignments + cycles + teams 순으로 요청이
  // 5번 이어져서(왕복마다 지연 발생) 화면 진입이 느렸다.
  const reloadAll = async () => {
    const res = await fetch(`${API_URL}/api/evaluation/bootstrap/settings`, { headers: await getAuthHeader() });
    const data = await res.json();
    setCompanyId(data.company_id || null);
    setEnabled(!!data.evaluation_enabled);
    setMembers(data.members || []);
    setTeams(data.teams || []);
    const cycleList: Cycle[] = data.cycles || [];
    setCycles(cycleList);
    if (cycleList[0]) {
      setSelectedCycleId(cycleList[0].id);
      setCycleForm(cycleList[0]);
    }
  };

  // 평가자 매핑은 이제 사이클(평가코드)별로 관리된다 — 같은 회사라도 임원/사무직/생산직처럼
  // 사이클마다 다른 대상자·평가자 조합을 가질 수 있어야 하기 때문.
  const openAssignments = async (cycle: Cycle) => {
    setAssignmentsCycle(cycle);
    await reloadAssignments(cycle.id);
  };

  const reloadAssignments = async (cycleId: string) => {
    const res = await fetch(`${API_URL}/api/evaluation/assignments/${cycleId}`, { headers: await getAuthHeader() });
    const data = await res.json();
    setAssignments(data.assignments || []);
  };

  const reloadCycles = async (cid: string) => {
    const res = await fetch(`${API_URL}/api/evaluation/cycles/${cid}`, { headers: await getAuthHeader() });
    const data = await res.json();
    setCycles(data.cycles || []);
  };

  const toggleEvaluation = async (next: boolean) => {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/toggle/${companyId}`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({ evaluation_enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "변경에 실패했어요");
      setEnabled(next);
      showToast(next ? "평가 기능을 켰어요" : "평가 기능을 껐어요", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "변경에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const seedAssignments = async () => {
    if (!assignmentsCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/assignments/seed/${assignmentsCycle.id}`, {
        method: "POST",
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "자동 설정에 실패했어요");
      showToast(`${data.created}명의 평가자를 자동으로 설정했어요`, "success");
      await reloadAssignments(assignmentsCycle.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "자동 설정에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    if (!assignmentsCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/assignments/template/${assignmentsCycle.id}`, {
        headers: await getAuthHeader(),
      });
      if (!res.ok) throw new Error("템플릿 다운로드에 실패했어요");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "평가자_설정_양식.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "템플릿 다운로드에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadAssignmentsExcel = async (file: File) => {
    if (!assignmentsCycle) return;
    setBusy(true);
    setUploadErrors(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/evaluation/assignments/upload/${assignmentsCycle.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        if (typeof detail === "object" && Array.isArray(detail?.errors)) {
          setUploadErrors(detail.errors);
          showToast(detail.message || "업로드 내용에 오류가 있어요", "error");
          return;
        }
        throw new Error(typeof detail === "string" ? detail : "업로드에 실패했어요");
      }
      showToast(`${data.processed}명 반영, 평가자 매핑 ${data.assignments_created}건 생성했어요`, "success");
      await reloadAssignments(assignmentsCycle.id);
      await reloadAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "업로드에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const setEvaluator = async (evaluateeUserId: string, evaluatorUserId: string) => {
    if (!assignmentsCycle || !evaluatorUserId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/assignments`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({ cycle_id: assignmentsCycle.id, evaluatee_user_id: evaluateeUserId, evaluator_user_id: evaluatorUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "설정에 실패했어요");
      await reloadAssignments(assignmentsCycle.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "설정에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!assignmentsCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/assignments/${assignmentId}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });
      if (!res.ok) throw new Error("삭제에 실패했어요");
      await reloadAssignments(assignmentsCycle.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "삭제에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const setParentTeam = async (teamId: string, parentTeamId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/team/${teamId}`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({ parent_team_id: parentTeamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "설정에 실패했어요");
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, parent_team_id: parentTeamId || null } : t)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "설정에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const createCycle = async () => {
    if (!companyId || !newCode.trim() || !newName.trim()) {
      showToast("코드와 이름을 입력해주세요", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/cycles`, {
        method: "POST",
        headers: await getAuthHeader(),
        body: JSON.stringify({ company_id: companyId, code: newCode.trim(), name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "생성에 실패했어요");
      showToast("평가 코드를 만들었어요", "success");
      setNewCode("");
      setNewName("");
      await reloadCycles(companyId);
      setSelectedCycleId(data.id);
      setCycleForm(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "생성에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveCycle = async () => {
    if (!cycleForm) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/cycles/${cycleForm.id}`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({
          name: cycleForm.name,
          plan_start: cycleForm.plan_start,
          plan_end: cycleForm.plan_end,
          actual_start: cycleForm.actual_start,
          actual_end: cycleForm.actual_end,
          review_start: cycleForm.review_start,
          review_end: cycleForm.review_end,
          grade_distribution: cycleForm.grade_distribution,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장에 실패했어요");
      showToast("저장했어요", "success");
      if (companyId) await reloadCycles(companyId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "저장에 실패했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const activateCycle = async () => {
    if (!assignmentsCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluation/cycles/${assignmentsCycle.id}/activate`, {
        method: "POST",
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "시작할 수 없어요");
      showToast("평가를 시작했어요", "success");
      if (companyId) await reloadCycles(companyId);
      setAssignmentsCycle((c) => (c ? { ...c, status: "active" } : c));
      setCycleForm((f) => (f && f.id === assignmentsCycle.id ? { ...f, status: "active" } : f));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "시작할 수 없어요", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteCycle = (cycle: Cycle) => {
    setConfirm({
      message: `"${cycle.name}" 평가 코드를 삭제할까요?`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(true);
        try {
          const res = await fetch(`${API_URL}/api/evaluation/cycles/${cycle.id}`, {
            method: "DELETE",
            headers: await getAuthHeader(),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "삭제에 실패했어요");
          showToast("삭제했어요", "success");
          if (cycleForm?.id === cycle.id) setCycleForm(null);
          if (selectedCycleId === cycle.id) setSelectedCycleId(null);
          if (companyId) await reloadCycles(companyId);
        } catch (e) {
          showToast(e instanceof Error ? e.message : "삭제에 실패했어요", "error");
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const updateGradeRow = (idx: number, field: "grade" | "ratio", value: string) => {
    if (!cycleForm) return;
    const rows = [...cycleForm.grade_distribution];
    rows[idx] = { ...rows[idx], [field]: field === "ratio" ? Number(value) || 0 : value };
    setCycleForm({ ...cycleForm, grade_distribution: rows });
  };

  const addGradeRow = () => {
    if (!cycleForm) return;
    setCycleForm({ ...cycleForm, grade_distribution: [...cycleForm.grade_distribution, { grade: "", ratio: 0 }] });
  };

  const removeGradeRow = (idx: number) => {
    if (!cycleForm) return;
    setCycleForm({ ...cycleForm, grade_distribution: cycleForm.grade_distribution.filter((_, i) => i !== idx) });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Link href="/evaluation" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[#6b6b6b] text-sm">
            소속 회사가 있어야 평가 설정을 이용할 수 있어요
          </div>
        </div>
      </div>
    );
  }

  const ratioSum = (cycleForm?.grade_distribution || []).reduce((s, g) => s + (g.ratio || 0), 0);

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <Confirm message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          {assignmentsCycle ? (
            <button onClick={() => setAssignmentsCycle(null)} className="text-[#6b6b6b] text-sm">← 평가 코드로</button>
          ) : (
            <Link href="/evaluation" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          )}
          <span className="text-[#0a0a0a] text-base font-bold">
            {assignmentsCycle ? `평가자 설정 · ${assignmentsCycle.name}` : "AI 평가 설정"}
          </span>
          <div className="w-8" />
        </div>

        {assignmentsCycle ? (
          <div className="flex flex-col gap-4">
            {assignmentsCycle.status !== "draft" && (
              <div className="text-[11px] text-[#d97706] bg-[#fffbeb] rounded-lg px-3 py-2">
                이미 시작된 사이클이에요. 매핑을 참고용으로 볼 수만 있어요.
              </div>
            )}

            <div className="bg-white border border-[#e5e5e5] rounded-xl p-3">
              <div className="text-[#0a0a0a] text-xs font-bold mb-1">엑셀로 일괄 설정</div>
              <div className="text-[#b0b0b0] text-[10px] mb-2">
                템플릿을 받아 이름/이메일 옆에 레벨과 상위자(평가자) 이메일을 채운 뒤 업로드하면,
                이 사이클의 기존 평가자 설정을 전체 교체해요.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadTemplate}
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold disabled:opacity-50"
                >
                  템플릿 다운로드
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || assignmentsCycle.status !== "draft"}
                  className="flex-1 py-2 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                >
                  엑셀 업로드
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    if (file) uploadAssignmentsExcel(file);
                    ev.target.value = "";
                  }}
                />
              </div>
              {uploadErrors && (
                <div className="mt-2 bg-[#fef2f2] border border-[#fecaca] rounded-lg p-2 max-h-40 overflow-y-auto">
                  {uploadErrors.map((err, i) => (
                    <div key={i} className="text-[#ef4444] text-[10px] leading-relaxed">{err}</div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={seedAssignments}
              disabled={busy || assignmentsCycle.status !== "draft"}
              className="w-full py-2.5 rounded-xl border border-[#5b5ef4] text-[#5b5ef4] text-xs font-bold disabled:opacity-50"
            >
              조직도(팀장) 기준으로 자동 설정
            </button>

            <div className="flex flex-col gap-2">
              {members.map((m) => {
                const assignment = assignments.find((a) => a.evaluatee_user_id === m.user_id);
                return (
                  <div key={m.user_id} className="bg-white border border-[#e5e5e5] rounded-xl p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[#0a0a0a] text-xs font-bold truncate">
                        {m.user_name || m.user_email}
                        {m.org_level != null && (
                          <span className="ml-1.5 text-[#4a4de0] font-normal">Lv.{m.org_level}</span>
                        )}
                      </div>
                      {assignment && (
                        <div className="text-[#b0b0b0] text-[10px]">
                          {{ auto: "자동", excel: "엑셀", manual: "수동" }[assignment.source] || "수동"} 설정됨
                        </div>
                      )}
                    </div>
                    <select
                      value={assignment?.evaluator_user_id || ""}
                      onChange={(ev) => setEvaluator(m.user_id, ev.target.value)}
                      disabled={assignmentsCycle.status !== "draft"}
                      className="border border-[#e5e5e5] rounded-lg px-2 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] max-w-[120px] disabled:opacity-50"
                    >
                      <option value="">평가자 선택</option>
                      {members
                        .filter((mm) => mm.user_id !== m.user_id)
                        .map((mm) => (
                          <option key={mm.user_id} value={mm.user_id}>
                            {mm.user_name || mm.user_email}
                          </option>
                        ))}
                    </select>
                    {assignment && assignmentsCycle.status === "draft" && (
                      <button
                        onClick={() => deleteAssignment(assignment.id)}
                        className="text-[#ef4444] text-[11px] font-bold px-1"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {assignmentsCycle.status === "draft" && (
              <button
                onClick={activateCycle}
                disabled={busy || assignments.length === 0}
                className="w-full py-3 rounded-xl bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white text-sm font-bold"
              >
                이 사이클 시작하기
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-5">
              {([
                ["cycles", "평가 코드"],
                ["toggle", "활성화"],
              ] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    tab === key ? "bg-[#5b5ef4] text-white" : "bg-white border border-[#e5e5e5] text-[#6b6b6b]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "toggle" && (
              <div className="flex flex-col gap-4">
                <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[#0a0a0a] text-sm font-bold">평가 기능</div>
                      <div className="text-[#6b6b6b] text-xs mt-0.5">켜면 대시보드에 평가 메뉴가 노출돼요</div>
                    </div>
                    <button
                      onClick={() => toggleEvaluation(!enabled)}
                      disabled={busy}
                      className={`w-12 h-7 rounded-full transition-all relative disabled:opacity-50 ${
                        enabled ? "bg-[#5b5ef4]" : "bg-[#e5e5e5]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${
                          enabled ? "left-5.5 translate-x-0" : "left-0.5"
                        }`}
                        style={{ left: enabled ? "22px" : "2px" }}
                      />
                    </button>
                  </div>
                </div>

                {teams.length > 0 && (
                  <div>
                    <div className="text-[#0a0a0a] text-xs font-bold mb-2">
                      팀 상위 조직 (1on1 모니터링 열람 권한 판별에 사용돼요)
                    </div>
                    <div className="flex flex-col gap-2">
                      {teams.map((t) => (
                        <div key={t.id} className="bg-white border border-[#e5e5e5] rounded-xl p-3 flex items-center gap-2">
                          <div className="flex-1 min-w-0 text-[#0a0a0a] text-xs font-bold truncate">{t.name}</div>
                          <select
                            value={t.parent_team_id || ""}
                            onChange={(ev) => setParentTeam(t.id, ev.target.value)}
                            disabled={busy}
                            className="border border-[#e5e5e5] rounded-lg px-2 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] max-w-[140px] disabled:opacity-50"
                          >
                            <option value="">상위 조직 없음</option>
                            {teams
                              .filter((tt) => tt.id !== t.id)
                              .map((tt) => (
                                <option key={tt.id} value={tt.id}>
                                  {tt.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

        {tab === "cycles" && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4">
              <div className="text-[#0a0a0a] text-xs font-bold mb-2">새 평가 코드 만들기</div>
              <div className="flex gap-2">
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="코드 (예: 2026-H1)"
                  className="flex-1 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4]"
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="이름 (예: 2026년 상반기 평가)"
                  className="flex-1 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4]"
                />
                <button
                  onClick={createCycle}
                  disabled={busy}
                  className="px-4 py-1.5 rounded-lg bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                >
                  생성
                </button>
              </div>
            </div>

            {cycles.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {cycles.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCycleId(c.id);
                      setCycleForm(c);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                      selectedCycleId === c.id ? "bg-[#5b5ef4] text-white" : "bg-white border border-[#e5e5e5] text-[#6b6b6b]"
                    }`}
                  >
                    {c.name} {c.status !== "draft" && `(${c.status === "active" ? "진행중" : "종료"})`}
                  </button>
                ))}
              </div>
            )}

            {cycleForm && (
              <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4">
                {cycleForm.status !== "draft" ? (
                  <div className="text-[11px] text-[#d97706] bg-[#fffbeb] rounded-lg px-3 py-2 mb-3">
                    이미 시작된 평가는 기준정보를 수정할 수 없어요
                  </div>
                ) : null}

                {(
                  [
                    ["plan_start", "plan_end", "계획 입력기간"],
                    ["actual_start", "actual_end", "실적 입력기간"],
                    ["review_start", "review_end", "평가기간"],
                  ] as [keyof Cycle, keyof Cycle, string][]
                ).map(([startKey, endKey, label]) => (
                  <div key={label} className="mb-3">
                    <div className="text-[#0a0a0a] text-xs font-bold mb-1">{label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={(cycleForm[startKey] as string) || ""}
                        disabled={cycleForm.status !== "draft"}
                        onChange={(e) => setCycleForm({ ...cycleForm, [startKey]: e.target.value })}
                        className="flex-1 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] disabled:opacity-50"
                      />
                      <span className="text-[#b0b0b0] text-xs">~</span>
                      <input
                        type="date"
                        value={(cycleForm[endKey] as string) || ""}
                        disabled={cycleForm.status !== "draft"}
                        onChange={(e) => setCycleForm({ ...cycleForm, [endKey]: e.target.value })}
                        className="flex-1 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[#0a0a0a] text-xs font-bold">등급별 비율 (%)</div>
                    <span className={ratioSum === 100 ? "text-[#16a34a] text-[11px]" : "text-[#ef4444] text-[11px]"}>
                      합계 {ratioSum}%
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {cycleForm.grade_distribution.map((g, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={g.grade}
                          disabled={cycleForm.status !== "draft"}
                          onChange={(e) => updateGradeRow(idx, "grade", e.target.value)}
                          placeholder="등급 (예: S)"
                          className="flex-1 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] disabled:opacity-50"
                        />
                        <input
                          type="number"
                          value={g.ratio}
                          disabled={cycleForm.status !== "draft"}
                          onChange={(e) => updateGradeRow(idx, "ratio", e.target.value)}
                          placeholder="비율"
                          className="w-20 border border-[#e5e5e5] rounded-lg px-2.5 py-1.5 text-xs text-[#0a0a0a] outline-none focus:border-[#5b5ef4] disabled:opacity-50"
                        />
                        {cycleForm.status === "draft" && (
                          <button onClick={() => removeGradeRow(idx)} className="text-[#ef4444] text-[11px] font-bold px-1">
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {cycleForm.status === "draft" && (
                    <button onClick={addGradeRow} className="text-[#5b5ef4] text-[11px] font-bold mt-1.5">
                      + 등급 추가
                    </button>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {cycleForm.status === "draft" && (
                    <button
                      onClick={saveCycle}
                      disabled={busy}
                      className="flex-1 py-2.5 rounded-xl border border-[#5b5ef4] text-[#5b5ef4] text-xs font-bold disabled:opacity-50"
                    >
                      저장
                    </button>
                  )}
                  <button
                    onClick={() => openAssignments(cycleForm)}
                    disabled={busy}
                    className="flex-1 py-2.5 rounded-xl bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-xs font-bold disabled:opacity-50"
                  >
                    평가자 설정
                  </button>
                </div>
                {cycleForm.status === "draft" && (
                  <button
                    onClick={() => deleteCycle(cycleForm)}
                    disabled={busy}
                    className="w-full mt-2 py-2 text-[#ef4444] text-[11px] font-bold disabled:opacity-50"
                  >
                    이 평가 코드 삭제
                  </button>
                )}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
