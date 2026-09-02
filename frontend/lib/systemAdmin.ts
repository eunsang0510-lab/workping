import { API_URL } from "@/lib/api";

// 시스템 관리자 여부는 하드코딩된 이메일이 아니라 서버(system_admins 테이블) 기준으로 판단한다.
// user_id(uid)가 아니라 email로 직접 조회한다 — 이메일/비밀번호로 로그인한 계정은
// users 테이블에 행이 없을 수 있어(구글 로그인 시에만 upsert됨) uid 기준 조회는 신뢰할 수 없다.
// 관리자 추가/삭제는 /superadmin/admins 화면에서 시스템 관리자가 직접 할 수 있다.
export async function checkSystemAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/system-admin-check?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    return !!data.is_system_admin;
  } catch {
    return false;
  }
}
