"use client";

import Link from "next/link";

export default function Landing() {
  return (
    <main style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif" }} className="min-h-screen bg-white text-[#0a0a0a]">

      {/* 네비게이션 */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-[#e5e5e5]">
        <h1 className="text-xl font-black tracking-tight">
          Work<span className="text-[#5b5ef4]">Ping</span>
        </h1>
        <Link href="/login">
          <button className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">
            무료 시작하기
          </button>
        </Link>
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

      {/* 기능 소개 */}
      <section className="px-6 py-14">
        <div className="text-center mb-8">
          <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-2">Features</div>
          <h3 className="text-2xl font-black tracking-tight">필요한 건 다 있어요</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "📍", title: "GPS 출퇴근", desc: "위치 기반 정확한 출퇴근 기록" },
            { icon: "🏢", title: "출근 구역 설정", desc: "회사 위치 벗어나면 출근 불가" },
            { icon: "📊", title: "근무 리포트", desc: "주간·월간 자동 리포트 생성" },
            { icon: "📥", title: "엑셀 다운로드", desc: "급여 계산용 데이터 즉시 추출" },
            { icon: "👥", title: "팀 관리", desc: "관리자 페이지로 팀원 현황 파악" },
            { icon: "📱", title: "모바일 앱", desc: "스마트폰에 설치해서 사용 가능" },
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
                    name: "스타터", price: "9,900원", period: "/ 월",
                    highlight: true, badge: "인기",
                    features: ["직원 20명 이하", "출근 구역 설정", "엑셀 다운로드", "주간·월간 리포트"],
                  },
                  {
                    name: "비즈니스", price: "29,900원", period: "/ 월",
                    highlight: false,
                    features: ["직원 무제한", "스타터 기능 전체", "우선 고객 지원"],
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
        <p className="text-[#a0a0a0] text-xs mb-1">GPS 기반 스마트 근태관리 서비스</p>
        <p className="text-[#a0a0a0] text-xs">© 2025 WorkPing. All rights reserved.</p>
      </footer>

    </main>
  );
}