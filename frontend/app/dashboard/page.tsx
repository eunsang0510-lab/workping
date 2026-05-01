"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getAddressFromCoords } from "@/lib/kakao";
import Link from "next/link";
import Toast from "@/components/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
};

interface LocationRecord {
  latitude: number;
  longitude: number;
  timestamp: string;
  place_name: string;
  type: "checkin" | "checkout";
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [workHours, setWorkHours] = useState("0h 0m");
  const [currentLocation, setCurrentLocation] = useState("-");
  const [checkOutLocation, setCheckOutLocation] = useState("-");
  const [records, setRecords] = useState<LocationRecord[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [planExpired, setPlanExpired] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // GPS 권한 미리 요청
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchTodayAttendance(user.uid);
        fetchAdminStatus(user.uid);
        fetchPlanStatus(user.uid);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchTodayAttendance = async (userId: string) => {
  try {
    const res = await fetch(`${API_URL}/api/attendance/summary/${userId}`, {
      headers: await getAuthHeader(),
    });
    const data = await res.json();
    if (data.checkin) {
      setCheckInTime(data.checkin);
      setCurrentLocation(data.checkin_address || "-");
      setIsCheckedIn(true); // ✅ 이거 추가!
    }
    if (data.checkout) {
      setIsCheckedIn(false);
      setCheckOutTime(data.checkout);
      setCheckOutLocation(data.checkout_address || "-");
      const minutes = Math.floor(
        (new Date(data.checkout).getTime() - new Date(data.checkin).getTime()) / 1000 / 60
      );
      setWorkHours(formatWorkTime(minutes));
    }
  } catch (error) {
    console.error("오늘 기록 로딩 실패:", error);
  }
 };

  const fetchAdminStatus = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/admin-check/${userId}`);
      const data = await res.json();
      setIsAdmin(data.is_admin || false);
    } catch (error) {
      console.error("관리자 확인 실패:", error);
    }
  };

  const fetchPlanStatus = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/company/my/${userId}`);
      const data = await res.json();
      if (data.company_id) {
        const subRes = await fetch(`${API_URL}/api/payment/subscription/${data.company_id}`);
        const subData = await subRes.json();
        if (subData.status === "expired") {
          setPlanExpired(true);
        }
      }
    } catch {}
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS를 지원하지 않는 브라우저예요"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000,
      });
    });
  };

  const calcWorkMinutes = (checkIn: string) => {
  const start = new Date(checkIn);
  const nowUTC = new Date(); // 둘 다 UTC 기준으로 비교
  return Math.floor((nowUTC.getTime() - start.getTime()) / 1000 / 60);
};

  const formatWorkTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const handleCheckIn = async () => {
    if (planExpired) {
      showToast("구독이 만료됐어요. 결제 후 이용해주세요.", "error");
      return;
    }
    setGpsLoading(true);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const nowISO = new Date().toISOString(); // 그대로 UTC
      setCheckInTime(nowISO); // 로컬 상태도 UTC로 저장
      const address = await getAddressFromCoords(latitude, longitude);
      await fetch(`${API_URL}/api/location/record`, {
        method: "POST",
        headers: await getAuthHeader(),
        body: JSON.stringify({ user_id: user?.uid, latitude, longitude, timestamp: nowISO, type: "checkin", address }),
      });
      setIsCheckedIn(true);
      setCheckInTime(nowISO);
      setCurrentLocation(address);
      setRecords((prev) => [...prev, { latitude, longitude, timestamp: nowISO, place_name: address, type: "checkin" }]);
      showToast("출근 완료!", "success");
    } catch (error) {
      showToast("GPS 위치를 가져올 수 없어요.", "error");
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (planExpired) {
      showToast("구독이 만료됐어요. 결제 후 이용해주세요.", "error");
      return;
    }
    setGpsLoading(true);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const nowISO = new Date().toISOString(); // 그대로 UTC
      setCheckInTime(nowISO); // 로컬 상태도 UTC로 저장
      const address = await getAddressFromCoords(latitude, longitude);
      await fetch(`${API_URL}/api/location/record`, {
        method: "POST",
        headers: await getAuthHeader(),
        body: JSON.stringify({ user_id: user?.uid, latitude, longitude, timestamp: nowISO, type: "checkout", address }),
      });
      setIsCheckedIn(false);
      setCheckOutTime(nowISO);
      setCheckOutLocation(address);
      if (checkInTime) setWorkHours(formatWorkTime(calcWorkMinutes(checkInTime)));
      setRecords((prev) => [...prev, { latitude, longitude, timestamp: nowISO, place_name: address, type: "checkout" }]);
      showToast("퇴근 완료!", "success");
    } catch (error) {
      showToast("GPS 위치를 가져올 수 없어요.", "error");
    } finally {
      setGpsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast("모든 항목을 입력해주세요", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("새 비밀번호는 6자 이상이어야 해요", "error");
      return;
    }
    setPasswordLoading(true);
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
      const credential = EmailAuthProvider.credential(user!.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser!, credential);
      await updatePassword(auth.currentUser!, newPassword);
      showToast("비밀번호가 변경됐어요!", "success");
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        showToast("현재 비밀번호가 올바르지 않아요", "error");
      } else {
        showToast("비밀번호 변경 실패: " + e.message, "error");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

 const formatTime = (isoString: string | null) => {
  if (!isoString) return "--:--";
  // DB에서 오는 값: "2026-05-01T07:28:41.688" (UTC, timezone 없음)
  // 버튼 클릭 시 값: "2026-05-01T16:28:41.688Z" (UTC ISO)
  // 둘 다 UTC로 파싱 후 KST 변환
  const str = isoString.endsWith("Z") || isoString.includes("+") 
    ? isoString 
    : isoString + "Z";
  const date = new Date(str);
  if (isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
};

  const formatDate = () => {
    return now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </div>
    );
  }

  const workMinutes = isCheckedIn && checkInTime ? calcWorkMinutes(checkInTime) : 0;

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[#0a0a0a] text-xl font-black tracking-tight">
          Work<span className="text-[#5b5ef4]">Ping</span>
        </h1>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          >
            👤
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-11 bg-white border border-[#e5e5e5] rounded-2xl p-3 w-52 z-50 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <div className="px-2 py-1.5 mb-2 border-b border-[#e5e5e5]">
                  <div className="text-[#0a0a0a] text-xs font-bold truncate">{user?.displayName || user?.email}</div>
                  <div className="text-[#6b6b6b] text-xs truncate">{user?.email}</div>
                </div>
                {!user?.providerData?.some(p => p.providerId === "google.com") && (
                  <button
                    onClick={() => { setShowUserMenu(false); setShowPasswordModal(true); }}
                    className="w-full text-left px-2 py-2 text-[#5b5ef4] text-sm hover:bg-[#f8f8f8] rounded-xl transition-all"
                  >
                    🔑 비밀번호 변경
                  </button>
                )}
                <button
                  onClick={async () => { await signOut(auth); router.push("/login"); }}
                  className="w-full text-left px-2 py-2 text-[#ef4444] text-sm hover:bg-[#f8f8f8] rounded-xl transition-all"
                >
                  🚪 로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 플랜 만료 알림 */}
      {planExpired && (
        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[#ef4444] text-sm font-bold mb-0.5">⚠️ 구독이 만료됐어요</div>
            <div className="text-[#6b6b6b] text-xs">결제 후 출퇴근 기능을 이용할 수 있어요</div>
          </div>
          <Link href="/pricing">
            <button className="bg-[#ef4444] text-white text-xs font-bold px-3 py-2 rounded-xl">
              결제하기
            </button>
          </Link>
        </div>
      )}

      {/* 메인 카드 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">{formatDate()}</div>
            <div className="text-[#0a0a0a] text-4xl font-black tracking-tighter">
              {isCheckedIn && checkInTime ? formatWorkTime(workMinutes) : workHours}
            </div>
            <div className="text-[#6b6b6b] text-xs mt-1">
              {currentLocation !== "-" ? `📍 ${currentLocation}` : "위치 미확인"}
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
            isCheckedIn
              ? "bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]"
              : "bg-[#f8f8f8] text-[#a0a0a0] border border-[#e5e5e5]"
          }`}>
            {isCheckedIn ? "근무중" : checkOutTime ? "퇴근완료" : "미출근"}
          </div>
        </div>
        <div className="flex gap-4 pt-4 border-t border-[#e5e5e5]">
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">출근</div>
            <div className={`text-sm font-bold ${checkInTime ? "text-[#16a34a]" : "text-[#a0a0a0]"}`}>
              {formatTime(checkInTime)}
            </div>
          </div>
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">퇴근</div>
            <div className={`text-sm font-bold ${checkOutTime ? "text-[#ef4444]" : "text-[#a0a0a0]"}`}>
              {formatTime(checkOutTime)}
            </div>
          </div>
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">위치</div>
            <div className="text-[#6b6b6b] text-sm font-bold">
              {currentLocation === "-" ? "--" : currentLocation}
            </div>
          </div>
        </div>
      </div>

      {/* 출퇴근 버튼 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={handleCheckIn}
          disabled={isCheckedIn || !!checkOutTime || gpsLoading || planExpired}
          className="bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-sm shadow-[0_4px_16px_rgba(91,94,244,0.3)]"
        >
          {gpsLoading ? "⏳ 확인중..." : planExpired ? "🔒 결제 필요" : "📍 출근하기"}
        </button>
        <button
          onClick={handleCheckOut}
          disabled={!isCheckedIn || gpsLoading || planExpired}
          className="bg-white border border-[#e5e5e5] hover:bg-[#f8f8f8] disabled:opacity-40 disabled:cursor-not-allowed text-[#6b6b6b] font-bold py-4 rounded-xl transition-all text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        >
          {gpsLoading ? "⏳ 확인중..." : planExpired ? "🔒 결제 필요" : "🏠 퇴근하기"}
        </button>
      </div>

      {/* 오늘의 기록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">오늘의 기록</div>
        {!checkInTime ? (
          <div className="text-[#a0a0a0] text-sm text-center py-6">아직 기록이 없어요</div>
        ) : (
          <div className="space-y-3">
            {checkInTime && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#16a34a]"></div>
                <div>
                  <div className="text-[#0a0a0a] text-sm font-medium">출근</div>
                  <div className="text-[#6b6b6b] text-xs">{formatTime(checkInTime)} · {currentLocation}</div>
                </div>
              </div>
            )}
            {checkOutTime && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                <div>
                  <div className="text-[#0a0a0a] text-sm font-medium">퇴근</div>
                  <div className="text-[#6b6b6b] text-xs">{formatTime(checkOutTime)} · {checkOutLocation !== "-" ? checkOutLocation : "위치 미확인"}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 메뉴 */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/report">
          <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-lg">📊</span>
            <div>
              <div className="text-[#0a0a0a] text-sm font-bold">리포트</div>
              <div className="text-[#6b6b6b] text-xs">주간/월간</div>
            </div>
          </div>
        </Link>
        <Link href="/calendar">
          <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-lg">🗓️</span>
            <div>
              <div className="text-[#0a0a0a] text-sm font-bold">달력</div>
              <div className="text-[#6b6b6b] text-xs">근로 기록</div>
            </div>
          </div>
        </Link>
        {isAdmin && (
          <Link href="/admin">
            <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-lg">🏢</span>
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">관리자</div>
                <div className="text-[#6b6b6b] text-xs">팀 현황</div>
              </div>
            </div>
          </Link>
        )}
        {user?.email === "eunsang0510@gmail.com" && (
          <Link href="/superadmin">
            <div className="bg-[#f0f0ff] border border-[#c7c8fa] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer">
              <span className="text-lg">⚙️</span>
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">시스템 관리</div>
                <div className="text-[#4a4de0] text-xs">SUPERADMIN</div>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-5">
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#0a0a0a] font-black">비밀번호 변경</div>
              <button onClick={() => { setShowPasswordModal(false); setCurrentPassword(""); setNewPassword(""); }} className="text-[#a0a0a0] hover:text-[#0a0a0a] text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">현재 비밀번호</div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호 입력"
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
              </div>
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">새 비밀번호</div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 입력 (6자 이상)"
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                {passwordLoading ? "변경 중..." : "비밀번호 변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}