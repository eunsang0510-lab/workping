import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8f8f8]">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-[#e5e5e5]">
        <Link href="/">
          <h1 className="text-xl font-black tracking-tight cursor-pointer">
            Work<span className="text-[#5b5ef4]">Ping</span>
          </h1>
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-black text-[#0a0a0a] mb-2">개인정보처리방침</h1>
        <p className="text-[#a0a0a0] text-sm mb-10">시행일: 2026년 5월 1일</p>

        <div className="space-y-10 text-[#3a3a3a] text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제1조 (개인정보의 처리 목적)</h2>
            <p>WorkPing(이하 "서비스")은 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>회원 가입 및 관리: 본인 확인, 서비스 제공</li>
              <li>출퇴근 기록 관리: GPS 기반 위치 정보를 활용한 출퇴근 시간 및 장소 기록</li>
              <li>근태 리포트 제공: 주간·월간 근무시간 집계 및 분석</li>
              <li>서비스 개선: 이용 현황 분석 및 서비스 품질 향상</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제2조 (처리하는 개인정보의 항목)</h2>
            <p className="mb-3">서비스는 다음의 개인정보 항목을 처리하고 있습니다.</p>
            <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 space-y-3">
              <div>
                <div className="font-bold text-[#0a0a0a] mb-1">필수 항목</div>
                <p className="text-[#6b6b6b]">이메일 주소, 이름, 출퇴근 시간, GPS 위치 정보(위도·경도 및 변환된 주소)</p>
              </div>
              <div>
                <div className="font-bold text-[#0a0a0a] mb-1">자동 수집 항목</div>
                <p className="text-[#6b6b6b]">접속 IP, 접속 시간, 서비스 이용 기록</p>
              </div>
              <div>
                <div className="font-bold text-[#0a0a0a] mb-1">결제 관련 항목</div>
                <p className="text-[#6b6b6b]">결제 정보(카드 정보는 PG사에서 처리하며 당사는 저장하지 않음), 결제 이력</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제3조 (개인정보의 처리 및 보유 기간)</h2>
            <p>서비스는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.</p>
            <div className="mt-3 bg-white border border-[#e5e5e5] rounded-xl p-4 space-y-2 text-[#6b6b6b]">
              <div className="flex justify-between"><span>회원 정보</span><span className="font-medium">회원 탈퇴 후 즉시 삭제</span></div>
              <div className="flex justify-between"><span>출퇴근 기록</span><span className="font-medium">3년 (근로기준법 기준)</span></div>
              <div className="flex justify-between"><span>결제 기록</span><span className="font-medium">5년 (전자상거래법 기준)</span></div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제4조 (개인정보의 제3자 제공)</h2>
            <p>서비스는 정보주체의 개인정보를 제1조에서 명시한 목적 범위 내에서만 처리하며, 다음의 경우에만 제3자에게 제공합니다.</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>정보주체의 별도 동의가 있는 경우</li>
              <li>법률의 특별한 규정이 있는 경우</li>
              <li>소속 회사(관리자)에게 해당 직원의 출퇴근 기록 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제5조 (개인정보 처리의 위탁)</h2>
            <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 space-y-3 text-[#6b6b6b]">
              <div className="flex justify-between items-start gap-4">
                <span className="font-medium text-[#0a0a0a] shrink-0">Firebase (Google)</span>
                <span>회원 인증 및 계정 관리</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="font-medium text-[#0a0a0a] shrink-0">Railway</span>
                <span>서버 및 데이터베이스 호스팅</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="font-medium text-[#0a0a0a] shrink-0">토스페이먼츠</span>
                <span>결제 처리</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="font-medium text-[#0a0a0a] shrink-0">카카오</span>
                <span>GPS 좌표 주소 변환</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제6조 (정보주체의 권리·의무)</h2>
            <p>정보주체는 서비스에 대해 언제든지 다음 각 호의 권리를 행사할 수 있습니다.</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>개인정보 처리 현황 열람 요구</li>
              <li>오류 등이 있는 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제7조 (개인정보의 안전성 확보조치)</h2>
            <ul className="space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>HTTPS 암호화 통신 적용</li>
              <li>데이터베이스 접근 권한 최소화</li>
              <li>Firebase Authentication을 통한 안전한 로그인 관리</li>
              <li>정기적 보안 점검 실시</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제8조 (개인정보 보호책임자)</h2>
            <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 text-[#6b6b6b]">
              <p><span className="font-medium text-[#0a0a0a]">성명:</span> 조은상</p>
              <p className="mt-1"><span className="font-medium text-[#0a0a0a]">이메일:</span> eunsang0510@gmail.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제9조 (개인정보 처리방침 변경)</h2>
            <p className="text-[#6b6b6b]">이 개인정보처리방침은 2026년 5월 1일부터 적용됩니다. 내용 추가·삭제 및 수정이 있을 시에는 시행일 7일 전부터 공지사항을 통하여 고지합니다.</p>
          </section>

        </div>
      </div>

      <footer className="px-6 py-8 border-t border-[#e5e5e5] text-center mt-10">
        <Link href="/terms" className="text-[#5b5ef4] text-xs hover:underline mr-4">서비스 이용약관</Link>
        <Link href="/privacy" className="text-[#a0a0a0] text-xs hover:underline">개인정보처리방침</Link>
      </footer>
    </main>
  );
}