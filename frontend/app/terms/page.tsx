import Link from "next/link";

export default function TermsPage() {
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
        <h1 className="text-2xl font-black text-[#0a0a0a] mb-2">서비스 이용약관</h1>
        <p className="text-[#a0a0a0] text-sm mb-10">시행일: 2026년 5월 1일</p>

        <div className="space-y-10 text-[#3a3a3a] text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제1조 (목적)</h2>
            <p>이 약관은 WorkPing(이하 "서비스")이 제공하는 GPS 기반 근태관리 서비스의 이용과 관련하여 서비스와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제2조 (정의)</h2>
            <ul className="space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li><span className="font-medium text-[#0a0a0a]">"서비스"</span>란 WorkPing이 제공하는 GPS 기반 출퇴근 기록, 근태 관리, 리포트 기능 일체를 말합니다.</li>
              <li><span className="font-medium text-[#0a0a0a]">"이용자"</span>란 이 약관에 따라 서비스를 이용하는 회원을 말합니다.</li>
              <li><span className="font-medium text-[#0a0a0a]">"관리자"</span>란 회사를 등록하고 소속 직원의 근태를 관리하는 이용자를 말합니다.</li>
              <li><span className="font-medium text-[#0a0a0a]">"직원"</span>이란 관리자가 등록한 소속 구성원을 말합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제3조 (약관의 효력 및 변경)</h2>
            <p className="text-[#6b6b6b]">이 약관은 서비스를 이용하는 모든 이용자에게 적용되며, 약관이 변경되는 경우 서비스 공지사항 또는 이메일을 통해 사전에 안내합니다. 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제4조 (서비스 이용)</h2>
            <ul className="space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>서비스는 인터넷 접속이 가능한 기기 및 스마트폰을 통해 이용할 수 있습니다.</li>
              <li>GPS 기능이 활성화된 환경에서 출퇴근 기록이 정상적으로 저장됩니다.</li>
              <li>무료 플랜은 직원 10명 이하의 회사에서 기본 기능을 제공합니다.</li>
              <li>유료 플랜은 가입 후 결제가 완료된 시점부터 해당 기능이 활성화됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제5조 (요금제 및 결제)</h2>
            <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 space-y-3 text-[#6b6b6b] mb-3">
              <div className="flex justify-between">
                <span className="font-medium text-[#0a0a0a]">무료</span>
                <span>0원 / 직원 10명 이하</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-[#0a0a0a]">스타터</span>
                <span>50,000원 / 월 (회사별)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-[#0a0a0a]">비즈니스</span>
                <span>별도 협의</span>
              </div>
            </div>
            <ul className="space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>결제는 토스페이먼츠를 통해 처리됩니다.</li>
              <li>구독 기간은 결제일로부터 30일입니다.</li>
              <li>구독 만료 후 자동 갱신되지 않으며, 재결제 시 서비스가 재개됩니다.</li>
              <li>환불은 결제일로부터 7일 이내 미사용 시 전액 환불 가능합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제6조 (이용자의 의무)</h2>
            <ul className="space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>이용자는 실제 본인의 출퇴근 정보만을 기록해야 하며, 허위 기록을 입력해서는 안 됩니다.</li>
              <li>타인의 계정을 도용하거나 서비스를 부정한 방법으로 이용해서는 안 됩니다.</li>
              <li>서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.</li>
              <li>관련 법령 및 이 약관의 규정을 준수해야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제7조 (서비스의 제한 및 중단)</h2>
            <p className="text-[#6b6b6b]">서비스는 다음의 경우 서비스 제공을 제한하거나 중단할 수 있습니다.</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>시스템 정기점검, 증설 및 교체를 위해 부득이한 경우</li>
              <li>이용자가 이 약관의 의무를 위반한 경우</li>
              <li>천재지변, 국가비상사태 등 불가항력적인 사유가 있는 경우</li>
              <li>유료 구독이 만료된 경우 (유료 기능 제한)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제8조 (면책조항)</h2>
            <ul className="space-y-2 list-disc list-inside text-[#6b6b6b]">
              <li>서비스는 GPS 정확도에 따라 위치 정보가 다를 수 있으며, 이로 인한 분쟁에 대해 책임을 지지 않습니다.</li>
              <li>이용자 간 또는 이용자와 제3자 사이에서 발생한 분쟁에 대해 서비스는 개입하지 않습니다.</li>
              <li>서비스는 천재지변 또는 이에 준하는 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제9조 (분쟁해결)</h2>
            <p className="text-[#6b6b6b]">서비스 이용과 관련하여 분쟁이 발생한 경우 서비스와 이용자는 분쟁을 원만하게 해결하기 위해 필요한 모든 노력을 하여야 합니다. 분쟁이 해결되지 않는 경우 관할법원은 민사소송법에 따릅니다.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-[#0a0a0a] mb-3">제10조 (문의)</h2>
            <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 text-[#6b6b6b]">
              <p>서비스 이용 관련 문의는 아래 이메일로 연락주세요.</p>
              <p className="mt-2"><span className="font-medium text-[#0a0a0a]">이메일:</span> eunsang0510@gmail.com</p>
            </div>
          </section>

        </div>
      </div>

      <footer className="px-6 py-8 border-t border-[#e5e5e5] text-center mt-10">
        <Link href="/terms" className="text-[#a0a0a0] text-xs hover:underline mr-4">서비스 이용약관</Link>
        <Link href="/privacy" className="text-[#5b5ef4] text-xs hover:underline">개인정보처리방침</Link>
      </footer>
    </main>
  );
}