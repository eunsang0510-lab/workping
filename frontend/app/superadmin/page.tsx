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

interface IndividualUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

interface Stats {
  total_companies: number;
  total_members: number;
}

export default function SuperAdmin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"companies" | "members" | "users">("companies");
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [individualUsers, setIndividualUsers] = useState<IndividualUser[]>([]);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [companyLoading, setCompanyLoading] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberCompanyId, setNewMemberCompanyId] = useState("");
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u || u.email !== SYSTEM_ADMIN_EMAIL) {
        router.push("/login");
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
      const [statsRes, companiesRes, membersRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/superadmin/stats`),
        fetch(`${API_URL}/api/superadmin/companies`),
        fetch(`${API_URL}/api/superadmin/members`),
        fetch(`${API_URL}/api/superadmin/users`),
      ]);
      setStats(await statsRes.json());
      setCompanies(await companiesRes.json());
      setMembers(await membersRes.json());
      const usersData = await usersRes.json();
      setIndividualUsers(usersData.users || []);
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
    if (!confirm(`"${name}" 회사를 삭제할까요?\n소속 직원도 모두 삭제됩니다.`)) return;
    try {
      await fetch(`${API_URL}/api/superadmin/company/${id}`, { method: "DELETE" });
      alert("✅ 삭제 완료");
      fetchAll();
    } catch {
      alert("삭제 실패");
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`"${name}" 직원을 삭제할까요?`)) return;
    try {
      await fetch(`${API_URL}/api/superadmin/member/${id}`, { method: "DELETE" });
      alert("✅ 삭제 완료");
      fetchAll();
    } catch {
      alert("삭제 실패");
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!confirm(`${email}의 비밀번호를 초기화할까요?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/company/members/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 비밀번호 초기화 완료!\n초기 비밀번호: ${data.initial_password}`);
      } else {
        alert("초기화 실패");
      }
    } catch {
      alert("초기화 실패");
    }
  };

  const handleResetAttendance = async (userId: string, userName: string) => {
    if (!confirm(`${userName}의 오늘 기록을 초기화할까요?`)) return;
    try {
      await fetch(`${API_URL}/api/attendance/reset/${userId}`, { method: "DELETE" });
      alert("✅ 초기화 완료!");
    } catch {
      alert("초기화 실패");
    }
  };

  const handleResetUserAttendance = async (userId: string, userName: string) => {
    if (!confirm(`${userName}의 오늘 기록을 초기화할까요?`)) return;
    try {
      await fetch(`${API_URL}/api/superadmin/user/attendance/${userId}`, { method: "DELETE" });
      alert("✅ 초기화 완료!");
    } catch {
      alert("초기화 실패");
    }
  };

  const handleUpdateMember = async () => {
    if (!editMember) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/company/members/${editMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: editMember.user_name,
          user_email: editMember.user_email,
          is_admin: editMember.is_admin,
          company_id: editMember.company_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ 수정 완료!");
        setEditMember(null);
        fetchAll();
      }
    } catch {
      alert("수정 실패");
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("ko-KR");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              ←
            </div>
          </Link>
          <h1 className="text-[#0a0a0a] text-lg font-black">시스템 관리자</h1>
        </div>
        <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-lg px-2 py-1">
          <span className="text-[#4a4de0] text-xs font-bold">SUPERADMIN</span>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-3xl font-black text-[#5b5ef4]">{stats?.total_companies ?? 0}</div>
          <div className="text-[#a0a0a0] text-xs mt-1">전체 회사</div>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-3xl font-black text-[#16a34a]">{stats?.total_members ?? 0}</div>
          <div className="text-[#a0a0a0] text-xs mt-1">전체 직원</div>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-3xl font-black text-[#f59e0b]">{individualUsers.length}</div>
          <div className="text-[#a0a0a0] text-xs mt-1">개인 유저</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        {(["companies", "members", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === t
                ? "bg-[#5b5ef4] text-white shadow-[0_4px_12px_rgba(91,94,244,0.3)]"
                : "bg-white border border-[#e5e5e5] text-[#6b6b6b] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            }`}
          >
            {t === "companies" ? `회사 (${companies.length})` : t === "members" ? `직원 (${members.length})` : `개인 (${individualUsers.length})`}
          </button>
        ))}
      </div>

      {/* 새로고침 */}
      <div className="flex justify-end mb-3">
        <button onClick={fetchAll} className="text-[#5b5ef4] text-xs hover:text-[#4a4de0] transition-colors">새로고침</button>
      </div>

      {/* 회사 탭 */}
      {tab === "companies" && (
        <>
          <button
            onClick={() => setShowCompanyForm(!showCompanyForm)}
            className="w-full bg-white border border-dashed border-[#e5e5e5] hover:border-[#5b5ef4] text-[#a0a0a0] hover:text-[#5b5ef4] rounded-2xl py-3 text-sm font-bold transition-all mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            + 회사 추가
          </button>

          {showCompanyForm && (
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-3">새 회사 등록</div>
              <input
                type="text" placeholder="회사 이름" value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0] mb-3"
              />
              <button onClick={handleCreateCompany} disabled={companyLoading}
                className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm">
                {companyLoading ? "추가 중..." : "등록하기"}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {companies.length === 0 ? (
              <div className="text-[#a0a0a0] text-sm text-center py-12">등록된 회사가 없어요</div>
            ) : (
              companies.map((c) => (
                <div key={c.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#0a0a0a] font-black">{c.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => window.open(`${API_URL}/api/attendance/export/${c.id}`, "_blank")}
                        className="bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#dcfce7] transition-all"
                      >
                        📥 엑셀
                      </button>
                      <button onClick={() => handleDeleteCompany(c.id, c.name)} className="text-[#a0a0a0] hover:text-[#ef4444] text-xs transition-colors">삭제</button>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <span className="text-[#a0a0a0] text-xs">직원 <span className="text-[#0a0a0a] font-medium">{c.member_count}명</span></span>
                    <span className="text-[#a0a0a0] text-xs">플랜 <span className="text-[#5b5ef4] font-medium">{c.plan}</span></span>
                    <span className="text-[#a0a0a0] text-xs">생성 <span className="text-[#6b6b6b]">{formatDate(c.created_at)}</span></span>
                  </div>
                  <div className="mt-2">
                    <span className="text-[#a0a0a0] text-xs font-mono">{c.id.slice(0, 16)}...</span>
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
          <button
            onClick={() => setShowMemberForm(!showMemberForm)}
            className="w-full bg-white border border-dashed border-[#e5e5e5] hover:border-[#5b5ef4] text-[#a0a0a0] hover:text-[#5b5ef4] rounded-2xl py-3 text-sm font-bold transition-all mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            + 멤버 추가
          </button>

          {showMemberForm && (
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-3">새 멤버 등록</div>
              <div className="space-y-3">
                <select value={newMemberCompanyId} onChange={(e) => setNewMemberCompanyId(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm">
                  <option value="">회사 선택</option>
                  {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <input type="text" placeholder="이름" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
                <input type="email" placeholder="이메일" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newMemberIsAdmin} onChange={(e) => setNewMemberIsAdmin(e.target.checked)} className="w-4 h-4 accent-[#5b5ef4]" />
                  <span className="text-[#6b6b6b] text-sm">관리자 권한</span>
                </label>
                <button onClick={handleCreateMember} disabled={memberLoading}
                  className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm">
                  {memberLoading ? "추가 중..." : "등록하기"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {members.length === 0 ? (
              <div className="text-[#a0a0a0] text-sm text-center py-12">등록된 직원이 없어요</div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#0a0a0a] font-black">{m.user_name || "-"}</span>
                      {m.is_admin && (
                        <span className="bg-[#f0f0ff] border border-[#c7c8fa] text-[#4a4de0] text-xs px-2 py-0.5 rounded-lg">관리자</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditMember(m)} className="text-[#a0a0a0] hover:text-[#5b5ef4] text-xs transition-colors">수정</button>
                      <button onClick={() => handleResetPassword(m.user_email)} className="text-[#a0a0a0] hover:text-[#5b5ef4] text-xs transition-colors">PW초기화</button>
                      <button onClick={() => handleResetAttendance(m.user_id, m.user_name || m.user_email)} className="text-[#a0a0a0] hover:text-[#f59e0b] text-xs transition-colors">출근초기화</button>
                      <button onClick={() => handleDeleteMember(m.id, m.user_name || m.user_email)} className="text-[#a0a0a0] hover:text-[#ef4444] text-xs transition-colors">삭제</button>
                    </div>
                  </div>
                  <div className="text-[#6b6b6b] text-xs mb-1">{m.user_email}</div>
                  <div className="text-[#5b5ef4] text-xs">{m.company_name}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 개인 유저 탭 */}
      {tab === "users" && (
        <div className="space-y-3">
          {individualUsers.length === 0 ? (
            <div className="text-[#a0a0a0] text-sm text-center py-12">회사 미소속 유저가 없어요</div>
          ) : (
            individualUsers.map((u) => (
              <div key={u.id} className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#0a0a0a] font-black">{u.name || "-"}</span>
                  <button onClick={() => handleResetUserAttendance(u.id, u.name || u.email)} className="text-[#a0a0a0] hover:text-[#f59e0b] text-xs transition-colors">출근초기화</button>
                </div>
                <div className="text-[#6b6b6b] text-xs mb-1">{u.email}</div>
                <div className="text-[#a0a0a0] text-xs">가입일 {formatDate(u.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 수정 모달 */}
      {editMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-5">
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#0a0a0a] font-black">직원 정보 수정</div>
              <button onClick={() => setEditMember(null)} className="text-[#a0a0a0] hover:text-[#0a0a0a] text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">이름</div>
                <input type="text" value={editMember.user_name || ""} onChange={(e) => setEditMember({ ...editMember, user_name: e.target.value })}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm"
                />
              </div>
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">이메일</div>
                <input type="email" value={editMember.user_email || ""} onChange={(e) => setEditMember({ ...editMember, user_email: e.target.value })}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm"
                />
              </div>
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">소속 회사</div>
                <select value={editMember.company_id || ""} onChange={(e) => setEditMember({ ...editMember, company_id: e.target.value })}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm">
                  {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editMember.is_admin || false} onChange={(e) => setEditMember({ ...editMember, is_admin: e.target.checked })} className="w-4 h-4 accent-[#5b5ef4]" />
                <span className="text-[#6b6b6b] text-sm">관리자 권한</span>
              </label>
              <button onClick={handleUpdateMember} disabled={editLoading}
                className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm">
                {editLoading ? "수정 중..." : "저장하기"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}