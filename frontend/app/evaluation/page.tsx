"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

export default function EvaluationAdminHubPage() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const router = useRouter();

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

  // 이 화면은 평가관리자 전용 콘솔(평가 설정 · 전체 현황 검토 · 1on1 모니터링)이다.
  // 본인 계획/실적 작성은 "내 평가"(/evaluation/mine), 담당 피평가자 등급 부여는
  // "평가 검토"(/evaluation/team)로 화면 자체를 분리했다 — 권한 분기로 한 화면에서
  // 여러 역할을 보여주지 않는다(평가 정보는 민감해서 화면 단위로 통제).
  const loadBootstrap = async () => {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/evaluation/bootstrap`, { headers });
    const data = await res.json();
    setCompanyId(data.company_id || null);
    setCycle(data.cycle || null);
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

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/dashboard" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <span className="text-[#0a0a0a] text-base font-bold">평가관리자</span>
          <div className="w-8" />
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-5">
          <div className="text-[#0a0a0a] text-xs font-bold mb-1">진행 중인 평가</div>
          <div className="text-[#6b6b6b] text-xs">{cycle ? cycle.name : "진행 중인 평가가 없어요"}</div>
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
