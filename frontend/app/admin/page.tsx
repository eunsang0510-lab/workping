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
  status: "출근중" | "퇴근" | "미출근" | "미퇴근";
  is_missing_checkout: boolean;
}

interface Company {
  id: string;
  name: string;
  member_count: number;
  company_code: string;
}

interface CompanyLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
}

interface EditMember {
  id: string;
  user_name: string;
  user_email: string;
  is_admin: boolean;
  company_id: string;
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
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationRadius, setLocationRadius] = useState("100");
  const [locationLoading, setLocationLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [editMember, setEditMember] = useState<EditMember | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchCompanyInfo(user.uid);
      } else {
        router.push("/login");
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
        fetchLocations(data.company.id);
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

  const fetchLocations = async (companyId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/locations/${companyId}`);
      const data = await res.json();
      setLocations(data.locations || []);
    } catch (error) {
      console.error("위치 로딩 실패:", error);
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
    } catch {
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
        body: JSON.stringify({ company_id: company?.id, email: memberEmail, name: memberName, birth_date: memberBirth })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 등록 완료!\n초기 비밀번호: ${data.initial_password}`);
        setMemberName(""); setMemberEmail(""); setMemberBirth("");
        fetchAttendance(company!.id);
      } else {
        alert(data.message);
      }
    } catch {
      alert("등록 실패");
    }
  };

  const handleResetAttendance = async (userId: string, userName: string) => {
    if (!confirm(`${userName}의 오늘 기록을 초기화할까요?`)) return;
    try {
      await fetch(`${API_URL}/api/attendance/reset/${userId}`, { method: "DELETE" });
      alert("✅ 초기화 완료!");
      fetchAttendance(company!.id);
    } catch {
      alert("초기화 실패");
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!confirm(`${email}의 비밀번호를 초기화할까요?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/company/members/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
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

  const handleUpdateMember = async () => {
    if (!editMember) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/company/members/${editMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: editMember.user_name, user_email: editMember.user_email, is_admin: editMember.is_admin, company_id: editMember.company_id }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ 수정 완료!");
        setEditMember(null);
        fetchAttendance(company!.id);
      }
    } catch {
      alert("수정 실패");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = isSystemAdmin
      ? [{ 회사코드: "abc12345", 이름: "홍길동", 이메일: "hong@company.com", 생년월일: "19901225" }]
      : [{ 이름: "홍길동", 이메일: "hong@company.com", 생년월일: "19901225" }];
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
        setExcelMembers(XLSX.utils.sheet_to_json<any>(sheet));
      } catch {
        alert("엑셀 파일을 읽을 수 없어요");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkRegister = async () => {
    if (!excelMembers.length || !company?.id) return;
    setBulkLoading(true);
    try {
      const members = excelMembers.map((m: any) => ({
        company_code: m.회사코드 || "", email: m.이메일, name: m.이름, birth_date: String(m.생년월일)
      }));
      const res = await fetch(`${API_URL}/api/company/members/bulk-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company.id, members })
      });
      const data = await res.json();
      alert(`✅ ${data.message}`);
      setExcelMembers([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchAttendance(company.id);
    } catch {
      alert("일괄 등록 실패");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLat(position.coords.latitude.toFixed(6));
        setLocationLng(position.coords.longitude.toFixed(6));
        setGettingLocation(false);
      },
      () => { alert("GPS 위치를 가져올 수 없어요"); setGettingLocation(false); }
    );
  };

  const handleAddLocation = async () => {
    if (!locationName || !locationLat || !locationLng) {
      alert("모든 항목을 입력해주세요"); return;
    }
    setLocationLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/company/locations/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company?.id, name: locationName, latitude: parseFloat(locationLat), longitude: parseFloat(locationLng), radius: parseInt(locationRadius) }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ 위치 등록 완료!");
        setLocationName(""); setLocationLat(""); setLocationLng(""); setLocationRadius("100");
        setShowLocationForm(false);
        fetchLocations(company!.id);
      }
    } catch {
      alert("위치 등록 실패");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!confirm(`"${name}" 위치를 삭제할까요?`)) return;
    try {
      await fetch(`${API_URL}/api/company/locations/${id}`, { method: "DELETE" });
      fetchLocations(company!.id);
    } catch {
      alert("삭제 실패");
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const statusConfig = {
    "출근중": { bg: "bg-[#f0fdf4]", text: "text-[#16a34a]", border: "border-[#bbf7d0]", dot: "bg-[#16a34a]" },
    "퇴근":   { bg: "bg-[#f0f0ff]", text: "text-[#4a4de0]", border: "border-[#c7c8fa]", dot: "bg-[#5b5ef4]" },
    "미출근": { bg: "bg-[#f8f8f8]", text: "text-[#a0a0a0]", border: "border-[#e5e5e5]", dot: "bg-[#a0a0a0]" },
    "미퇴근": { bg: "bg-[#fef2f2]", text: "text-[#ef4444]", border: "border-[#fecaca]", dot: "bg-[#ef4444]" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  const checkinCount = attendance.filter(m => m.status === "출근중").length;
  const checkoutCount = attendance.filter(m => m.status === "퇴근").length;
  const absentCount = attendance.filter(m => m.status === "미출근").length;
  const missingCount = attendance.filter(m => m.status === "미퇴근").length;

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              ←
            </div>
          </Link>
          <h1 className="text-[#0a0a0a] text-lg font-black">관리자</h1>
        </div>
        {isSystemAdmin && (
          <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-lg px-2 py-1">
            <span className="text-[#4a4de0] text-xs font-bold">시스템 관리자</span>
          </div>
        )}
      </div>

      {/* 회사 생성 폼 */}
      {showCreateForm && (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-[#0a0a0a] font-black mb-4">회사 등록</div>
          <input
            type="text" placeholder="회사 이름 입력" value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 mb-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
          />
          <button onClick={handleCreateCompany} className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-3 rounded-xl transition-all text-sm">
            등록하기
          </button>
        </div>
      )}

      {company && (
        <>
          {/* 회사 정보 */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="text-[#a0a0a0] text-xs mb-1">회사</div>
            <div className="text-[#0a0a0a] text-xl font-black">{company.name}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-3">
                <div className="text-[#6b6b6b] text-xs">팀원 {company.member_count}명</div>
                <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-lg px-2 py-1">
                  <span className="text-[#4a4de0] text-xs font-mono">코드: {company.id.slice(0, 8)}</span>
                </div>
              </div>
              <button
                onClick={() => window.open(`${API_URL}/api/attendance/export/${company.id}`, "_blank")}
                className="bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#dcfce7] transition-all"
              >
                📥 엑셀 다운
              </button>
            </div>
          </div>

          {/* 오늘 현황 요약 */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "출근중", count: checkinCount, color: "text-[#16a34a]" },
              { label: "퇴근", count: checkoutCount, color: "text-[#4a4de0]" },
              { label: "미출근", count: absentCount, color: "text-[#a0a0a0]" },
              { label: "미퇴근", count: missingCount, color: "text-[#ef4444]" },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-[#e5e5e5] rounded-xl p-3 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className={`text-xl font-black ${item.color}`}>{item.count}</div>
                <div className="text-[#a0a0a0] text-xs mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          {/* 팀원 목록 */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider">오늘 근태 현황</div>
              <button onClick={() => fetchAttendance(company.id)} className="text-[#5b5ef4] text-xs hover:text-[#4a4de0] transition-colors">새로고침</button>
            </div>
            {attendance.length === 0 ? (
              <div className="text-[#a0a0a0] text-sm text-center py-8">등록된 팀원이 없어요</div>
            ) : (
              <div className="space-y-3">
                {attendance.map((member, i) => {
                  const config = statusConfig[member.status] || statusConfig["미출근"];
                  return (
                    <div key={i} className={`bg-[#f8f8f8] border rounded-xl p-4 ${member.is_missing_checkout ? "border-[#fecaca]" : "border-[#e5e5e5]"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                          <span className="text-[#0a0a0a] text-sm font-bold">{member.user_name || member.user_email}</span>
                          {member.is_missing_checkout && <span className="text-[#ef4444] text-xs">⚠️ 미퇴근</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-lg border ${config.bg} ${config.text} ${config.border}`}>{member.status}</span>
                          <button onClick={() => setEditMember({ id: member.user_id, user_name: member.user_name, user_email: member.user_email, is_admin: false, company_id: company!.id })} className="text-[#a0a0a0] hover:text-[#5b5ef4] text-xs transition-colors">수정</button>
                          <button onClick={() => handleResetPassword(member.user_email)} className="text-[#a0a0a0] hover:text-[#5b5ef4] text-xs transition-colors">PW초기화</button>
                          <button onClick={() => handleResetAttendance(member.user_id, member.user_name || member.user_email)} className="text-[#a0a0a0] hover:text-[#ef4444] text-xs transition-colors">초기화</button>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-[#a0a0a0] text-xs">출근 <span className="text-[#16a34a] font-medium">{formatTime(member.checkin)}</span></span>
                        <span className="text-[#a0a0a0] text-xs">퇴근 <span className="text-[#ef4444] font-medium">{formatTime(member.checkout)}</span></span>
                        <span className="text-[#a0a0a0] text-xs"><span className="text-[#4a4de0] font-medium">{member.work_hours}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 직원 개별 등록 */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider mb-4">직원 등록</div>
            <div className="space-y-3">
              {[
                { placeholder: "이름", value: memberName, onChange: setMemberName, type: "text" },
                { placeholder: "회사 이메일", value: memberEmail, onChange: setMemberEmail, type: "email" },
                { placeholder: "생년월일 (예: 19901225)", value: memberBirth, onChange: setMemberBirth, type: "text" },
              ].map((field, i) => (
                <input key={i} type={field.type} placeholder={field.placeholder} value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
              ))}
              <button onClick={handleRegisterMember} className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-3 rounded-xl transition-all text-sm">
                직원 등록하기
              </button>
            </div>
          </div>

          {/* 엑셀 일괄 등록 */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider">
                엑셀 일괄 등록 {isSystemAdmin && <span className="ml-2 text-[#4a4de0]">(회사코드 포함)</span>}
              </div>
              <button onClick={handleDownloadTemplate} className="text-[#5b5ef4] text-xs hover:text-[#4a4de0] transition-colors">양식 다운로드</button>
            </div>
            <div onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-6 text-center cursor-pointer transition-all mb-3 bg-[#f8f8f8]">
              <div className="text-2xl mb-2">📂</div>
              <div className="text-[#0a0a0a] text-sm font-medium">엑셀 파일 업로드</div>
              <div className="text-[#a0a0a0] text-xs mt-1">{isSystemAdmin ? "회사코드, 이름, 이메일, 생년월일 컬럼 필요" : "이름, 이메일, 생년월일 컬럼 필요"}</div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
            {excelMembers.length > 0 && (
              <>
                <div className="text-[#a0a0a0] text-xs mb-2">{excelMembers.length}명 확인됨</div>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                  {excelMembers.map((m, i) => (
                    <div key={i} className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-lg px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.회사코드 && <span className="text-[#4a4de0] text-xs font-mono">{m.회사코드}</span>}
                        <span className="text-[#0a0a0a] text-xs font-medium">{m.이름}</span>
                      </div>
                      <span className="text-[#6b6b6b] text-xs">{m.이메일}</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleBulkRegister} disabled={bulkLoading}
                  className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm">
                  {bulkLoading ? "등록 중..." : `${excelMembers.length}명 일괄 등록`}
                </button>
              </>
            )}
          </div>

          {/* 출근 위치 관리 */}
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#a0a0a0] text-xs font-semibold uppercase tracking-wider">출근 위치 관리</div>
              <button onClick={() => setShowLocationForm(!showLocationForm)} className="text-[#5b5ef4] text-xs hover:text-[#4a4de0] transition-colors">+ 위치 추가</button>
            </div>
            {showLocationForm && (
              <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl p-4 mb-4 space-y-3">
                <input type="text" placeholder="위치 이름 (예: 본사, 강남지점)" value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
                <button onClick={handleGetCurrentLocation} disabled={gettingLocation}
                  className="w-full bg-white border border-dashed border-[#e5e5e5] hover:border-[#5b5ef4] text-[#6b6b6b] hover:text-[#5b5ef4] rounded-xl py-3 text-sm transition-all">
                  {gettingLocation ? "⏳ 위치 가져오는 중..." : "📍 현재 위치 가져오기"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="위도" value={locationLat} onChange={(e) => setLocationLat(e.target.value)}
                    className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                  />
                  <input type="text" placeholder="경도" value={locationLng} onChange={(e) => setLocationLng(e.target.value)}
                    className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" placeholder="허용 반경 (미터)" value={locationRadius} onChange={(e) => setLocationRadius(e.target.value)}
                    className="flex-1 bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm"
                  />
                  <span className="text-[#6b6b6b] text-sm">m</span>
                </div>
                <button onClick={handleAddLocation} disabled={locationLoading}
                  className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm">
                  {locationLoading ? "등록 중..." : "위치 등록"}
                </button>
              </div>
            )}
            {locations.length === 0 ? (
              <div className="text-[#a0a0a0] text-sm text-center py-6">
                등록된 위치가 없어요<br /><span className="text-xs">위치 미등록 시 어디서든 출근 가능</span>
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((loc) => (
                  <div key={loc.id} className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span className="text-[#0a0a0a] text-sm font-bold">{loc.name}</span>
                      </div>
                      <button onClick={() => handleDeleteLocation(loc.id, loc.name)} className="text-[#a0a0a0] hover:text-[#ef4444] text-xs transition-colors">삭제</button>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[#a0a0a0] text-xs font-mono">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                      <span className="text-[#4a4de0] text-xs">반경 {loc.radius}m</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editMember.is_admin} onChange={(e) => setEditMember({ ...editMember, is_admin: e.target.checked })} className="w-4 h-4 accent-[#5b5ef4]" />
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