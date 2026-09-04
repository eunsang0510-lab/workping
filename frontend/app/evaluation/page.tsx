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

interface Cycle {
  id: string;
  name: string;
  status: string;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

export default function EvaluationAdminHubPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [evaluateeScreenOpen, setEvaluateeScreenOpen] = useState(false);
  const [evaluatorScreenOpen, setEvaluatorScreenOpen] = useState(false);
  const [screenBusy, setScreenBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirm({ message, onConfirm });
  }, []);

  useEffect(() => {
    // 시스템 관리자 확인과 실제 데이터 조회를 동시에 시작한다(순서대로 하면 요청
    // 왕복이 하나 더 늘어 화면 진입이 느려짐). 관리자가 아니면 로그인 화면으로 보낸다.
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      loadBootstrap().finally(() => setLoading(false));
      checkSystemAdmin(u.email).then((ok) => {
        if (!ok) router.push("/login");
      });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // 이 화면은 평가관리자 전용 콘솔(평가 설정 · 전체 현황 검토 · 1on1 모니터링 +
  // 내 평가/평가 검토 화면 공개 스위치)이다. 본인 계획/실적 작성은 "내 평가"
  // (/evaluation/mine), 담당 피평가자 등급 부여는 "평가 검토"(/evaluation/team)로
  // 화면 자체를 분리했다 — 권한 분기로 한 화면에서 여러 역할을 보여주지 않는다
  // (평가 정보는 민감해서 화면 단위로 통제).
  const loadBootstrap = async () => {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/evaluation/bootstrap/settings`, { headers });
    const data = await res.json();
    setCompanyId(data.company_id || null);
    setCycles(data.cycles || []);
    setEvaluateeScreenOpen(!!data.evaluatee_screen_open);
    setEvaluatorScreenOpen(!!data.evaluator_screen_open);
  };

  const toggleScreen = (kind: "evaluatee" | "evaluator", nextOpen: boolean) => {
    if (!companyId) return;
    const label = kind === "evaluatee" ? "내 평가" : "평가 검토 · 등급 부여";
    const action = nextOpen ? "공개" : "비공개 전환";
    showConfirm(
      `"${label}" 화면을 ${action}할까요?\n${
        nextOpen
          ? "대상자 전원이 즉시 접근할 수 있게 돼요."
          : "이미 열람 중인 대상자도 더 이상 접근할 수 없게 돼요."
      }`,
      async () => {
        setConfirm(null);
        setScreenBusy(kind);
        try {
          const res = await fetch(`${API_URL}/api/evaluation/screens/${kind}/${companyId}`, {
            method: "PUT",
            headers: await getAuthHeader(),
            body: JSON.stringify({ open: nextOpen }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "변경에 실패했어요");
          if (kind === "evaluatee") setEvaluateeScreenOpen(nextOpen);
          else setEvaluatorScreenOpen(nextOpen);
          showToast(`"${label}" 화면을 ${action}했어요`, "success");
        } catch (e) {
          showToast(e instanceof Error ? e.message : "변경에 실패했어요", "error");
        } finally {
          setScreenBusy(null);
        }
      }
    );
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
          <Link href="/dashboard" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[#6b6b6b] text-sm">
            소속 회사가 있어야 평가를 이용할 수 있어요
          </div>
        </div>
      </div>
    );
  }

  const activeCycle = cycles.find((c) => c.status === "active") || null;

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && <Confirm message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/dashboard" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <span className="text-[#0a0a0a] text-base font-bold">평가관리자</span>
          <div className="w-8" />
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-5">
          <div className="text-[#0a0a0a] text-xs font-bold mb-1">진행 중인 평가</div>
          <div className="text-[#6b6b6b] text-xs">{activeCycle ? activeCycle.name : "진행 중인 평가가 없어요"}</div>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-5">
          <div className="text-[#0a0a0a] text-xs font-bold mb-3">화면 공개 설정</div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-[#0a0a0a] text-xs font-semibold">내 평가 화면</div>
              <div className="text-[#b0b0b0] text-[10px] mt-0.5">피평가자의 계획·실적 작성 화면</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6b6b6b]">{evaluateeScreenOpen ? "공개" : "비공개"}</span>
              <button
                onClick={() => toggleScreen("evaluatee", !evaluateeScreenOpen)}
                disabled={screenBusy === "evaluatee"}
                className={`w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${
                  evaluateeScreenOpen ? "bg-[#5b5ef4]" : "bg-[#e5e5e5]"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    evaluateeScreenOpen ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-[#f0f0f0] mt-1 pt-3">
            <div>
              <div className="text-[#0a0a0a] text-xs font-semibold">평가 검토 · 등급 부여 화면</div>
              <div className="text-[#b0b0b0] text-[10px] mt-0.5">평가자(팀장·임원)의 검토·등급 부여 화면</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6b6b6b]">{evaluatorScreenOpen ? "공개" : "비공개"}</span>
              <button
                onClick={() => toggleScreen("evaluator", !evaluatorScreenOpen)}
                disabled={screenBusy === "evaluator"}
                className={`w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${
                  evaluatorScreenOpen ? "bg-[#5b5ef4]" : "bg-[#e5e5e5]"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    evaluatorScreenOpen ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="text-[#b0b0b0] text-[10px] mt-3">
            시스템 관리자 계정은 공개 여부와 무관하게 항상 접근할 수 있어요.
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/evaluation/settings">
            <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-2xl p-4 flex items-center gap-3 transition-all">
              <span className="text-lg">⚙️</span>
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">평가 설정</div>
                <div className="text-[#6b6b6b] text-xs">평가 코드 · 평가자 설정 · 기능 활성화</div>
              </div>
            </div>
          </Link>
          <Link href="/evaluation/review">
            <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-2xl p-4 flex items-center gap-3 transition-all">
              <span className="text-lg">📋</span>
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">전체 현황 검토</div>
                <div className="text-[#6b6b6b] text-xs">회사 전체 계획·실적 제출 현황과 등급 부여</div>
              </div>
            </div>
          </Link>
          <Link href="/evaluation/one-on-one/monitor">
            <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-2xl p-4 flex items-center gap-3 transition-all">
              <span className="text-lg">🎙️</span>
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">1on1 모니터링</div>
                <div className="text-[#6b6b6b] text-xs">평가자-피평가자 면담 녹음 · AI 분석</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
