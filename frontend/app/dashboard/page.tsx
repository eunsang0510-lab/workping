"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getAddressFromCoords } from "@/lib/kakao";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface LocationRecord {
  latitude: number;
  longitude: number;
  timestamp: string;
  place_name: string;
  type: "checkin" | "checkout";
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [workHours, setWorkHours] = useState("0h 0m");
  const [currentLocation, setCurrentLocation] = useState("-");
  const [records, setRecords] = useState<LocationRecord[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchTodayAttendance(user.uid);
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchTodayAttendance = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/summary/${userId}`);
      const data = await res.json();

      if (data.checkin) {
        setIsCheckedIn(!data.checkout);
        setCheckInTime(data.checkin);
        setCurrentLocation(data.checkin_address || "-");
      }
      if (data.checkout) {
        setCheckOutTime(data.checkout);
        const minutes = Math.floor(
          (new Date(data.checkout).getTime() - new Date(data.checkin).getTime()) / 1000 / 60
        );
        setWorkHours(formatWorkTime(minutes));
      }
    } catch (error) {
      console.error("오늘 기록 로딩 실패:", error);
    }
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
    return Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
  };

  const formatWorkTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const handleCheckIn = async () => {
    setGpsLoading(true);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const nowISO = new Date().toISOString();
      const address = await getAddressFromCoords(latitude, longitude);

      await fetch(`${API_URL}/api/location/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.uid,
          latitude,
          longitude,
          timestamp: nowISO,
          type: "checkin",
          address,
        }),
      });

      setIsCheckedIn(true);
      setCheckInTime(nowISO);
      setCurrentLocation(address);
      setRecords(prev => [...prev, {
        latitude, longitude, timestamp: nowISO, place_name: address, type: "checkin"
      }]);
    } catch (error) {
      alert("GPS 위치를 가져올 수 없어요.");
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setGpsLoading(true);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const nowISO = new Date().toISOString();
      const address = await getAddressFromCoords(latitude, longitude);

      await fetch(`${API_URL}/api/location/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.uid,
          latitude,
          longitude,
          timestamp: nowISO,
          type: "checkout",
          address,
        }),
      });

      setIsCheckedIn(false);
      setCheckOutTime(nowISO);
      if (checkInTime) {
        setWorkHours(formatWorkTime(calcWorkMinutes(checkInTime)));
      }
      setRecords(prev => [...prev, {
        latitude, longitude, timestamp: nowISO, place_name: address, type: "checkout"
      }]);
    } catch (error) {
      alert("GPS 위치를 가져올 수 없어요.");
    } finally {
      setGpsLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = () => {
    return now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-[#6366f1] text-lg font-semibold">로딩 중...</div>
      </div>
    );
  }

  const workMinutes = isCheckedIn && checkInTime ? calcWorkMinutes(checkInTime) : 0;

  return (
    <main className="min-h-screen bg-[#09090b] p-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-xl font-bold tracking-tight">
          Work<span className="text-[#6366f1]">Ping</span>
        </h1>
        <button
          onClick={async () => { await signOut(auth); router.push("/"); }}
          className="w-9 h-9 bg-[#18181b] border border-[#27272a] rounded-full flex items-center justify-center text-sm"
        >
          👤
        </button>
      </div>

      {/* 메인 카드 */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[#71717a] text-xs mb-1">{formatDate()}</div>
            <div className="text-white text-4xl font-bold tracking-tighter">
              {isCheckedIn && checkInTime ? formatWorkTime(workMinutes) : workHours}
            </div>
            <div className="text-[#71717a] text-xs mt-1">
              {currentLocation !== "-" ? `📍 ${currentLocation}` : "위치 미확인"}
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            isCheckedIn
              ? "bg-[#052e16] text-[#22c55e] border border-[#166534]"
              : "bg-[#18181b] text-[#71717a] border border-[#27272a]"
          }`}>
            {isCheckedIn ? "근무중" : checkOutTime ? "퇴근완료" : "미출근"}
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-[#27272a]">
          <div>
            <div className="text-[#71717a] text-xs mb-1">출근</div>
            <div className={`text-sm font-semibold ${checkInTime ? "text-[#22c55e]" : "text-[#52525b]"}`}>
              {formatTime(checkInTime)}
            </div>
          </div>
          <div>
            <div className="text-[#71717a] text-xs mb-1">퇴근</div>
            <div className={`text-sm font-semibold ${checkOutTime ? "text-[#ef4444]" : "text-[#52525b]"}`}>
              {formatTime(checkOutTime)}
            </div>
          </div>
          <div>
            <div className="text-[#71717a] text-xs mb-1">위치</div>
            <div className="text-[#a1a1aa] text-sm font-semibold">
              {currentLocation === "-" ? "--" : currentLocation}
            </div>
          </div>
        </div>
      </div>

      {/* 출퇴근 버튼 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={handleCheckIn}
          disabled={isCheckedIn || gpsLoading}
          className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all text-sm"
        >
          {gpsLoading ? "⏳ 확인중..." : "📍 출근하기"}
        </button>
        <button
          onClick={handleCheckOut}
          disabled={!isCheckedIn || gpsLoading}
          className="bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] disabled:opacity-40 disabled:cursor-not-allowed text-[#a1a1aa] font-semibold py-4 rounded-xl transition-all text-sm"
        >
          {gpsLoading ? "⏳ 확인중..." : "🏠 퇴근하기"}
        </button>
      </div>

      {/* 오늘의 기록 */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 mb-4">
        <div className="text-[#71717a] text-xs font-semibold mb-3 uppercase tracking-wider">오늘의 기록</div>
        {!checkInTime ? (
          <div className="text-[#52525b] text-sm text-center py-6">아직 기록이 없어요</div>
        ) : (
          <div className="space-y-3">
            {checkInTime && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
                <div>
                  <div className="text-white text-sm">출근</div>
                  <div className="text-[#71717a] text-xs">{formatTime(checkInTime)} · {currentLocation}</div>
                </div>
              </div>
            )}
            {checkOutTime && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                <div>
                  <div className="text-white text-sm">퇴근</div>
                  <div className="text-[#71717a] text-xs">{formatTime(checkOutTime)}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 메뉴 */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/report">
          <div className="bg-[#18181b] border border-[#27272a] hover:border-[#6366f1] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer">
            <span className="text-lg">📊</span>
            <div>
              <div className="text-white text-sm font-medium">리포트</div>
              <div className="text-[#71717a] text-xs">주간/월간</div>
            </div>
          </div>
        </Link>
        <Link href="/admin">
          <div className="bg-[#18181b] border border-[#27272a] hover:border-[#6366f1] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer">
            <span className="text-lg">🏢</span>
            <div>
              <div className="text-white text-sm font-medium">관리자</div>
              <div className="text-[#71717a] text-xs">팀 현황</div>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}