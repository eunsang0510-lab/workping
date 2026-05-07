"use client";

import Link from "next/link";

export default function DeleteAccount() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 max-w-lg mx-auto">
      <h1 className="text-2xl font-black text-[#0a0a0a] mb-2">
        Work<span className="text-[#5b5ef4]">Ping</span> 계정 삭제
      </h1>
      <p className="text-[#6b6b6b] text-sm mb-8">
        계정 및 관련 데이터 삭제 요청 안내
      </p>

      <div className="space-y-6">
        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-5">
          <div className="text-[#ef4444] font-bold text-sm mb-2">⚠️ 삭제 전 확인사항</div>
          <ul className="text-[#6b6b6b] text-xs space-y-1">
            <li>• 계정 삭제 시 모든 출퇴근 기록이 영구 삭제됩니다</li>
            <li>• 연차 신청 내역이 모두 삭제됩니다</li>
            <li>• 삭제된 데이터는 복구할 수 없습니다</li>
            <li>• 소속 회사의 근태 기록도 함께 삭제됩니다</li>
          </ul>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5">
          <div className="text-[#0a0a0a] font-bold text-sm mb-3">📧 삭제 요청 방법</div>
          <p className="text-[#6b6b6b] text-xs leading-relaxed mb-4">
            계정 삭제를 원하시면 아래 이메일로 요청해주세요.<br />
            이메일 제목: <span className="font-bold text-[#0a0a0a]">[계정삭제] 가입 이메일 주소</span><br />
            본문에 가입 시 사용한 이메일 주소를 함께 기재해주세요.
          </p>
          <a href="mailto:workpingofficial@gmail.com" className="block w-full bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-3 rounded-xl text-sm text-center transition-all">
            ✉️ 계정 삭제 요청 이메일 보내기
          </a>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5">
          <div className="text-[#0a0a0a] font-bold text-sm mb-3">🗑️ 삭제되는 데이터</div>
          <ul className="text-[#6b6b6b] text-xs space-y-2">
            <li className="flex gap-2"><span className="text-[#ef4444]">•</span> Firebase 인증 계정</li>
            <li className="flex gap-2"><span className="text-[#ef4444]">•</span> 출퇴근 기록 전체</li>
            <li className="flex gap-2"><span className="text-[#ef4444]">•</span> 연차 신청 및 잔여 내역</li>
            <li className="flex gap-2"><span className="text-[#ef4444]">•</span> 팀 소속 정보</li>
            <li className="flex gap-2"><span className="text-[#ef4444]">•</span> 공지 읽음 내역</li>
          </ul>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5">
          <div className="text-[#0a0a0a] font-bold text-sm mb-3">⏱️ 처리 기간</div>
          <p className="text-[#6b6b6b] text-xs leading-relaxed">
            요청 접수 후 <span className="font-bold text-[#0a0a0a]">영업일 기준 3일 이내</span> 처리됩니다.<br />
            처리 완료 시 요청하신 이메일로 안내드립니다.
          </p>
        </div>

        <div className="text-center">
          <Link href="/" className="text-[#5b5ef4] text-sm hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}