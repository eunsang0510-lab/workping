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
  const [workHours, setWorkHours] = useState("0시간 0분");
  const [currentLocation, setCurrentLocation] = useState("위치 확인 중...");
  const [records, setRecords] = useState<LocationRecord[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS를 지원하지 않는 브라우저예요"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const calcWorkHours = (checkIn: string) => {
    const start = new Date(checkIn);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}시간 ${minutes}분`;
  };

  const handleCheckIn = async () => {
    setGpsLoading(true);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const now = new Date().toISOString();

      const address = await getAddressFromCoords(latitude, longitude);

      await fetch(`${API_URL}/api/location/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.uid,
          latitude,
          longitude,
          timestamp: now,
          type: "checkin",
          address: address,
        }),
      });

      setIsCheckedIn(true);
      setCheckInTime(now);
      setCurrentLocation(address);
      setRecords(prev => [...prev, {
        latitude,
        longitude,
        timestamp: now,
        place_name: address,
        type: "checkin"
      }]);

      alert(`✅ 출근 완료!\n위치: ${address}`);
    } catch (error) {
      alert("GPS 위치를 가져올 수 없어요. 위치 권한을 허용해주세요.");
      console.error(error);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setGpsLoading(true);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const now = new Date().toISOString();

      const address = await getAddressFromCoords(latitude, longitude);

      await fetch(`${API_URL}/api/location/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.uid,
          latitude,
          longitude,
          timestamp: now,
          type: "checkout",
          address: address,
        }),
      });

      setIsCheckedIn(false);
      setCheckOutTime(now);
      if (checkInTime) {
        setWorkHours(calcWorkHours(checkInTime));
      }
      setRecords(prev => [...prev, {
        latitude,
        longitude,
        timestamp: now,
        place_name: address,
        type: "checkout"
      }]);

      alert(`✅ 퇴근 완료!\n위치: ${address}`);
    } catch (error) {
      alert("GPS 위치를 가져올 수 없어요. 위치 권한을 허용해주세요.");
      console.error(error);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">W</span>
          </div>
          <h1 className="text-white text-xl font-bold">WorkPing</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 환영 메시지 */}
      <div className="bg-blue-600 rounded-2xl p-6 mb-6">
        <h2 className="text-white text-xl font-bold mb-1">
          안녕하세요, {user?.displayName}님! 👋
        </h2>
        <p className="text-blue-200 text-sm">
          {isCheckedIn ? "✅ 현재 근무 중이에요" : "오늘도 WorkPing과 함께 스마트하게 근무하세요"}
        </p>
      </div>

      {/* 오늘의 근태 현황 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: "출근 시간", value: formatTime(checkInTime), icon: "🟢" },
          { label: "퇴근 시간", value: formatTime(checkOutTime), icon: "🔴" },
          { label: "근무 시간", value: isCheckedIn ? calcWorkHours(checkInTime!) : workHours, icon: "⏰" },
          { label: "현재 위치", value: currentLocation, icon: "📍" },
        ].map((item, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-4">
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="text-gray-400 text-xs mb-1">{item.label}</div>
            <div className="text-white font-bold text-sm">{item.value}</div>
          </div>
        ))}
      </div>

      {/* 출퇴근 버튼 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={handleCheckIn}
          disabled={isCheckedIn || gpsLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
        >
          {gpsLoading ? "⏳" : "📍"} 출근하기
        </button>
        <button
          onClick={handleCheckOut}
          disabled={!isCheckedIn || gpsLoading}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
        >
          {gpsLoading ? "⏳" : "🏠"} 퇴근하기
        </button>
      </div>

      {/* 오늘의 위치 기록 */}
      <div className="bg-gray-900 rounded-2xl p-5 mb-4">
        <h3 className="text-white font-bold mb-4">📋 오늘의 위치 기록</h3>
        {records.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            아직 기록된 위치가 없어요
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                <span className="text-xl">
                  {record.type === "checkin" ? "🟢" : "🔴"}
                </span>
                <div>
                  <div className="text-white text-sm font-semibold">
                    {record.type === "checkin" ? "출근" : "퇴근"}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {formatTime(record.timestamp)} | {record.place_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 리포트 링크 */}
      <Link href="/report">
        <div className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 mb-4 flex items-center justify-between cursor-pointer transition">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <div className="text-white font-bold">근태 리포트</div>
              <div className="text-gray-400 text-xs">주간/월간 근무 기록 확인</div>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </div>
      </Link>

      {/* 관리자 링크 */}
      <Link href="/admin">
        <div className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏢</span>
            <div>
              <div className="text-white font-bold">관리자 페이지</div>
              <div className="text-gray-400 text-xs">팀 근태 현황 관리</div>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </div>
      </Link>
    </main>
  );
}