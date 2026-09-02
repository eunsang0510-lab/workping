import { API_URL } from "@/lib/api";

// 시스템 관리자 여부는 하드코딩된 이메일이 아니라 서버(system_admins 테이블) 기준으로 판단한다.
// 관리자 추가/삭제는 /superadmin 화면에서 시스템 관리자가 직접 할 수 있다.
export async function checkSystemAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/system-admin-check/${userId}`);
    const data = await res.json();
    return !!data.is_system_admin;
  } catch {
    return false;
  }
}
