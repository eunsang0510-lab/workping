// 화면 경로 → 관리자 화면에 표시할 한글 라벨
export const SCREEN_LABELS: Record<string, string> = {
  "/": "랜딩 페이지",
  "/login": "로그인",
  "/dashboard": "출퇴근 대시보드",
  "/leave": "연차 관리",
  "/business-trip": "출장 관리",
  "/calendar": "근무 달력",
  "/report": "리포트",
  "/notice": "공지사항",
  "/manager": "팀장 페이지",
  "/admin": "회사 관리자",
  "/admin/permissions": "권한 관리",
  "/admin/user-permissions": "직원 권한 배정",
  "/superadmin": "시스템 관리자",
  "/superadmin/access-logs": "접속 로그",
  "/superadmin/page-stats": "화면별 Hit 요약",
  "/pricing": "요금제",
  "/delete-account": "계정 삭제",
  "/privacy": "개인정보처리방침",
  "/terms": "이용약관",
};

export function screenLabel(path: string): string {
  return SCREEN_LABELS[path] || path;
}
