"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
}

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [attendance, setAttendance] = useState<Member[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
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
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <div className="w-9 h-9 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-center text-[#71717a] hover:border-[#6366f1] transition-all cursor-pointer">
            ←
          </div>
        </Link>
        <h1 className="text-white text-lg font-bold">관리자</h1>
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
            className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-xl px-4 py-3 mb-3 outline-none focus:border-[#6366f1] transition-all text-sm"
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
            <div className="text-[#71717a] text-xs mt-1">팀원 {company.member_count}명</div>
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
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5">
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
                        <span className={`text-xs px-2 py-1 rounded-lg border ${config.bg} ${config.text} ${config.border}`}>
                          {member.status}
                        </span>
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
        </>
      )}
    </main>
  );
}