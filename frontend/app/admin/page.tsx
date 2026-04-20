"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const SYSTEM_ADMIN_EMAIL = "eunsang0510@gmail.com";

interface Member {
  user_id: string;
  user_name: string;
  user_email: string;
  checkin: string | null;
  checkout: string | null;
  work_hours: string;
  status: "출근중" | "퇴근" | "미출근";
}

interface Company {
  id: string;
  name: string;
  member_count: number;
  company_code: string;
}

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [attendance, setAttendance] = useState<Member[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberBirth, setMemberBirth] = useState("");
  const [excelMembers, setExcelMembers] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchCompanyInfo(user.uid);
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const isSystemAdmin = user?.email === SYSTEM_ADMIN_EMAIL;

  const fetchCompanyInfo = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/info/${userId}`);
      const data = await res.json();
      if (data.company) {
        setCompany(data.company);
        fetchAttendance(data.company.id);
      } else {
        setShowCreateForm(true);
      }
    } catch (error) {
      console.error("회사 정보 로딩 실패:", error);
    }
  };

  const fetchAttendance = async (companyId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/attendance/${companyId}`);
      const data = await res.json();
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error("근태 현황 로딩 실패:", error);
    }
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) return;
    try {
      await fetch(`${API_URL}/api/company/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName, admin_id: user?.uid })
      });
      setShowCreateForm(false);
      fetchCompanyInfo(user!.uid);
    } catch (error) {
      alert("회사 생성 실패");
    }
  };

  const handleRegisterMember = async () => {
    if (!memberName || !memberEmail || !memberBirth) {
      alert("모든 항목을 입력해주세요");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/company/members/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company?.id,
          email: memberEmail,
          name: memberName,
          birth_date: memberBirth
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 등록 완료!\n초기 비밀번호: ${data.initial_password}`);
        setMemberName("");
        setMemberEmail("");
        setMemberBirth("");
        fetchAttendance(company!.id);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("등록 실패");
    }
  };

  const handleResetAttendance = async (userId: string, userName: string) => {
    if (!confirm(`${userName}의 오늘 기록을 초기화할까요?`)) return;
    try {
      await fetch(`${API_URL}/api/attendance/reset/${userId}`, {
        method: "DELETE"
      });
      alert("✅ 초기화 완료!");
      fetchAttendance(company!.id);
    } catch (error) {
      alert("초기화 실패");
    }
  };

  const handleDownloadTemplate = () => {
    let template;
    if (isSystemAdmin) {
      template = [
        { 회사코드: "abc12345", 이름: "홍길동", 이메일: "hong@company.com", 생년월일: "19901225" },
        { 회사코드: "xyz98765", 이름: "김철수", 이메일: "kim@other.com", 생년월일: "19850315" },
      ];
    } else {
      template = [
        { 이름: "홍길동", 이메일: "hong@company.com", 생년월일: "19901225" },
        { 이름: "김철수", 이메일: "kim@company.com", 생년월일: "19850315" },
      ];
    }
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "직원목록");
    XLSX.writeFile(wb, "직원등록양식.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);
        setExcelMembers(rows);
      } catch (error) {
        alert("엑셀 파일을 읽을 수 없어요");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkRegister = async () => {
    if (excelMembers.length === 0) return;
    if (!company?.id) {
      alert("회사 정보를 불러올 수 없어요.");
      return;
    }
    setBulkLoading(true);
    try {
      const members = excelMembers.map((m: any) => ({
        company_code: m.회사코드 || "",
        email: m.이메일,
        name: m.이름,
        birth_date: String(m.생년월일)
      }));

      const res = await fetch(`${API_URL}/api/company/members/bulk-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.id,
          members
        })
      });
      const data = await res.json();
      alert(`✅ ${data.message}`);
      setExcelMembers([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchAttendance(company.id);
    } catch (error) {
      alert("일괄 등록 실패");
    } finally {
      setBulkLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const statusConfig = {
    "출근중": { bg: "bg-[#052e16]", text: "text-[#22c55e]", border: "border-[#166534]", dot: "bg-[#22c55e]" },
    "퇴근": { bg: "bg-[#1e1b4b]", text: "text-[#818cf8]", border: "border-[#3730a3]", dot: "bg-[#818cf8]" },
    "미출근": { bg: "bg-[#18181b]", text: "text-[#71717a]", border: "border-[#27272a]", dot: "bg-[#52525b]" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-[#6366f1]">로딩 중...</div>
      </div>
    );
  }

  const checkinCount = attendance.filter(m => m.status === "출근중").length;
  const checkoutCount = attendance.filter(m => m.status === "퇴근").length;
  const absentCount = attendance.filter(m => m.status === "미출근").length;

  return (
    <main className="min-h-screen bg-[#09090b] p-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-9 h-9 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-center text-[#71717a] hover:border-[#6366f1] transition-all cursor-pointer">
              ←
            </div>
          </Link>
          <h1 className="text-white text-lg font-bold">관리자</h1>
        </div>
        {isSystemAdmin && (
          <div className="bg-[#1e1b4b] border border-[#3730a3] rounded-lg px-2 py-1">
            <span className="text-[#818cf8] text-xs font-semibold">시스템 관리자</span>
          </div>
        )}
      </div>

      {/* 회사 생성 폼 */}
      {showCreateForm && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 mb-4">
          <div className="text-white font-semibold mb-4">회사 등록</div>
          <input
            type="text"
            placeholder="회사 이름 입력"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 mb-3 outline-none focus:border-[#6366f1] transition-all text-sm placeholder-[#52525b]"
          />
          <button
            onClick={handleCreateCompany}
            className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold py-3 rounded-xl transition-all text-sm"
          >
            등록하기
          </button>
        </div>
      )}

      {company && (
        <>
          {/* 회사 정보 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 mb-4">
            <div className="text-[#71717a] text-xs mb-1">회사</div>
            <div className="text-white text-xl font-bold">{company.name}</div>
            <div className="flex items-center gap-3 mt-1">
              <div className="text-[#71717a] text-xs">팀원 {company.member_count}명</div>
              <div className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1">
                <span className="text-[#6366f1] text-xs font-mono">
                  코드: {company.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>

          {/* 오늘 현황 요약 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "출근중", count: checkinCount, color: "text-[#22c55e]" },
              { label: "퇴근", count: checkoutCount, color: "text-[#818cf8]" },
              { label: "미출근", count: absentCount, color: "text-[#71717a]" },
            ].map((item, i) => (
              <div key={i} className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
                <div className="text-[#71717a] text-xs mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          {/* 팀원 목록 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#71717a] text-xs font-semibold uppercase tracking-wider">오늘 근태 현황</div>
              <button
                onClick={() => fetchAttendance(company.id)}
                className="text-[#6366f1] text-xs hover:text-[#818cf8] transition-colors"
              >
                새로고침
              </button>
            </div>

            {attendance.length === 0 ? (
              <div className="text-[#52525b] text-sm text-center py-8">등록된 팀원이 없어요</div>
            ) : (
              <div className="space-y-3">
                {attendance.map((member, i) => {
                  const config = statusConfig[member.status];
                  return (
                    <div key={i} className="bg-[#09090b] border border-[#27272a] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                          <span className="text-white text-sm font-medium">
                            {member.user_name || member.user_email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-lg border ${config.bg} ${config.text} ${config.border}`}>
                            {member.status}
                          </span>
                          <button
                            onClick={() => handleResetAttendance(member.user_id, member.user_name || member.user_email)}
                            className="text-[#71717a] hover:text-[#ef4444] text-xs transition-colors"
                          >
                            초기화
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-[#71717a] text-xs">
                          출근 <span className="text-[#22c55e]">{formatTime(member.checkin)}</span>
                        </span>
                        <span className="text-[#71717a] text-xs">
                          퇴근 <span className="text-[#ef4444]">{formatTime(member.checkout)}</span>
                        </span>
                        <span className="text-[#71717a] text-xs">
                          <span className="text-[#818cf8]">{member.work_hours}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 직원 개별 등록 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 mb-4">
            <div className="text-[#71717a] text-xs font-semibold uppercase tracking-wider mb-4">직원 등록</div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="이름"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 outline-none focus:border-[#6366f1] transition-all text-sm placeholder-[#52525b]"
              />
              <input
                type="email"
                placeholder="회사 이메일"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 outline-none focus:border-[#6366f1] transition-all text-sm placeholder-[#52525b]"
              />
              <input
                type="text"
                placeholder="생년월일 (예: 19901225)"
                value={memberBirth}
                onChange={(e) => setMemberBirth(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 outline-none focus:border-[#6366f1] transition-all text-sm placeholder-[#52525b]"
              />
              <button
                onClick={handleRegisterMember}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold py-3 rounded-xl transition-all text-sm"
              >
                직원 등록하기
              </button>
            </div>
          </div>

          {/* 엑셀 일괄 등록 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#71717a] text-xs font-semibold uppercase tracking-wider">
                엑셀 일괄 등록
                {isSystemAdmin && (
                  <span className="ml-2 text-[#818cf8]">(회사코드 포함)</span>
                )}
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="text-[#6366f1] text-xs hover:text-[#818cf8] transition-colors"
              >
                양식 다운로드
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#27272a] hover:border-[#6366f1] rounded-xl p-6 text-center cursor-pointer transition-all mb-3"
            >
              <div className="text-2xl mb-2">📂</div>
              <div className="text-white text-sm font-medium">엑셀 파일 업로드</div>
              <div className="text-[#71717a] text-xs mt-1">
                {isSystemAdmin
                  ? "회사코드, 이름, 이메일, 생년월일 컬럼 필요"
                  : "이름, 이메일, 생년월일 컬럼 필요"
                }
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
            />

            {excelMembers.length > 0 && (
              <div className="mb-3">
                <div className="text-[#71717a] text-xs mb-2">{excelMembers.length}명 확인됨</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {excelMembers.map((m, i) => (
                    <div key={i} className="bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.회사코드 && (
                          <span className="text-[#6366f1] text-xs font-mono">{m.회사코드}</span>
                        )}
                        <span className="text-white text-xs font-medium">{m.이름}</span>
                      </div>
                      <span className="text-[#71717a] text-xs">{m.이메일}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {excelMembers.length > 0 && (
              <button
                onClick={handleBulkRegister}
                disabled={bulkLoading}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
              >
                {bulkLoading ? "등록 중..." : `${excelMembers.length}명 일괄 등록`}
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}