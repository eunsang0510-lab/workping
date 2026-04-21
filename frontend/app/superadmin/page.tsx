"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const SYSTEM_ADMIN_EMAIL = "eunsang0510@gmail.com";

interface Company {
  id: string;
  name: string;
  admin_id: string;
  plan: string;
  member_count: number;
  created_at: string;
}

interface Member {
  id: string;
  company_id: string;
  company_name: string;
  user_id: string;
  user_email: string;
  user_name: string;
  is_admin: boolean;
  created_at: string;
}

interface Stats {
  total_companies: number;
  total_members: number;
}

export default function SuperAdmin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"companies" | "members">("companies");
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // 회사 추가 폼
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [companyLoading, setCompanyLoading] = useState(false);

  // 멤버 추가 폼
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberCompanyId, setNewMemberCompanyId] = useState("");
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u || u.email !== SYSTEM_ADMIN_EMAIL) {
        router.push("/");
        return;
      }
      setUser(u);
      fetchAll();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAll = async () => {
    try {
      const [statsRes, companiesRes, membersRes] = await Promise.all([
        fetch(`${API_URL}/api/superadmin/stats`),
        fetch(`${API_URL}/api/superadmin/companies`),
        fetch(`${API_URL}/api/superadmin/members`),
      ]);
      setStats(await statsRes.json());
      setCompanies(await companiesRes.json());
      setMembers(await membersRes.json());
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    setCompanyLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName, plan: "team" }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ 회사 추가 완료!");
        setNewCompanyName("");
        setShowCompanyForm(false);
        fetchAll();
      }
    } catch {
      alert("회사 추가 실패");
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleCreateMember = async () => {
    if (!newMemberEmail || !newMemberCompanyId) {
      alert("회사와 이메일을 입력해주세요");
      return;
    }
    setMemberLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: newMemberCompanyId,
          user_email: newMemberEmail,
          user_name: newMemberName,
          is_admin: newMemberIsAdmin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ 멤버 추가 완료!");
        setNewMemberEmail("");
        setNewMemberName("");
        setNewMemberCompanyId("");
        setNewMemberIsAdmin(false);
        setShowMemberForm(false);
        fetchAll();
      }
    } catch {
      alert("멤버 추가 실패");
    } finally {
      setMemberLoading(false);
    }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`"${name}" 회사를 삭제할까요?\n소속 직원도 모두 삭제됩니다.`))
      return;
    try {
      await fetch(`${API_URL}/api/superadmin/company/${id}`, {
        method: "DELETE",
      });
      alert("✅ 삭제 완료");
      fetchAll();
    } catch {
      alert("삭제 실패");
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`"${name}" 직원을 삭제할까요?`)) return;
    try {
      await fetch(`${API_URL}/api/superadmin/member/${id}`, {
        method: "DELETE",
      });
      alert("✅ 삭제 완료");
      fetchAll();
    } catch {
      alert("삭제 실패");
    }
  };

  const handleResetPassword = async (email: string) => {
  if (!confirm(`${email}의 비밀번호 재설정 이메일을 발송할까요?`)) return;
  try {
    const res = await fetch(`${API_URL}/api/company/members/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "", email })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
    } else {
      alert("발송 실패");
    }
  } catch {
    alert("발송 실패");
  }
};

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("ko-KR");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-[#6366f1]">로딩 중...</div>
      </div>
    );
  }
   
  return (
    <main className="min-h-screen bg-[#09090b] p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-9 h-9 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-center text-[#71717a] hover:border-[#6366f1] transition-all cursor-pointer">
              ←
            </div>
          </Link>
          <h1 className="text-white text-lg font-bold">시스템 관리자</h1>
        </div>
        <div className="bg-[#1e1b4b] border border-[#3730a3] rounded-lg px-2 py-1">
          <span className="text-[#818cf8] text-xs font-semibold">
            SUPERADMIN
          </span>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold text-[#6366f1]">
            {stats?.total_companies ?? 0}
          </div>
          <div className="text-[#71717a] text-xs mt-1">전체 회사</div>
        </div>
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold text-[#22c55e]">
            {stats?.total_members ?? 0}
          </div>
          <div className="text-[#71717a] text-xs mt-1">전체 직원</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        {(["companies", "members"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t
                ? "bg-[#6366f1] text-white"
                : "bg-[#18181b] border border-[#27272a] text-[#71717a]"
            }`}
          >
            {t === "companies"
              ? `회사 (${companies.length})`
              : `직원 (${members.length})`}
          </button>
        ))}
      </div>

      {/* 회사 탭 */}
      {tab === "companies" && (
        <>
          {/* 회사 추가 버튼 */}
          <button
            onClick={() => setShowCompanyForm(!showCompanyForm)}
            className="w-full bg-[#18181b] border border-dashed border-[#27272a] hover:border-[#6366f1] text-[#71717a] hover:text-[#6366f1] rounded-2xl py-3 text-sm font-semibold transition-all mb-3"
          >
            + 회사 추가
          </button>

          {/* 회사 추가 폼 */}
          {showCompanyForm && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 mb-4">
              <div className="text-[#71717a] text-xs font-semibold uppercase tracking-wider mb-3">
                새 회사 등록
              </div>
              <input
                type="text"
                placeholder="회사 이름"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 outline-none focus:border-[#6366f1] transition-all text-sm placeholder-[#52525b] mb-3"
              />
              <button
                onClick={handleCreateCompany}
                disabled={companyLoading}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
              >
                {companyLoading ? "추가 중..." : "등록하기"}
              </button>
            </div>
          )}

          {/* 새로고침 */}
          <div className="flex justify-end mb-3">
            <button
              onClick={fetchAll}
              className="text-[#6366f1] text-xs hover:text-[#818cf8] transition-colors"
            >
              새로고침
            </button>
          </div>

          {/* 회사 목록 */}
          <div className="space-y-3">
            {companies.length === 0 ? (
              <div className="text-[#52525b] text-sm text-center py-12">
                등록된 회사가 없어요
              </div>
            ) : (
              companies.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">{c.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          window.open(
                            `${API_URL}/api/attendance/export/${c.id}`,
                            "_blank",
                          )
                        }
                        className="bg-[#052e16] border border-[#166534] text-[#22c55e] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#14532d] transition-all"
                      >
                        📥 엑셀
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(c.id, c.name)}
                        className="text-[#71717a] hover:text-[#ef4444] text-xs transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <span className="text-[#71717a] text-xs">
                      직원{" "}
                      <span className="text-white">{c.member_count}명</span>
                    </span>
                    <span className="text-[#71717a] text-xs">
                      플랜 <span className="text-[#6366f1]">{c.plan}</span>
                    </span>
                    <span className="text-[#71717a] text-xs">
                      생성{" "}
                      <span className="text-[#52525b]">
                        {formatDate(c.created_at)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-[#52525b] text-xs font-mono">
                      {c.id.slice(0, 16)}...
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 직원 탭 */}
      {tab === "members" && (
        <>
          {/* 멤버 추가 버튼 */}
          <button
            onClick={() => setShowMemberForm(!showMemberForm)}
            className="w-full bg-[#18181b] border border-dashed border-[#27272a] hover:border-[#6366f1] text-[#71717a] hover:text-[#6366f1] rounded-2xl py-3 text-sm font-semibold transition-all mb-3"
          >
            + 멤버 추가
          </button>

          {/* 멤버 추가 폼 */}
          {showMemberForm && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 mb-4">
              <div className="text-[#71717a] text-xs font-semibold uppercase tracking-wider mb-3">
                새 멤버 등록
              </div>
              <div className="space-y-3">
                <select
                  value={newMemberCompanyId}
                  onChange={(e) => setNewMemberCompanyId(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 outline-none focus:border-[#6366f1] transition-all text-sm"
                >
                  <option value="">회사 선택</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="이름"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 outline-none focus:border-[#6366f1] transition-all text-sm placeholder-[#52525b]"
                />
                <input
                  type="email"
                  placeholder="이메일"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 outline-none focus:border-[#6366f1] transition-all text-sm placeholder-[#52525b]"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newMemberIsAdmin}
                    onChange={(e) => setNewMemberIsAdmin(e.target.checked)}
                    className="w-4 h-4 accent-[#6366f1]"
                  />
                  <span className="text-[#71717a] text-sm">관리자 권한</span>
                </label>
                <button
                  onClick={handleCreateMember}
                  disabled={memberLoading}
                  className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
                >
                  {memberLoading ? "추가 중..." : "등록하기"}
                </button>
              </div>
            </div>
          )}

          {/* 새로고침 */}
          <div className="flex justify-end mb-3">
            <button
              onClick={fetchAll}
              className="text-[#6366f1] text-xs hover:text-[#818cf8] transition-colors"
            >
              새로고침
            </button>
          </div>

          {/* 직원 목록 */}
          <div className="space-y-3">
            {members.length === 0 ? (
              <div className="text-[#52525b] text-sm text-center py-12">
                등록된 직원이 없어요
              </div>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">
                        {m.user_name || "-"}
                      </span>
                      {m.is_admin && (
                        <span className="bg-[#1e1b4b] border border-[#3730a3] text-[#818cf8] text-xs px-2 py-0.5 rounded-lg">
                          관리자
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                   <button
                      onClick={() => handleResetPassword(m.user_email)}
                      className="text-[#71717a] hover:text-[#6366f1] text-xs transition-colors"
                    >
                      PW초기화
                    </button>
                    <button
                      onClick={() => handleDeleteMember(m.id, m.user_name || m.user_email)}
                      className="text-[#71717a] hover:text-[#ef4444] text-xs transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                  </div>
                  <div className="text-[#71717a] text-xs mb-1">
                    {m.user_email}
                  </div>
                  <div className="text-[#6366f1] text-xs">{m.company_name}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
