"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";

interface ManualItem {
  icon: string;
  title: string;
  points: string[];
}

const GENERAL_ITEMS: ManualItem[] = [
  {
    icon: "🏠",
    title: "대시보드 · 출퇴근",
    points: [
      '대시보드에서 "📍 출근하기" 버튼을 누르면 GPS 위치를 확인해 출근을 기록해요.',
      "회사가 등록한 출근 위치 반경 안에 있어야 출근 처리돼요. 회사가 위치를 하나도 등록하지 않았다면 어디서든 출근할 수 있어요.",
      "재택근무 주소가 등록돼 있다면 그 주소 반경 300m 안에서는 '재택 출근'으로 인정돼요.",
      '퇴근할 때는 "🏠 퇴근하기" 버튼을 눌러요.',
      '오늘 승인된 연차(종일)가 있는 날은 출퇴근 버튼이 비활성화되고 "🏖️ 연차"로 표시돼요.',
      '"오늘의 기록" 영역에서 오늘 출퇴근 시간과 위치를 확인할 수 있어요.',
      "이번 주 누적 근무시간이 표시되고, 주 52시간을 넘기면 경고가 떠요.",
      "우측 상단 👤 메뉴에서 비밀번호 변경, 로그아웃을 할 수 있어요. 임시 비밀번호로 처음 로그인했다면 비밀번호를 반드시 변경해야 다음 화면으로 진행돼요.",
      "🔔 알림 아이콘에서 나에게 온 알림을 확인하고 한 번에 읽음 처리할 수 있어요.",
    ],
  },
  {
    icon: "🏖️",
    title: "연차 관리",
    points: [
      "회사가 연차 기능을 켠 경우에만 메뉴가 보여요.",
      '"연차관리" 메뉴에서 올해 부여된 연차, 사용한 연차, 남은 연차를 확인할 수 있어요.',
      '"+ 연차 신청"으로 반차 또는 연차(시작일~종료일)를 신청해요. 사유는 선택 입력이에요.',
      "이미 신청했거나 승인된 기간과 겹치면 신청이 제한돼요.",
      "회사 설정에 따라 신청 즉시 승인되거나, 팀장/관리자 승인을 받아야 확정돼요.",
      "신청 상태는 대기중 · 승인 · 취소신청중 · 취소됨 · 반려로 표시돼요.",
      '대기중인 신청은 "신청취소"로 바로 취소할 수 있고, 이미 승인된 연차는 "취소신청" 후 팀장/관리자 승인을 받아야 취소돼요.',
    ],
  },
  {
    icon: "✈️",
    title: "출장 신청",
    points: [
      "출장지, 출발일, 복귀일(필수)과 출장 목적(선택)을 입력해 신청해요.",
      "신청 후 팀장/관리자 승인이 필요해요. 상태는 연차와 동일하게 대기중 · 승인 · 취소신청중 · 취소됨 · 반려로 표시돼요.",
      "반려된 경우 반려 사유를 확인할 수 있어요.",
      "대기중 신청은 즉시 취소할 수 있고, 승인된 신청은 취소신청 후 승인을 받아야 취소돼요.",
    ],
  },
  {
    icon: "🗓️",
    title: "근무 달력",
    points: [
      "나의 출퇴근 기록과 승인된 연차(초록), 출장(주황)을 한 달 단위로 확인할 수 있어요.",
      "날짜를 클릭하면 그날의 출퇴근 시간·위치, 연차·출장 상세 내용을 볼 수 있어요.",
    ],
  },
  {
    icon: "📊",
    title: "리포트",
    points: [
      "주간/월간 단위로 나의 근무시간 합계와 하루하루의 출퇴근 기록을 확인할 수 있어요.",
      "월간 보기에서는 출근일수와 일 평균 근무시간도 함께 보여줘요.",
    ],
  },
  {
    icon: "📢",
    title: "공지사항",
    points: [
      "회사 공지와 시스템 공지를 모아볼 수 있어요. 안 읽은 공지는 로그인 시 팝업으로 먼저 보여줘요.",
      "공지를 열람하면 자동으로 읽음 처리돼요.",
    ],
  },
];

const MANAGER_ITEMS: ManualItem[] = [
  {
    icon: "👑",
    title: "팀장 페이지 접근",
    points: [
      '대시보드의 "팀장 권한" 메뉴로 들어가면 내가 팀장으로 지정된 팀의 연차·출장 승인과 팀 현황을 관리할 수 있어요.',
    ],
  },
  {
    icon: "🏖️",
    title: "연차 승인",
    points: [
      '"연차" 탭에서 팀원의 연차 신청을 확인하고 "승인"/"반려"할 수 있어요.',
      '이미 승인된 연차를 취소하겠다는 "취소 신청"이 들어오면 "취소 승인"/"취소 반려"로 처리해요.',
    ],
  },
  {
    icon: "✈️",
    title: "출장 승인",
    points: [
      '"출장" 탭에서 팀원의 출장 신청을 승인/반려하고, 반려 시 사유를 남길 수 있어요.',
      "취소 신청 건도 동일하게 승인/반려로 처리해요.",
    ],
  },
  {
    icon: "📋",
    title: "근태 현황",
    points: [
      '"근태" 탭에서 오늘 팀원들의 출근중 · 퇴근 · 미출근 · 미퇴근 인원을 한눈에 확인해요.',
      "기간별(주간/월간) 팀원별 근무시간도 조회할 수 있고, 주 52시간을 초과한 팀원은 빨간 배지로 표시돼요.",
    ],
  },
  {
    icon: "📅",
    title: "현황 (연차 · 출장 이력)",
    points: [
      '"현황" 탭에서 선택한 기간 동안 팀 전체의 승인된 연차·출장 이력을 시간순으로 확인할 수 있어요.',
      '팀 생성, 팀원 추가/삭제 같은 팀 구성 관리는 "관리자" 메뉴에서만 가능해요.',
    ],
  },
];

const ADMIN_ITEMS: ManualItem[] = [
  {
    icon: "🏢",
    title: "회사 정보 · 엑셀 다운로드",
    points: [
      '"관리자" 메뉴 최상단에서 회사명, 소속 인원수를 확인하고, "📥 엑셀 다운"으로 연도/월별 출퇴근 기록을 내려받을 수 있어요.',
      "오늘 현황 요약에서 전체 직원의 출근중 · 퇴근 · 미출근 · 미퇴근 인원을 볼 수 있어요.",
    ],
  },
  {
    icon: "🏖️",
    title: "연차 제도 설정 · 관리",
    points: [
      '연차 기능을 회사 전체에 "사용중"/"미사용"으로 켜고 끌 수 있어요.',
      '"승인 필요" 옵션으로 연차 신청이 자동승인될지, 팀장/관리자 승인이 필요할지 정할 수 있어요.',
      '"신청 현황"에서 월별로 신청 건을 조회하고 승인/반려하며, "연차 현황"에서 직원별 총 부여일수를 입력해 "부여"할 수 있어요.',
    ],
  },
  {
    icon: "✈️",
    title: "출장 승인 관리",
    points: ["월별로 전체 직원의 출장 신청을 조회하고 승인/반려(사유 입력 가능)할 수 있어요."],
  },
  {
    icon: "👥",
    title: "직원 관리",
    points: [
      "직원 개별 등록: 이름/이메일/생년월일/휴대전화를 입력하고 필요 시 관리자 권한을 부여해 등록해요. 등록하면 초기 비밀번호가 자동 발급돼요.",
      '엑셀로 여러 직원을 한 번에 등록할 수도 있어요("양식 다운로드" 후 업로드).',
      "무료 플랜은 최대 100명까지만 등록할 수 있고, 초과 시 요금제 업그레이드가 필요해요.",
      '직원별로 "정보수정", "재택주소 설정"(등록 주소 반경 300m 내 재택 출퇴근 허용), "PW초기화"(임시 비밀번호 이메일 발송), "근무시간 초기화", "삭제"를 할 수 있어요.',
    ],
  },
  {
    icon: "📍",
    title: "출근 위치 관리",
    points: [
      '"+ 위치 추가"로 회사 출근 가능 위치를 등록해요. 현재 위치를 그대로 쓰거나 주소를 검색해서 등록할 수 있고, 허용 반경(m)을 지정해요.',
      "위치를 하나도 등록하지 않으면 직원은 어디서든 출근할 수 있어요.",
    ],
  },
  {
    icon: "👨‍👩‍👧‍👦",
    title: "팀 관리",
    points: [
      '"+ 팀 추가"로 팀을 만들고, 팀장 지정과 팀원 추가/제거를 관리해요.',
      "팀장으로 지정된 직원은 자동으로 팀장 권한을 갖게 돼요.",
    ],
  },
  {
    icon: "📢",
    title: "공지 작성",
    points: ["회사 전체에 보이는 공지를 작성/삭제할 수 있어요."],
  },
  {
    icon: "🔐",
    title: "권한 관리 (선택 기능)",
    points: [
      '"권한 목록 관리"에서 특정 화면(연차/출장/달력/리포트/공지/팀장 페이지 등)만 접근 가능한 커스텀 권한을 만들 수 있어요.',
      '"사용자별 권한 설정"에서 만든 권한을 특정 직원에게 부여하거나 회수할 수 있어요.',
    ],
  },
  {
    icon: "💳",
    title: "요금제 · 결제",
    points: [
      "무료 플랜은 최대 100명, 유료 플랜(100인 이상)은 별도 문의로 진행돼요.",
      '구독이 만료되면 직원들의 출퇴근 버튼이 잠기니, "결제하기"로 요금제를 갱신해주세요.',
    ],
  },
];

function ManualSection({ label, badgeColor, items, defaultOpen }: { label: string; badgeColor: string; items: ManualItem[]; defaultOpen: boolean }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${badgeColor}`}>{label}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <details key={item.title} open={defaultOpen} className="bg-white border border-[#e5e5e5] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden group">
            <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none select-none">
              <span className="text-lg">{item.icon}</span>
              <span className="text-[#0a0a0a] text-sm font-bold flex-1">{item.title}</span>
              <span className="text-[#a0a0a0] text-xs transition-transform group-open:rotate-180">▾</span>
            </summary>
            <ul className="px-4 pb-4 space-y-1.5">
              {item.points.map((p, i) => (
                <li key={i} className="text-[#6b6b6b] text-xs leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-[#a0a0a0]">
                  {p}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function ManualPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        router.push("/login");
        return;
      }
      try {
        const [adminRes, companyRes] = await Promise.all([
          fetch(`${API_URL}/api/auth/admin-check/${u.uid}`),
          fetch(`${API_URL}/api/company/my/${u.uid}`),
        ]);
        const adminData = await adminRes.json();
        const companyData = await companyRes.json();
        setIsAdmin(adminData.is_admin || false);
        setIsManager(companyData.is_manager || false);
      } catch (error) {
        console.error("권한 확인 실패:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  const roleLabels = ["일반사용자", ...(isManager ? ["팀장"] : []), ...(isAdmin ? ["관리자"] : [])];

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard">
          <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            ←
          </div>
        </Link>
        <h1 className="text-[#0a0a0a] text-lg font-black">📖 사용자 매뉴얼</h1>
      </div>
      <div className="text-[#a0a0a0] text-xs mb-6 pl-12">
        내 권한: <span className="text-[#5b5ef4] font-bold">{roleLabels.join(" + ")}</span> 매뉴얼을 보여드려요
      </div>

      <ManualSection label="일반사용자 매뉴얼" badgeColor="bg-[#f0f0ff] text-[#4a4de0]" items={GENERAL_ITEMS} defaultOpen={!isManager && !isAdmin} />

      {isManager && (
        <ManualSection label="팀장 매뉴얼" badgeColor="bg-[#fef9c3] text-[#854d0e]" items={MANAGER_ITEMS} defaultOpen={!isAdmin} />
      )}

      {isAdmin && (
        <ManualSection label="관리자 매뉴얼" badgeColor="bg-[#f0fdf4] text-[#16a34a]" items={ADMIN_ITEMS} defaultOpen />
      )}
    </main>
  );
}
