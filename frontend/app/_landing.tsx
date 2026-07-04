import Link from "next/link";
import AuthRedirect from "./_auth-redirect";
import AppPreview from "./_app-preview";

export default function Landing() {
  return (
    <main style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif" }} className="min-h-screen bg-white text-[#0a0a0a]">
      <AuthRedirect />

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
          연차·출장·팀 관리까지, WorkPing이 다 해드립니다.
        </p>
        <Link href="/login">
          <button className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-4 px-10 rounded-xl text-sm transition-all shadow-[0_8px_32px_rgba(91,94,244,0.3)]">
            무료로 시작하기 →
          </button>
        </Link>
        <p className="text-[#a0a0a0] text-xs mt-3">
          🔒 이름 · 이메일만 있으면 돼요. 개인정보 걱정 없이 시작하세요.
        </p>
        {/* 기능 뱃지 */}
        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {[
            { icon: "📍", label: "GPS 출퇴근" },
            { icon: "🏖️", label: "연차 관리" },
            { icon: "✈️", label: "출장 관리" },
            { icon: "📅", label: "달력 시각화" },
            { icon: "👑", label: "팀장 승인" },
            { icon: "🔐", label: "권한 관리" },
            { icon: "📥", label: "엑셀 다운로드" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 bg-white border border-[#e5e5e5] rounded-full px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-sm">{icon}</span>
              <span className="text-[#0a0a0a] text-xs font-semibold">{label}</span>
            </div>
          ))}
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
            { icon: "🏖️", title: "연차 사용 촉진 의무화", desc: "연차 미사용 수당 지급 분쟁 증가 추세" },
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
        <AppPreview />
      </section>

      {/* 기능 소개 */}
      <section className="px-6 py-14 bg-[#f8f8f8]">
        <div className="text-center mb-8">
          <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-2">Features</div>
          <h3 className="text-2xl font-black tracking-tight">필요한 건 다 있어요</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "📍", title: "GPS 출퇴근", desc: "위치 기반 정확한 출퇴근 기록" },
            { icon: "🏢", title: "출근 구역 설정", desc: "지정된 구역 내에서만 출퇴근 가능, 도로명 주소로 등록" },
            { icon: "🏠", title: "재택근무 관리", desc: "직원별 재택 주소 등록, 재택 출퇴근 자동 감지 및 표시" },
            { icon: "📊", title: "근무 리포트", desc: "주간·월간 자동 리포트 생성" },
            { icon: "📥", title: "엑셀 다운로드", desc: "급여 계산용 데이터 즉시 추출" },
            { icon: "🏖️", title: "연차 관리", desc: "연차 신청·승인·잔여일수 관리" },
            { icon: "✈️", title: "출장 관리", desc: "출장 신청·취소·팀장 승인까지 한 곳에서" },
            { icon: "📅", title: "달력 시각화", desc: "연차·출장을 달력에서 색상 띠로 한눈에" },
            { icon: "👑", title: "팀장 권한", desc: "팀장이 직접 연차·출장 승인·반려 처리" },
            { icon: "🔐", title: "권한 관리", desc: "직원별 화면 접근 권한 개별 설정" },
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
      <section className="px-6 py-14">
        <div className="text-center mb-8">
          <div className="text-[#a0a0a0] text-xs uppercase tracking-widest mb-2">Pricing</div>
          <h3 className="text-2xl font-black tracking-tight">합리적인 요금제</h3>
        </div>
        <div className="space-y-4">
          {[
            {
              name: "무료", price: "0원", period: "",
              highlight: true,
              badge: "모든 기능 무료",
              features: ["직원 30명 이하", "GPS 출퇴근 · 출근 구역 설정", "엑셀 다운로드 · 주간·월간 리포트", "연차·출장 관리 (신청·승인·달력 시각화)", "재택근무 관리 · 팀 관리 · 권한 관리"],
            },
            {
              name: "유료", price: "50,000원", period: "/ 월(회사별)",
              highlight: false, badge: undefined,
              features: ["직원 31명 이상", "무료 기능 전체 포함", "사내 시스템 API 연동 지원", "급여·ERP 등 사내 시스템 연동", "우선 고객 지원"],
            },
            {
              name: "비즈니스", price: "협의", period: "/ 월",
              highlight: false,
              features: ["직원 무제한", "유료 기능 전체", "전담 고객 지원"],
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
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${plan.highlight ? "bg-white/20 text-white" : "bg-[#f0f0ff] text-[#5b5ef4]"}`}>{plan.badge}</span>
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
        <p className="text-[#a0a0a0] text-xs mt-3 text-center">
          🔒 이름 · 이메일만 있으면 돼요. 개인정보 걱정 없이 시작하세요.
        </p>
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
