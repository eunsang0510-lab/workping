"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
};

interface Notice {
  id: string;
  title: string;
  content: string;
  notice_type: string;
  created_at: string;
  is_read: boolean;
}

export default function NoticePage() {
  const [user, setUser] = useState<User | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchNotices(user.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchNotices = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/notice/list/${userId}`, {
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      setNotices(data.notices || []);
    } catch (error) {
      console.error("공지 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNoticeClick = async (notice: Notice) => {
    setSelectedNotice(notice);
    if (!notice.is_read) {
      try {
        await fetch(`${API_URL}/api/notice/read/${notice.id}?user_id=${user?.uid}`, {
          method: "POST",
          headers: await getAuthHeader(),
        });
        setNotices((prev) =>
          prev.map((n) => n.id === notice.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error("읽음 처리 실패:", error);
      }
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <button className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-sm hover:border-[#5b5ef4] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            ←
          </button>
        </Link>
        <h1 className="text-[#0a0a0a] text-xl font-black tracking-tight">
          공지사항
        </h1>
      </div>

      {/* 공지 목록 */}
      {notices.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-10 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-3xl mb-3">📭</div>
          <div className="text-[#a0a0a0] text-sm">등록된 공지사항이 없어요</div>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <button
              key={notice.id}
              onClick={() => handleNoticeClick(notice)}
              className="w-full bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-2xl p-4 text-left transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      notice.notice_type === "system"
                        ? "bg-[#f0f0ff] text-[#5b5ef4]"
                        : "bg-[#f0fdf4] text-[#16a34a]"
                    }`}>
                      {notice.notice_type === "system" ? "📢 시스템" : "🏢 회사"}
                    </span>
                    {!notice.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />
                    )}
                  </div>
                  <div className={`text-sm font-bold mb-1 ${
                    notice.is_read ? "text-[#6b6b6b]" : "text-[#0a0a0a]"
                  }`}>
                    {notice.title}
                  </div>
                  <div className="text-[#a0a0a0] text-xs truncate">
                    {notice.content}
                  </div>
                </div>
                <div className="text-[#a0a0a0] text-xs shrink-0 mt-1">
                  {formatDate(notice.created_at)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 공지 상세 모달 */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.2)] overflow-hidden">
            <div className={`px-5 py-4 flex items-center justify-between ${
              selectedNotice.notice_type === "system" ? "bg-[#5b5ef4]" : "bg-[#0a0a0a]"
            }`}>
              <span className="text-white text-sm font-bold">
                {selectedNotice.notice_type === "system" ? "📢 시스템 공지" : "🏢 회사 공지"}
              </span>
              <button
                onClick={() => setSelectedNotice(null)}
                className="text-white/70 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <div className="text-[#0a0a0a] font-black text-base mb-3">
                {selectedNotice.title}
              </div>
              <div className="text-[#6b6b6b] text-sm leading-relaxed whitespace-pre-wrap">
                {selectedNotice.content}
              </div>
              <div className="text-[#a0a0a0] text-xs mt-3">
                {formatDate(selectedNotice.created_at)}
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setSelectedNotice(null)}
                className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}