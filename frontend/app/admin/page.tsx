"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Member {
  user_id: string;
  user_name: string;
  user_email: string;
  checkin: string | null;
  checkout: string | null;
  checkin_address: string | null;
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
  const [newMemberEmail, setNewMemberEmail] = useState("");
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
      const res = await fetch(`http://127.0.0.1:8000/api/company/info/${userId}`);
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
      const res = await fetch(`http://127.0.0.1:8000/api/company/attendance/${companyId}`);
      const data = await res.json();
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error("근태 현황 로딩 실패:", error);
    }
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/api/company/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          admin_id: user?.uid
        })
      });
      const data = await res.json();
      alert("✅ 회사 생성 완료!");
      setShowCreateForm(false);
      fetchCompanyInfo(user!.uid);
    } catch (error) {
      alert("회사 생성 실패");
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "출근중": return "bg-green-500";
      case "퇴근": return "bg-blue-500";
      case "미출근": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center cursor-pointer hover:bg-gray-700">
              <span className="text-white">←</span>
            </div>
          </Link>
          <h1 className="text-white text-xl font-bold">관리자 페이지</h1>
        </div>
      </div>

      {/* 회사 생성 폼 */}
      {showCreateForm && (
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-bold mb-4">🏢 회사 등록</h2>
          <input
            type="text"
            placeholder="회사 이름 입력"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreateCompany}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition"
          >
            회사 등록하기
          </button>
        </div>
      )}

      {/* 회사 정보 */}
      {company && (
        <>
          <div className="bg-blue-600 rounded-2xl p-6 mb-6">
            <h2 className="text-white text-xl font-bold">🏢 {company.name}</h2>
            <p className="text-blue-200 text-sm mt-1">
              팀원 {company.member_count}명
            </p>
          </div>

          {/* 오늘 근태 현황 */}
          <div className="bg-gray-900 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">📋 오늘 근태 현황</h3>
              <button
                onClick={() => fetchAttendance(company.id)}
                className="text-blue-400 text-sm hover:text-blue-300"
              >
                새로고침
              </button>
            </div>

            {/* 요약 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "출근중", count: attendance.filter(m => m.status === "출근중").length, color: "text-green-400" },
                { label: "퇴근", count: attendance.filter(m => m.status === "퇴근").length, color: "text-blue-400" },
                { label: "미출근", count: attendance.filter(m => m.status === "미출근").length, color: "text-gray-400" },
              ].map((item, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
                  <div className="text-gray-400 text-xs">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 팀원 목록 */}
            {attendance.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8">
                등록된 팀원이 없어요
              </div>
            ) : (
              <div className="space-y-3">
                {attendance.map((member, i) => (
                  <div key={i} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(member.status)}`}></span>
                        <span className="text-white font-semibold text-sm">
                          {member.user_name || member.user_email}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        member.status === "출근중" ? "bg-green-900 text-green-400" :
                        member.status === "퇴근" ? "bg-blue-900 text-blue-400" :
                        "bg-gray-700 text-gray-400"
                      }`}>
                        {member.status}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <span className="text-gray-500 text-xs">출근 </span>
                        <span className="text-green-400 text-xs">{formatTime(member.checkin)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">퇴근 </span>
                        <span className="text-red-400 text-xs">{formatTime(member.checkout)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">근무 </span>
                        <span className="text-blue-400 text-xs">{member.work_hours}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 대시보드 링크 */}
      <Link href="/dashboard">
        <div className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <div className="text-white font-bold">내 대시보드</div>
              <div className="text-gray-400 text-xs">개인 근태 확인</div>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </div>
      </Link>
    </main>
  );
}