"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getAddressFromCoords } from "@/lib/kakao";
import Link from "next/link";
import Toast from "@/components/Toast";

import { API_URL } from "@/lib/api";

const getAuthHeader = async () => {
  if (!auth.currentUser) {
    throw new Error("로그인이 필요해요. 다시 로그인해주세요.");
  }
  try {
    const token = await auth.currentUser.getIdToken();
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };
  } catch (e: any) {
    const code = e?.code || "";
    const message = e?.message || "";
    if (
      code.includes("user-not-found") ||
      code.includes("user-disabled") ||
      code.includes("token-expired") ||
      message.includes("NoTWAFound") ||
      code.includes("NoTWAFound")
    ) {
      await signOut(auth);
      throw new Error("앱 재설치 후 재로그인이 필요해요. 로그인 화면으로 이동합니다.");
    }
    throw new Error("인증에 실패했어요. 다시 로그인해주세요.");
  }
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

interface Notice {
  id: string;
  title: string;
  content: string;
  notice_type: string;
  created_at: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url: string;
  is_read: boolean;
  created_at: string;
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
  const [leaveEnabled, setLeaveEnabled] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);
  const [showNoticePopup, setShowNoticePopup] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [locationServiceOff, setLocationServiceOff] = useState(false);
  const [isRemote, setIsRemote] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [weeklyMinutes, setWeeklyMinutes] = useState<number | null>(null);
  const [overtime52h, setOvertime52h] = useState(false);
  const router = useRouter();

  const trimCity = (addr: string) =>
    addr === "-" ? addr : addr.replace(/^[^\s]+(특별시|광역시|특별자치시|특별자치도|도)\s*/, "").trim() || addr;

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lastDateRef = useRef<string | null>(null);

  // 출근 중일 때 주간 근무시간 1분마다 갱신
  useEffect(() => {
    if (!isCheckedIn || !user) return;
    const timer = setInterval(() => fetchWeeklyOvertime(user.uid), 60 * 1000);
    return () => clearInterval(timer);
  }, [isCheckedIn, user]);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    // GPS 권한 상태 확인 및 초기 요청
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setGpsPermission(result.state as "granted" | "denied" | "prompt");
        result.onchange = () => {
          setGpsPermission(result.state as "granted" | "denied" | "prompt");
        };
      });
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => { setGpsPermission("granted"); },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) setGpsPermission("denied");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
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
        fetchUnreadNotices(user.uid);
        fetchNotifications(user.uid);
        registerPushNotification(user.uid);
        fetchWeeklyOvertime(user.uid);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const registerPushNotification = async (userId: string) => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // 권한 요청 (처음이면 팝업, 이미 허용/거부면 즉시 반환)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    try {
      const reg = await navigator.serviceWorker.ready;

      // VAPID 공개키 가져오기
      const keyRes = await fetch(`${API_URL}/api/push/vapid-public-key`);
      const { publicKey } = await keyRes.json();
      if (!publicKey) return;

      // 기존 구독 확인 또는 새로 구독
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const subJson = sub.toJSON() as any;
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_URL}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });
    } catch (e) {
      console.error("Push 구독 실패:", e);
    }
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  const fetchUnreadNotices = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/notice/unread/${userId}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      if (data.notices && data.notices.length > 0) {
        setNotices(data.notices);
        setCurrentNoticeIndex(0);
        setShowNoticePopup(true);
      }
    } catch (error) {
      console.error("공지 로딩 실패:", error);
    }
  };

  const handleNoticeRead = async (noticeId: string) => {
    try {
      await fetch(`${API_URL}/api/notice/read/${noticeId}?user_id=${user?.uid}`, {
        method: "POST",
        headers: await getAuthHeader(),
      });
    } catch (error) {
      console.error("읽음 처리 실패:", error);
    }
  };

  const handleNextNotice = async () => {
    await handleNoticeRead(notices[currentNoticeIndex].id);
    if (currentNoticeIndex < notices.length - 1) {
      setCurrentNoticeIndex(currentNoticeIndex + 1);
    } else {
      setShowNoticePopup(false);
    }
  };

  const handleCloseNotice = async () => {
    await handleNoticeRead(notices[currentNoticeIndex].id);
    setShowNoticePopup(false);
  };

  const fetchTodayAttendance = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/summary/${userId}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();

      // 오늘 기록 기준으로 상태를 항상 초기화 — 자정이 지나 새 하루가 시작되면
      // 전날 퇴근을 안 했더라도(어제 기록은 어제 것으로 남고) 오늘은 미출근 상태로 보여야 해요.
      if (data.checkin) {
        setCheckInTime(data.checkin);
        setCurrentLocation(data.checkin_address || "-");
        setIsRemote(data.is_remote || false);
        setIsCheckedIn(!data.checkout);
      } else {
        setCheckInTime(null);
        setCurrentLocation("-");
        setIsRemote(false);
        setIsCheckedIn(false);
      }

      if (data.checkin && data.checkout) {
        setCheckOutTime(data.checkout);
        setCheckOutLocation(data.checkout_address || "-");
        const minutes = Math.floor(
          (new Date(data.checkout).getTime() - new Date(data.checkin).getTime()) / 1000 / 60
        );
        setWorkHours(formatWorkTime(minutes));
      } else {
        setCheckOutTime(null);
        setCheckOutLocation("-");
        setWorkHours("0h 0m");
      }
    } catch (error) {
      console.error("오늘 기록 로딩 실패:", error);
    }
  };

  const fetchAdminStatus = async (userId: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${API_URL}/api/auth/admin-check/${userId}`);
        const data = await res.json();
        setIsAdmin(data.is_admin || false);
        return;
      } catch (error) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  };

const fetchPlanStatus = async (userId: string) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_URL}/api/company/my/${userId}`);
      const data = await res.json();
      if (data.company_id) {
        setCompanyId(data.company_id);
        if (data.company_name) setCompanyName(data.company_name);
        const subRes = await fetch(`${API_URL}/api/payment/subscription/${data.company_id}`, {
          headers: await getAuthHeader(),
        });
        const subData = await subRes.json();
        if (subData.status === "expired") {
          setPlanExpired(true);
        }
        if (data.leave_enabled) {
          setLeaveEnabled(true);
          checkTodayLeave(userId);
        }
        if (data.force_password_change) {
          setForcePasswordChange(true);
        }
        if (data.is_manager) {
          setIsManager(true);
        }
      }
      return;
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
};

const checkTodayLeave = async (userId: string) => {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/leave/my/${userId}`, { headers });
    const data = await res.json();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const onLeave = (data.leaves || []).some(
      (l: any) => l.status === "approved" && !l.is_half && l.start_date <= today && today <= l.end_date
    );
    setIsOnLeave(onLeave);
  } catch {}
};

const fetchWeeklyOvertime = async (userId: string) => {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/attendance/weekly/${userId}`, { headers });
    const data = await res.json();
    setWeeklyMinutes(data.total_minutes ?? null);
    setOvertime52h(data.overtime_52h ?? false);
  } catch {}
};

// 자정이 지나 날짜가 바뀌면 오늘 출퇴근/연차 상태를 새로 불러옴
// (앱을 계속 켜둔 채로 자정을 넘기면, 전날 퇴근을 안 했어도 오늘은 미출근 상태로 리셋되어야 함)
useEffect(() => {
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  if (lastDateRef.current === null) {
    lastDateRef.current = todayStr;
    return;
  }
  if (lastDateRef.current !== todayStr) {
    lastDateRef.current = todayStr;
    if (user) {
      fetchTodayAttendance(user.uid);
      fetchWeeklyOvertime(user.uid);
      checkTodayLeave(user.uid);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [now, user]);

const fetchNotifications = async (userId: string) => {
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/notifications/${userId}`, { headers });
    const data = await res.json();
    setNotifications(data.notifications || []);
    setUnreadCount(data.unread_count || 0);
  } catch {}
};

const markNotificationRead = async (notif: NotificationItem) => {
  if (!notif.is_read) {
    try {
      const headers = await getAuthHeader();
      await fetch(`${API_URL}/api/notifications/read/${notif.id}`, { method: "POST", headers });
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }
  router.push(notif.url);
  setShowNotifPanel(false);
};

const markAllRead = async () => {
  if (!user) return;
  try {
    const headers = await getAuthHeader();
    await fetch(`${API_URL}/api/notifications/read-all/${user.uid}`, { method: "POST", headers });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  } catch {}
};

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS를 지원하지 않는 브라우저예요"));
        return;
      }

      const GUIDE = "Android 설정 → 앱 → WorkPing(또는 Chrome) → 권한 → 위치 → 허용";

      const handleFinalError = (error: GeolocationPositionError) => {
        const code = error.code;
        const msg = error.message || "";
        if (code === error.PERMISSION_DENIED || msg.includes("NoTWAFound")) {
          reject(new Error(`위치 권한이 거부됐어요.\n` + GUIDE));
        } else if (code === error.POSITION_UNAVAILABLE) {
          setLocationServiceOff(true);
          reject(new Error(`기기 위치 서비스가 꺼져 있어요.`));
        } else if (code === error.TIMEOUT) {
          reject(new Error(`위치 조회 시간이 초과됐어요. GPS를 켜고 야외에서 다시 시도해주세요.`));
        } else {
          reject(new Error(`위치 오류: ${msg}\n` + GUIDE));
        }
      };

      // 1단계: 네트워크 위치 (빠름)
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err1) => {
          if (err1.code === err1.PERMISSION_DENIED || err1.message?.includes("NoTWAFound")) {
            handleFinalError(err1);
            return;
          }
          // 2단계: GPS (정밀)
          navigator.geolocation.getCurrentPosition(
            resolve,
            (err2) => {
              if (err2.code === err2.PERMISSION_DENIED) {
                handleFinalError(err2);
                return;
              }
              // 3단계: watchPosition으로 위치 신호 대기 (최대 20초)
              let watchId: number;
              const timer = setTimeout(() => {
                navigator.geolocation.clearWatch(watchId);
                handleFinalError(err2);
              }, 20000);
              watchId = navigator.geolocation.watchPosition(
                (pos) => {
                  clearTimeout(timer);
                  navigator.geolocation.clearWatch(watchId);
                  resolve(pos);
                },
                (err3) => {
                  clearTimeout(timer);
                  navigator.geolocation.clearWatch(watchId);
                  handleFinalError(err3);
                },
                { enableHighAccuracy: true, maximumAge: 0 }
              );
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const calcWorkMinutes = (checkIn: string) => {
    const str = checkIn.endsWith("Z") || checkIn.includes("+")
      ? checkIn
      : checkIn + "Z";
    const start = new Date(str);
    const nowUTC = new Date();
    return Math.floor((nowUTC.getTime() - start.getTime()) / 1000 / 60);
  };

  const formatWorkTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const validateAndRecord = async (type: "checkin" | "checkout") => {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;
    const nowISO = new Date().toISOString();
    const address = await getAddressFromCoords(latitude, longitude);

    let isRemoteWork = false;
    if (companyId) {
      const valRes = await fetch(`${API_URL}/api/company/locations/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, latitude, longitude, user_id: user?.uid }),
      });
      const valData = await valRes.json();
      if (!valData.allowed) {
        throw new Error(valData.message || "출근 가능 위치가 아니에요");
      }
      isRemoteWork = valData.is_remote || false;
    }

    const authHeaders = await getAuthHeader();
    const recRes = await fetch(`${API_URL}/api/location/record`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ user_id: user?.uid, latitude, longitude, timestamp: nowISO, type, address, is_remote: isRemoteWork }),
    });
    if (!recRes.ok) {
      const recData = await recRes.json().catch(() => ({}));
      if (recRes.status === 401 || recRes.status === 403) {
        await signOut(auth);
        throw new Error("계정 인증이 만료됐어요. 다시 로그인해주세요.");
      }
      throw new Error(recData.detail || "출근 기록 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    }

    return { latitude, longitude, nowISO, address, isRemoteWork };
  };

  const handleCheckIn = async () => {
    if (planExpired) {
      showToast("구독이 만료됐어요. 결제 후 이용해주세요.", "error");
      return;
    }
    setGpsLoading(true);
    try {
      const { latitude, longitude, nowISO, address, isRemoteWork } = await validateAndRecord("checkin");
      setIsCheckedIn(true);
      setCheckInTime(nowISO);
      setCurrentLocation(address);
      setIsRemote(isRemoteWork);
      setRecords((prev) => [...prev, { latitude, longitude, timestamp: nowISO, place_name: address, type: "checkin" }]);
      showToast(isRemoteWork ? "재택 출근 완료! 🏠" : "출근 완료!", "success");
    } catch (error: any) {
      const msg = error.message || "GPS 위치를 가져올 수 없어요.";
      showToast(msg, "error");
      if (msg.includes("재로그인")) {
        setTimeout(() => router.push("/login"), 2000);
      }
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
      const { latitude, longitude, nowISO, address } = await validateAndRecord("checkout");
      setIsCheckedIn(false);
      setCheckOutTime(nowISO);
      setCheckOutLocation(address);
      if (checkInTime) setWorkHours(formatWorkTime(calcWorkMinutes(checkInTime)));
      setRecords((prev) => [...prev, { latitude, longitude, timestamp: nowISO, place_name: address, type: "checkout" }]);
      showToast("퇴근 완료!", "success");
      if (user) fetchWeeklyOvertime(user.uid);
    } catch (error: any) {
      const msg = error.message || "GPS 위치를 가져올 수 없어요.";
      showToast(msg, "error");
      if (msg.includes("재로그인")) {
        setTimeout(() => router.push("/login"), 2000);
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast("모든 항목을 입력해주세요", "error");
      return;
    }
    const isValidPassword = newPassword.length >= 8 && /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
    if (!isValidPassword) {
      setPasswordError("비밀번호는 영문+숫자 포함 8자 이상이어야 해요. 조건을 맞춰서 다시 입력해주세요.");
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
      setPasswordError("");
      if (forcePasswordChange && user?.uid) {
        try {
          const headers = await getAuthHeader();
          await fetch(`${API_URL}/api/company/members/${user.uid}/password-changed`, {
            method: "PUT",
            headers,
          });
        } catch {}
        setForcePasswordChange(false);
      }
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setPasswordError("현재 비밀번호가 올바르지 않아요");
      } else {
        setPasswordError("비밀번호 변경 실패: " + e.message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
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

      {/* 강제 비밀번호 변경 모달 */}
      {forcePasswordChange && (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="bg-[#f59e0b] px-5 py-4 flex items-start justify-between">
              <div>
                <div className="text-white font-black text-base">⚠️ 비밀번호 변경 필요</div>
                <div className="text-white/80 text-xs mt-1">초기 비밀번호를 반드시 변경해주세요</div>
              </div>
              <button
                onClick={() => { setForcePasswordChange(false); setPasswordError(""); setCurrentPassword(""); setNewPassword(""); }}
                className="text-white/70 hover:text-white text-xl leading-none ml-3 mt-0.5"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <p className="text-[#6b6b6b] text-sm mb-3 leading-relaxed">
                보안을 위해 초기 비밀번호를 새 비밀번호로 변경해야 해요.<br/>
                변경 전까지 이 화면이 계속 표시됩니다.
              </p>
              <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-lg px-3 py-2 mb-3 text-[#5b5ef4] text-xs leading-relaxed">
                비밀번호 조건: 영문+숫자 포함 8자 이상
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[#a0a0a0] text-xs mb-1">현재 비밀번호 (초기 비밀번호)</div>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(""); }}
                    placeholder="초기 비밀번호 입력"
                    className={`w-full bg-white border text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0] ${passwordError ? "border-[#ef4444]" : "border-[#e5e5e5]"}`}
                  />
                </div>
                <div>
                  <div className="text-[#a0a0a0] text-xs mb-1">새 비밀번호</div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
                    placeholder="영문+숫자 포함 8자 이상"
                    className={`w-full bg-white border text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0] ${passwordError ? "border-[#ef4444]" : "border-[#e5e5e5]"}`}
                  />
                </div>
                {passwordError && (
                  <div className="text-[#ef4444] text-xs">{passwordError}</div>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={passwordLoading}
                  className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  {passwordLoading ? "변경 중..." : "비밀번호 변경하기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 공지사항 팝업 */}
      {showNoticePopup && notices.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.2)] overflow-hidden">
            {/* 헤더 */}
            <div className={`px-5 py-4 flex items-center justify-between ${
              notices[currentNoticeIndex].notice_type === "system"
                ? "bg-[#5b5ef4]"
                : "bg-[#0a0a0a]"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-bold">
                  {notices[currentNoticeIndex].notice_type === "system" ? "📢 시스템 공지" : "🏢 회사 공지"}
                </span>
                {notices.length > 1 && (
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {currentNoticeIndex + 1}/{notices.length}
                  </span>
                )}
              </div>
              <button onClick={handleCloseNotice} className="text-white/70 hover:text-white text-lg">✕</button>
            </div>
            {/* 내용 */}
            <div className="p-5">
              <div className="text-[#0a0a0a] font-black text-base mb-3">
                {notices[currentNoticeIndex].title}
              </div>
              <div className="text-[#6b6b6b] text-sm leading-relaxed whitespace-pre-wrap">
                {notices[currentNoticeIndex].content}
              </div>
              <div className="text-[#a0a0a0] text-xs mt-3">
                {new Date(notices[currentNoticeIndex].created_at).toLocaleDateString("ko-KR")}
              </div>
            </div>
            {/* 버튼 */}
            <div className="px-5 pb-5">
              <button
                onClick={handleNextNotice}
                className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                {currentNoticeIndex < notices.length - 1 ? "다음 공지 보기 →" : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[#0a0a0a] text-xl font-black tracking-tight">
            Work<span className="text-[#5b5ef4]">Ping</span>
          </h1>
          {companyName && (
            <span className="text-[#a0a0a0] text-xs font-medium truncate max-w-[130px]">{companyName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 매뉴얼 */}
          <Link href="/manual">
            <button
              className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              title="사용자 매뉴얼"
            >
              📖
            </button>
          </Link>

          {/* 알림 벨 */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifPanel(!showNotifPanel); setShowUserMenu(false); }}
              className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)] relative"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifPanel && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                <div className="absolute right-0 top-11 bg-white border border-[#e5e5e5] rounded-2xl z-50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-80 max-h-[70vh] flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5]">
                    <span className="text-[#0a0a0a] text-sm font-bold">알림</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[#5b5ef4] text-xs font-semibold hover:underline"
                      >
                        전체 읽음
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-[#a0a0a0] text-sm">알림이 없어요</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => markNotificationRead(n)}
                          className={`w-full text-left px-4 py-3 border-b border-[#f0f0f0] last:border-0 hover:bg-[#f8f8ff] transition-all ${!n.is_read ? "bg-[#f5f5ff]" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.is_read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5b5ef4] shrink-0" />}
                            <div className={!n.is_read ? "" : "pl-3.5"}>
                              <div className="text-[#0a0a0a] text-xs font-bold">{n.title}</div>
                              <div className="text-[#6b6b6b] text-xs mt-0.5 leading-relaxed">{n.body}</div>
                              <div className="text-[#a0a0a0] text-[10px] mt-1">
                                {new Date(n.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 유저 메뉴 */}
          <div className="relative">
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifPanel(false); }}
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
                    onClick={async () => { await signOut(auth); router.push("/"); }}
                    className="w-full text-left px-2 py-2 text-[#ef4444] text-sm hover:bg-[#f8f8f8] rounded-xl transition-all"
                  >
                    🚪 로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 앱 설치 유도 배너 */}
      {!isStandalone && installPrompt && (
        <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[#5b5ef4] text-sm font-bold mb-0.5">앱으로 설치하면 더 편해요</div>
            <div className="text-[#6b6b6b] text-xs">주소창 없이 앱처럼 사용할 수 있어요</div>
          </div>
          <button
            onClick={async () => {
              installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              if (outcome === "accepted") setIsStandalone(true);
              setInstallPrompt(null);
            }}
            className="bg-[#5b5ef4] text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap ml-3"
          >
            설치하기
          </button>
        </div>
      )}

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
              {checkOutTime && !isCheckedIn
                ? checkOutLocation !== "-" ? `📍 ${trimCity(checkOutLocation)}` : "위치 미확인"
                : currentLocation !== "-" ? `📍 ${trimCity(currentLocation)}` : "위치 미확인"
              }
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              isCheckedIn
                ? "bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]"
                : "bg-[#f8f8f8] text-[#a0a0a0] border border-[#e5e5e5]"
            }`}>
              {isCheckedIn ? "근무중" : checkOutTime ? "퇴근완료" : "미출근"}
            </div>
            {isRemote && checkInTime && (
              <div className="px-2 py-0.5 rounded-full bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] text-xs font-medium">
                🏠 재택근무
              </div>
            )}
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
        </div>
      </div>

      {/* 주간 근무시간 */}
      {weeklyMinutes !== null && (
        <div className={`rounded-2xl p-4 mb-4 flex items-center justify-between ${
          overtime52h
            ? "bg-[#fef2f2] border border-[#fecaca]"
            : "bg-white border border-[#e5e5e5]"
        } shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}>
          <div>
            <div className="text-[#a0a0a0] text-xs mb-0.5">이번 주 근무시간</div>
            <div className={`text-lg font-black ${overtime52h ? "text-[#ef4444]" : "text-[#0a0a0a]"}`}>
              {Math.floor(weeklyMinutes / 60)}시간 {weeklyMinutes % 60}분
            </div>
            {!overtime52h && weeklyMinutes > 40 * 60 && (
              <div className="text-[#f59e0b] text-xs mt-0.5 font-medium">
                ⏱ 52시간까지 {Math.floor((52 * 60 - weeklyMinutes) / 60)}시간 {(52 * 60 - weeklyMinutes) % 60}분 남음
              </div>
            )}
            {overtime52h && (
              <div className="text-[#ef4444] text-xs mt-0.5 font-medium">⚠️ 주 52시간을 초과했어요</div>
            )}
          </div>
          <div className={`text-2xl font-black ${overtime52h ? "text-[#ef4444]" : "text-[#a0a0a0]"}`}>
            {overtime52h ? "⚠️" : `${Math.round(weeklyMinutes / 60 / 52 * 100)}%`}
          </div>
        </div>
      )}

      {/* 연차 안내 */}
      {isOnLeave && (
        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4 mb-4">
          <div className="text-[#16a34a] text-sm font-bold mb-0.5">🏖️ 오늘은 연차예요</div>
          <div className="text-[#6b6b6b] text-xs">승인된 연차 중이라 출퇴근이 비활성화되어 있어요</div>
        </div>
      )}

      {/* 출퇴근 버튼 */}
      {/* GPS 권한 거부 안내 */}
      {gpsPermission === "denied" && (
        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4 mb-4">
          <div className="text-[#ef4444] text-sm font-bold mb-1">📍 GPS 권한이 필요해요</div>
          <div className="text-[#6b6b6b] text-xs leading-relaxed mb-3">
            위치 권한이 거부되어 있어요.<br />
            아래 방법으로 직접 허용 후 앱을 새로고침해주세요.
          </div>
          <div className="bg-white border border-[#fecaca] rounded-xl p-3 space-y-2 mb-3">
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold mb-0.5">📱 안드로이드 (방법 1)</div>
              <div className="text-[#6b6b6b] text-xs">설정 → 앱 → WorkPing → 권한 → 위치 → 앱 사용 중에 허용</div>
            </div>
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold mb-0.5">📱 안드로이드 (방법 2 · Chrome 사이트 설정)</div>
              <div className="text-[#6b6b6b] text-xs">Chrome 앱 열기 → 오른쪽 상단 ⋮ → 설정 → 개인정보 보호 및 보안 → 사이트 설정 → 위치 → workping 허용</div>
            </div>
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold mb-0.5">🍎 아이폰 (iOS)</div>
              <div className="text-[#6b6b6b] text-xs">설정 → Safari(또는 Chrome) → 위치 → 허용</div>
            </div>
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold mb-0.5">🖥 PC 브라우저</div>
              <div className="text-[#6b6b6b] text-xs">주소창 왼쪽 자물쇠 아이콘 → 위치 → 허용</div>
            </div>
          </div>
          <button
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                () => {
                  setGpsPermission("granted");
                  showToast("위치 권한이 허용되었어요!", "success");
                },
                (error) => {
                  if (error.code === error.PERMISSION_DENIED) {
                    showToast("위치 권한이 거부된 상태예요. 위 안내에 따라 기기 설정에서 직접 허용 후 새로고침해주세요.", "error");
                  }
                },
              );
            }}
            className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold py-2.5 rounded-xl transition-all"
          >
            권한 확인하기
          </button>
        </div>
      )}

      {/* 기기 위치 서비스 꺼짐 안내 */}
      {locationServiceOff && (
        <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-2xl p-4 mb-4">
          <div className="text-[#ea580c] text-sm font-bold mb-1">📡 기기 위치 서비스가 꺼져 있어요</div>
          <div className="text-[#6b6b6b] text-xs leading-relaxed mb-3">
            앱 위치 권한은 허용되어 있지만, 기기의 GPS 스위치가 꺼진 상태예요.<br />
            아래 방법으로 위치 서비스를 켜주세요.
          </div>
          <div className="bg-white border border-[#fed7aa] rounded-xl p-3 space-y-2 mb-3">
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold mb-0.5">📱 빠른 방법</div>
              <div className="text-[#6b6b6b] text-xs">화면 상단을 아래로 내려 알림 패널 열기 → 위치(GPS) 아이콘 탭해서 켜기</div>
            </div>
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold mb-0.5">⚙️ 설정에서 변경</div>
              <div className="text-[#6b6b6b] text-xs">Android 설정 → 위치 → 위치 켜기 → 위치 모드를 &apos;정확도 높음&apos; 또는 &apos;배터리 절약&apos;으로 선택</div>
            </div>
          </div>
          <button
            onClick={() => {
              setLocationServiceOff(false);
              navigator.geolocation.getCurrentPosition(
                () => showToast("위치 서비스가 정상적으로 켜져 있어요!", "success"),
                () => setLocationServiceOff(true),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
              );
            }}
            className="w-full bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-bold py-2.5 rounded-xl transition-all"
          >
            다시 확인하기
          </button>
        </div>
      )}

      {/* 출퇴근 버튼 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={handleCheckIn}
          disabled={isCheckedIn || !!checkOutTime || gpsLoading || planExpired || isOnLeave}
          className="bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-sm shadow-[0_4px_16px_rgba(91,94,244,0.3)]"
        >
          {gpsLoading ? "⏳ 확인중..." : planExpired ? "🔒 결제 필요" : isOnLeave ? "🏖️ 연차" : "📍 출근하기"}
        </button>
        <button
          onClick={handleCheckOut}
          disabled={!isCheckedIn || gpsLoading || planExpired || isOnLeave}
          className="bg-white border border-[#e5e5e5] hover:bg-[#f8f8f8] disabled:opacity-40 disabled:cursor-not-allowed text-[#6b6b6b] font-bold py-4 rounded-xl transition-all text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        >
          {gpsLoading ? "⏳ 확인중..." : planExpired ? "🔒 결제 필요" : isOnLeave ? "🏖️ 연차" : "🏠 퇴근하기"}
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
                  <div className="text-[#6b6b6b] text-xs">{formatTime(checkInTime)} · {trimCity(currentLocation)}</div>
                </div>
              </div>
            )}
            {checkOutTime && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                <div>
                  <div className="text-[#0a0a0a] text-sm font-medium">퇴근</div>
                  <div className="text-[#6b6b6b] text-xs">{formatTime(checkOutTime)} · {checkOutLocation !== "-" ? trimCity(checkOutLocation) : "위치 미확인"}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 메뉴 */}
      <div className="grid grid-cols-2 gap-3">
        {leaveEnabled && (
          <Link href="/leave">
            <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-lg">🏖️</span>
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">연차관리</div>
                <div className="text-[#6b6b6b] text-xs">신청 및 내역</div>
              </div>
            </div>
          </Link>
        )}
        <Link href="/business-trip">
          <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-lg">✈️</span>
            <div>
              <div className="text-[#0a0a0a] text-sm font-bold">출장신청</div>
              <div className="text-[#6b6b6b] text-xs">출장 신청 및 현황</div>
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
        <Link href="/report">
          <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-lg">📊</span>
            <div>
              <div className="text-[#0a0a0a] text-sm font-bold">리포트</div>
              <div className="text-[#6b6b6b] text-xs">주간/월간</div>
            </div>
          </div>
        </Link>
        <Link href="/notice">
          <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-lg">📢</span>
            <div>
              <div className="text-[#0a0a0a] text-sm font-bold">공지사항</div>
              <div className="text-[#6b6b6b] text-xs">전체 공지 보기</div>
            </div>
          </div>
        </Link>
        {(isManager || isAdmin) && (
          <Link href="/manager">
            <div className="bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-lg">👑</span>
              <div>
                <div className="text-[#0a0a0a] text-sm font-bold">팀장 권한</div>
                <div className="text-[#6b6b6b] text-xs">팀원 승인 및 현황</div>
              </div>
            </div>
          </Link>
        )}
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
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#0a0a0a] font-black">비밀번호 변경</div>
              <button onClick={() => { setShowPasswordModal(false); setCurrentPassword(""); setNewPassword(""); setPasswordError(""); }} className="text-[#a0a0a0] hover:text-[#0a0a0a] text-sm">✕</button>
            </div>
            <div className="bg-[#f0f0ff] border border-[#c7c8fa] rounded-lg px-3 py-2 mb-3 text-[#5b5ef4] text-xs leading-relaxed">
              비밀번호 조건: 영문+숫자 포함 8자 이상
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">현재 비밀번호</div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(""); }}
                  placeholder="현재 비밀번호 입력"
                  className={`w-full bg-white border text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0] ${passwordError ? "border-[#ef4444]" : "border-[#e5e5e5]"}`}
                />
              </div>
              <div>
                <div className="text-[#a0a0a0] text-xs mb-1">새 비밀번호</div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
                  placeholder="영문+숫자 포함 8자 이상"
                  className={`w-full bg-white border text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0] ${passwordError ? "border-[#ef4444]" : "border-[#e5e5e5]"}`}
                />
              </div>
              {passwordError && (
                <div className="text-[#ef4444] text-xs">{passwordError}</div>
              )}
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