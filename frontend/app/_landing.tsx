"use client";

import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

function useAuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push("/dashboard");
    });
    return () => unsubscribe();
  }, [router]);
}

function AppPreview() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = ["대시보드", "달력", "리포트", "관리자"];

  const mockups = [
    // 대시보드
    <div key="dashboard" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">👤</div>
      </div>
      {/* 메인 카드 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">4월 23일 (수)</div>
            <div className="text-[#0a0a0a] text-3xl font-black tracking-tight">6h 42m</div>
            <div className="text-[#6b6b6b] text-xs mt-1">📍 강남구 테헤란로 427</div>
          </div>
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-2 py-1">
            <span className="text-[#16a34a] text-xs font-bold">근무중</span>
          </div>
        </div>
        <div className="flex gap-4 pt-3 border-t border-[#e5e5e5]">
          {[["출근", "09:15", "#16a34a"], ["퇴근", "--:--", "#a0a0a0"], ["위치", "강남구", "#6b6b6b"]].map(([label, val, color]) => (
            <div key={label}>
              <div className="text-[#a0a0a0] text-xs mb-0.5">{label}</div>
              <div className="text-xs font-bold" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
      {/* 버튼 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#5b5ef4] rounded-xl py-3 text-center text-white text-xs font-bold shadow-[0_4px_12px_rgba(91,94,244,0.3)]">📍 출근하기</div>
        <div className="bg-white border border-[#e5e5e5] rounded-xl py-3 text-center text-[#6b6b6b] text-xs font-bold">🏠 퇴근하기</div>
      </div>
      {/* 오늘의 기록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">오늘의 기록</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#16a34a]" />
            <div>
              <div className="text-[#0a0a0a] text-xs font-medium">출근</div>
              <div className="text-[#6b6b6b] text-xs">09:15 · 강남구 테헤란로 427</div>
            </div>
          </div>
        </div>
      </div>
      {/* 하단 메뉴 */}
      <div className="grid grid-cols-2 gap-2">
        {[["📊", "리포트", "주간/월간"], ["🗓️", "달력", "근로 기록"]].map(([icon, title, sub]) => (
          <div key={title} className="bg-white border border-[#e5e5e5] rounded-xl p-3 flex items-center gap-2 shadow-sm">
            <span className="text-base">{icon}</span>
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold">{title}</div>
              <div className="text-[#6b6b6b] text-xs">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,

    // 달력
    <div key="calendar" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7" />
      </div>
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#6b6b6b] text-sm">‹</span>
          <span className="text-[#0a0a0a] font-black text-sm">2025년 4월</span>
          <span className="text-[#6b6b6b] text-sm">›</span>
        </div>
        {/* 요일 */}
        <div className="grid grid-cols-7 mb-1">
          {["일","월","화","수","목","금","토"].map((w, i) => (
            <div key={w} className={`text-center text-xs font-bold py-1 ${i===0?"text-[#ef4444]":i===6?"text-[#5b5ef4]":"text-[#a0a0a0]"}`}>{w}</div>
          ))}
        </div>
        {/* 날짜 */}
        <div className="grid grid-cols-7 gap-y-1">
          {[null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,null].map((d, i) => (
            <div key={i} className={`
              relative mx-auto flex flex-col items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold
              ${d===23?"bg-[#5b5ef4] text-white shadow-sm":d===null?"":"text-[#0a0a0a]"}
              ${i%7===0&&d?"text-[#ef4444]":""}
              ${i%7===6&&d?"text-[#5b5ef4]":""}
              ${d===23?"text-white":""}
            `}>
              {d}
              {[2,3,7,8,9,10,14,15,16,17,18,21,22,23].includes(d as number) && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${d===23?"bg-white":"bg-[#5b5ef4]"}`} />
              )}
            </div>
          ))}
        </div>
      </div>
      {/* 선택된 날짜 기록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">2025-04-23 근로 기록</div>
        <div className="bg-[#f8f8f8] rounded-xl p-3 flex items-center justify-between mb-3">
          <div className="text-[#6b6b6b] text-xs">총 근무시간</div>
          <div className="text-[#5b5ef4] text-lg font-black">8h 30m</div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-[#16a34a] mt-1 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="text-xs font-bold text-[#0a0a0a]">출근</span>
                <span className="text-xs font-bold text-[#16a34a]">09:00</span>
              </div>
              <div className="text-[#6b6b6b] text-xs">📍 강남구 테헤란로 427</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-[#ef4444] mt-1 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="text-xs font-bold text-[#0a0a0a]">퇴근</span>
                <span className="text-xs font-bold text-[#ef4444]">17:30</span>
              </div>
              <div className="text-[#6b6b6b] text-xs">📍 강남구 테헤란로 427</div>
            </div>
          </div>
        </div>
      </div>
    </div>,

    // 리포트
    <div key="report" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7" />
      </div>
      {/* 탭 */}
      <div className="flex bg-white border border-[#e5e5e5] rounded-xl p-1 mb-3 shadow-sm">
        {["주간", "월간"].map((t, i) => (
          <div key={t} className={`flex-1 text-center text-xs font-bold py-1.5 rounded-lg ${i===0?"bg-[#5b5ef4] text-white":"text-[#a0a0a0]"}`}>{t}</div>
        ))}
      </div>
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["총 근무", "42h 30m", "#5b5ef4"], ["근무일수", "5일", "#16a34a"], ["평균", "8h 30m", "#f59e0b"]].map(([label, val, color]) => (
          <div key={label} className="bg-white border border-[#e5e5e5] rounded-xl p-3 text-center shadow-sm">
            <div className="text-[#a0a0a0] text-xs mb-1">{label}</div>
            <div className="font-black text-sm" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>
      {/* 일별 기록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">일별 기록</div>
        <div className="space-y-2">
          {[
            ["04/23 (수)", "09:00", "17:30", "8h 30m"],
            ["04/22 (화)", "09:10", "18:00", "8h 50m"],
            ["04/21 (월)", "08:55", "17:25", "8h 30m"],
            ["04/18 (금)", "09:05", "17:35", "8h 30m"],
            ["04/17 (목)", "09:00", "18:10", "9h 10m"],
          ].map(([date, ci, co, wh]) => (
            <div key={date} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
              <div className="text-[#6b6b6b] text-xs">{date}</div>
              <div className="flex gap-3 text-xs">
                <span className="text-[#16a34a] font-medium">{ci}</span>
                <span className="text-[#a0a0a0]">→</span>
                <span className="text-[#ef4444] font-medium">{co}</span>
              </div>
              <div className="text-[#5b5ef4] text-xs font-bold">{wh}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,

    // 관리자
    <div key="admin" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7" />
      </div>
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["전체", "12명", "#0a0a0a"], ["출근중", "8명", "#16a34a"], ["미출근", "4명", "#ef4444"]].map(([label, val, color]) => (
          <div key={label} className="bg-white border border-[#e5e5e5] rounded-xl p-3 text-center shadow-sm">
            <div className="text-[#a0a0a0] text-xs mb-1">{label}</div>
            <div className="font-black text-sm" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>
      {/* 팀원 목록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">오늘 근태 현황</div>
        <div className="space-y-2">
          {[
            ["김민준", "09:05", "근무중", "#16a34a", "#f0fdf4", "#bbf7d0"],
            ["이서연", "08:50", "근무중", "#16a34a", "#f0fdf4", "#bbf7d0"],
            ["박지호", "09:20", "근무중", "#16a34a", "#f0fdf4", "#bbf7d0"],
            ["최수아", "--:--", "미출근", "#ef4444", "#fff1f2", "#fecdd3"],
            ["정우진", "09:00", "퇴근", "#6b6b6b", "#f8f8f8", "#e5e5e5"],
            ["한예린", "08:45", "근무중", "#16a34a", "#f0fdf4", "#bbf7d0"],
          ].map(([name, time, status, color, bg, border]) => (
            <div key={name} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#f0f0ff] rounded-full flex items-center justify-center text-xs font-bold text-[#5b5ef4]">
                  {(name as string)[0]}
                </div>
                <div>
                  <div className="text-[#0a0a0a] text-xs font-bold">{name}</div>
                  <div className="text-[#a0a0a0] text-xs">{time}</div>
                </div>
              </div>
              <div className="px-2 py-0.5 rounded-lg text-xs font-bold border" style={{ color, backgroundColor: bg, borderColor: border }}>
                {status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
  ];

  return (
    <div>
      {/* 탭 버튼 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === i
                ? "bg-[#5b5ef4] text-white shadow-[0_4px_12px_rgba(91,94,244,0.3)]"
                : "bg-white border border-[#e5e5e5] text-[#6b6b6b] hover:border-[#5b5ef4]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 목업 */}
      <div className="max-w-xs mx-auto shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-3xl">
        {mockups[activeTab]}
      </div>
    </div>
  );
}

import { useState } from "react";
import Link from "next/link";

export default function Landing() {
  useAuthRedirect();
  return (
    <main style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif" }} className="min-h-screen bg-white text-[#0a0a0a]">

      {/* 네비게이션 */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-[#e5e5e5]">
        <h1 className="text-xl font-black tracking-tight">
          Work<span className="text-[#5b5ef4]">Ping</span>
        </h1>
      </nav>

      {/* 히어로 */}
      <section className="px-6 pt-16 pb-12 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(91,94,244,0.08)_0%,transparent_70%)] pointer-events-none" />

        <div className="inline-flex items-center gap-2 bg-[#f0f0ff] border border-[#c7c8fa] rounded-full px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5b5ef4] inline-block" />
          <span className="text-[#4a4de0] text-xs font-semibold">포괄임금제 폐지 시대의 필수 솔루션</span>
        </div>

        <h2 className="text-4xl font-black leading-tight tracking-tight mb-5">
          GPS 기반<br />
          <span className="text-[#5b5ef4]">스마트 근태관리</span>
        </h2>

        <p className="text-[#6b6b6b] text-sm leading-relaxed mb-8">
          출퇴근 버튼 하나로 근로시간을 정확히 기록하세요.<br />
          포괄임금제 폐지 시대, WorkPing이 준비해드립니다.
        </p>

        <Link href="/login">
          <button className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-4 px-10 rounded-xl text-sm transition-all shadow-[0_8px_32px_rgba(91,94,244,0.3)]">
            무료로 시작하기 →
          </button>
        </Link>

        {/* 앱 미리보기 */}
        <div className="mx-auto mt-12 max-w-xs bg-[#f4f4f8] border border-[#e5e5e5] rounded-3xl p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">4월 22일 (화)</div>
              <div className="text-[#0a0a0a] text-3xl font-black tracking-tight">3h 42m</div>
            </div>
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-3 py-1">
              <span className="text-[#16a34a] text-xs font-bold">근무중</span>
            </div>
          </div>
          <div className="flex gap-5 border-t border-[#e5e5e5] pt-3 mb-4">
            {[["출근", "09:15", "#16a34a"], ["퇴근", "--:--", "#a0a0a0"], ["위치", "강남구", "#6b6b6b"]].map(([label, val, color]) => (
              <div key={label}>
                <div className="text-[#a0a0a0] text-xs mb-1">{label}</div>
                <div className="text-xs font-bold" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#5b5ef4] rounded-xl py-3 text-center text-white text-xs font-bold">📍 출근하기</div>
            <div className="bg-[#f0f0f0] rounded-xl py-3 text-center text-[#a0a0a0] text-xs font-bold">🏠 퇴근하기</div>
          </div>
        </div>
      </section>

      {/* 문제 제기 */}
      <section className="px-6 py-14 bg-[#f8f8f8]">
        <div className="text-center mb-8">
          <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-2">지금 대한민국은</div>
          <h3 className="text-2xl font-black tracking-tight">포괄임금제 폐지가<br />논의되고 있습니다</h3>
        </div>
        <div className="space-y-3">
          {[
            { icon: "⚠️", title: "근로시간 기록 의무화", desc: "정확한 출퇴근 기록이 법적 의무가 됩니다" },
            { icon: "📋", title: "초과근무 수당 지급", desc: "기록 없이는 분쟁 시 회사가 불리합니다" },
            { icon: "🔍", title: "노동청 감독 강화", desc: "근태 기록 미비 시 과태료 부과 대상" },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 flex items-start gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="text-[#0a0a0a] font-bold text-sm mb-1">{item.title}</div>
                <div className="text-[#6b6b6b] text-xs leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    {/* 앱 화면 미리보기 */}
      <section className="px-6 py-14">
        <div className="text-center mb-8">
          <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-2">Preview</div>
          <h3 className="text-2xl font-black tracking-tight">이렇게 사용해요</h3>
        </div>

        {/* 탭 */}
        <AppPreview />
      </section>
      {/* 기능 소개 */}
      <section className="px-6 py-14">
        <div className="text-center mb-8">
          <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-2">Features</div>
          <h3 className="text-2xl font-black tracking-tight">필요한 건 다 있어요</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "📍", title: "GPS 출퇴근", desc: "위치 기반 정확한 출퇴근 기록" },
            { icon: "🏢", title: "출근 구역 설정", desc: "지정된 구역내에서 출퇴근 기능 동작" },
            { icon: "📊", title: "근무 리포트", desc: "주간·월간 자동 리포트 생성" },
            { icon: "📥", title: "엑셀 다운로드", desc: "급여 계산용 데이터 즉시 추출" },
            { icon: "👥", title: "팀 관리", desc: "관리자 페이지로 팀원 현황 파악" },
            { icon: "📱", title: "모바일 앱", desc: "스마트폰에 설치해서 사용 가능" },
            { icon: "🔗", title: "API 연동", desc: "급여·ERP 등 사내 시스템과 연동 가능" },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-[#0a0a0a] font-bold text-sm mb-1">{item.title}</div>
              <div className="text-[#6b6b6b] text-xs leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 요금제 */}
      <section className="px-6 py-14 bg-[#f8f8f8]">
        <div className="text-center mb-8">
          <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-2">Pricing</div>
          <h3 className="text-2xl font-black tracking-tight">합리적인 요금제</h3>
        </div>
        <div className="space-y-4">
          {[
                  {
                    name: "무료", price: "0원", period: "",
                    highlight: false,
                    features: ["직원 10명 이하", "기본 출퇴근 기록", "오늘 근태 현황"],
                  },
                  {
                    name: "스타터", price: "50,000원", period: "/ 월(회사별)",
                    highlight: true, badge: "인기",
                    features: ["직원 20명 이하", "출근 구역 설정", "엑셀 다운로드", "주간·월간 리포트", "사내 시스템 API 연동 지원", "급여 시스템 연동 지원"],
                  },
                  {
                    name: "비즈니스", price: "협의", period: "/ 월",
                    highlight: false,
                    features: ["직원 무제한", "스타터 기능 전체", "사내 시스템 API 연동 지원", "급여 시스템 연동 지원", "우선 고객 지원"],
                  },
          ].map((plan, i) => (
            <div key={i} className={`rounded-2xl p-5 border-2 ${
              plan.highlight
                ? "bg-[#5b5ef4] border-[#5b5ef4] shadow-[0_8px_32px_rgba(91,94,244,0.3)]"
                : "bg-white border-[#e5e5e5] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`font-black text-base ${plan.highlight ? "text-white" : "text-[#0a0a0a]"}`}>{plan.name}</div>
                {plan.badge && (
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{plan.badge}</span>
                )}
              </div>
              <div className="flex items-end gap-1 mb-4">
                <span className={`text-3xl font-black tracking-tight ${plan.highlight ? "text-white" : "text-[#0a0a0a]"}`}>{plan.price}</span>
                <span className={`text-sm mb-1 ${plan.highlight ? "text-white/70" : "text-[#6b6b6b]"}`}>{plan.period}</span>
              </div>
              <div className="space-y-2">
                {plan.features.map((f, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className={`text-xs ${plan.highlight ? "text-white/80" : "text-[#16a34a]"}`}>✓</span>
                    <span className={`text-sm ${plan.highlight ? "text-white/90" : "text-[#6b6b6b]"}`}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Link href="/login">
          <button className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-4 rounded-xl text-sm mt-6 transition-all shadow-[0_8px_32px_rgba(91,94,244,0.3)]">
            지금 무료로 시작하기 →
          </button>
        </Link>
      </section>

      {/* 푸터 */}
      <footer className="px-6 py-8 border-t border-[#e5e5e5] text-center">
        <h1 className="text-lg font-black mb-2">
          Work<span className="text-[#5b5ef4]">Ping</span>
        </h1>
        <p className="text-[#a0a0a0] text-xs mb-3">GPS 기반 스마트 근태관리 서비스</p>
        <div className="flex items-center justify-center gap-4 mb-3">
          <Link href="/terms" className="text-[#a0a0a0] text-xs hover:text-[#5b5ef4] transition-colors">서비스 이용약관</Link>
          <span className="text-[#e5e5e5]">|</span>
          <Link href="/privacy" className="text-[#a0a0a0] text-xs hover:text-[#5b5ef4] transition-colors">개인정보처리방침</Link>
        </div>
        <p className="text-[#a0a0a0] text-xs">© 2026 WorkPing. All rights reserved.</p>
      </footer>

    </main>
  );
}