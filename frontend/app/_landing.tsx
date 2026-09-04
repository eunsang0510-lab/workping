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
        <div className="flex flex-col items-center gap-3">
          <Link href="/login">
            <button className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-4 px-10 rounded-xl text-sm transition-all shadow-[0_8px_32px_rgba(91,94,244,0.3)]">
              무료로 시작하기 →
            </button>
          </Link>
          <a
            href="https://play.google.com/store/apps/details?id=com.workping.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#222] text-white font-bold py-3 px-6 rounded-xl text-sm transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76c.3.17.64.24.98.2l.1-.02L13 15.12l-2.98-2.98-6.84 11.62zm16.26-10.4L16.7 11.7 13.41 15l3.29 3.29 2.77-1.58a1.75 1.75 0 0 0 0-3.35zM2.54.28A1.75 1.75 0 0 0 2 1.6v20.8c0 .48.19.92.54 1.32L2.64 23.9 13.12 13.4v-.24L2.64.12l-.1.16zm10.28 11.84L4.26.36l.1-.02c.34-.04.68.03.98.2L16.57 7.2l-3.75 4.92z"/></svg>
            Google Play에서 설치
          </a>
          <p className="text-[#a0a0a0] text-xs mt-1">
            iOS는 준비중이에요. iOS에서는 브라우저로 접속해 이용해 주세요.
            <br />
            <a
              href="https://workping-kappa.vercel.app"
              className="text-[#5b5ef4] hover:underline break-all"
            >
              https://workping-kappa.vercel.app
            </a>
          </p>
          <p className="text-[#a0a0a0] text-xs mt-1">
            PC에서도 같은 화면 그대로 접속해서 이용할 수 있어요.
          </p>
        </div>
        <p className="text-[#a0a0a0] text-xs mt-3">
          🔒 이름 · 이메일만 있으면 돼요. 개인정보 걱정 없이 시작하세요.
        </p>
        {/* 기능 뱃지 */}
        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {[
            { icon: "📍", label: "GPS 출퇴근" },
            { icon: "🎙️", label: "AI 회의록" },
            { icon: "🔁", label: "재출근/재퇴근" },
            { icon: "🚶", label: "외출/복귀" },
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

      {/* AI 회의록 스포트라이트 */}
      <section className="px-6 py-14">
        <div className="relative overflow-hidden bg-[#5b5ef4] rounded-3xl p-8 text-center text-white">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 mb-5">
              <span className="text-[11px] font-bold tracking-wide">🆕 NEW · BETA</span>
            </div>
            <div className="text-4xl mb-4">🎙️</div>
            <h3 className="text-2xl font-black leading-tight mb-4">
              회의록 작성은 이제<br />AI에게 맡기세요
            </h3>
            <p className="text-white/85 text-sm leading-relaxed max-w-sm mx-auto mb-1">
              버튼 하나로 녹음을 시작하면 끝이에요.<br />
              회의가 끝나면 AI가 핵심 내용을 요약하고,<br />
              실행할 일까지 목록으로 정리해드려요.
            </p>
            <p className="text-white/70 text-xs mt-4">
              🔒 녹음 파일은 내 기기에만 저장되고 서버엔 남지 않아요
            </p>
            <p className="text-white/70 text-xs mt-1">
              베타 기간 동안 계정당 월 3회 무료로 사용해보세요
            </p>
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
            { icon: "🎙️", title: "AI 회의록 (베타)", desc: "녹음하면 AI가 요약·할 일 목록까지 자동 정리" },
            { icon: "🏢", title: "출근 구역 설정", desc: "지정된 구역 내에서만 출퇴근 가능, 도로명 주소로 등록" },
            { icon: "🏠", title: "재택근무 관리", desc: "직원별 재택 주소 등록, 재택 출퇴근 자동 감지 및 표시" },
            { icon: "🔁", title: "재출근/재퇴근", desc: "퇴근 후 추가 근무 시 재출근, 팀장 승인 후 근무시간 반영" },
            { icon: "🚶", title: "외출/복귀", desc: "근무 중 외출·복귀 기록, 외출시간은 근무시간에서 자동 제외" },
            { icon: "📊", title: "근무 리포트", desc: "주간·월간 자동 리포트 생성" },
            { icon: "📈", title: "근로시간 패턴 알림", desc: "매주 AI가 근무 추이를 분석해 주·월 최대 근로시간 초과가 예상되면 본인·팀장에게 자동 알림" },
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

      {/* 푸터 */}
      <footer className="px-6 py-8 border-t border-[#e5e5e5] text-center">
        <h1 className="text-lg font-black mb-2">
          Work<span className="text-[#5b5ef4]">Ping</span>
        </h1>
        <p className="text-[#a0a0a0] text-xs mb-3">GPS 기반 스마트 근태관리 서비스</p>
        <a
          href="https://play.google.com/store/apps/details?id=com.workping.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[#a0a0a0] text-xs hover:text-[#5b5ef4] transition-colors mb-4"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76c.3.17.64.24.98.2l.1-.02L13 15.12l-2.98-2.98-6.84 11.62zm16.26-10.4L16.7 11.7 13.41 15l3.29 3.29 2.77-1.58a1.75 1.75 0 0 0 0-3.35zM2.54.28A1.75 1.75 0 0 0 2 1.6v20.8c0 .48.19.92.54 1.32L2.64 23.9 13.12 13.4v-.24L2.64.12l-.1.16zm10.28 11.84L4.26.36l.1-.02c.34-.04.68.03.98.2L16.57 7.2l-3.75 4.92z"/></svg>
          Google Play에서 설치
        </a>
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
