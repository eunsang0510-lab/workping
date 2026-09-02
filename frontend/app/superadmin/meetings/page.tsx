"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { checkSystemAdmin } from "@/lib/systemAdmin";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

interface Stats {
  total_usage: number;
  month_usage: number;
  unique_users_total: number;
  unique_users_month: number;
  meeting_counts_by_status: Record<string, number>;
  monthly_trend: { month: string; count: number }[];
  top_users_this_month: { user_id: string; user_name: string | null; user_email: string | null; company_name: string | null; count: number }[];
}

interface MeetingRow {
  id: string;
  title: string;
  recorded_at: string;
  user_id: string;
  user_name: string | null;
  status: string;
  duration_seconds: number | null;
  todo_count: number;
  todo_done_count: number;
  edited: boolean;
  company_id: string | null;
  company_name: string;
}

interface TodoDetail {
  id: string;
  text: string;
  done: boolean;
}

interface MeetingDetail extends MeetingRow {
  transcript: string | null;
  summary: string | null;
  todos: TodoDetail[];
}

const STATUS_LABEL: Record<string, string> = { processing: "처리중", completed: "완료", failed: "실패" };

function formatDuration(sec: number | null) {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초`;
}

export default function SuperadminMeetingsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [selected, setSelected] = useState<MeetingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u || !(await checkSystemAdmin(u.email))) {
        router.push("/login");
        return;
      }
      await loadAll();
      setLoading(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadAll = async () => {
    const headers = await getAuthHeader();
    const [statsRes, meetingsRes] = await Promise.all([
      fetch(`${API_URL}/api/superadmin/meetings/stats`, { headers }),
      fetch(`${API_URL}/api/superadmin/meetings`, { headers }),
    ]);
    setStats(await statsRes.json());
    const meetingsData = await meetingsRes.json();
    setMeetings(meetingsData.meetings || []);
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/meetings/${id}`, { headers: await getAuthHeader() });
      const data = await res.json();
      setSelected(data);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f8f8] p-5 flex items-center justify-center">
        <div className="text-[#5b5ef4]">로딩 중...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-5">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/superadmin">
          <div className="w-9 h-9 bg-white border border-[#e5e5e5] rounded-xl flex items-center justify-center text-[#6b6b6b] hover:border-[#5b5ef4] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            ←
          </div>
        </Link>
        <h1 className="text-[#0a0a0a] text-lg font-black">AI 회의록 이용 현황</h1>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-2xl font-black text-[#5b5ef4]">{stats.total_usage}</div>
              <div className="text-[#a0a0a0] text-xs mt-1">전체 이용 횟수</div>
            </div>
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-2xl font-black text-[#16a34a]">{stats.month_usage}</div>
              <div className="text-[#a0a0a0] text-xs mt-1">이번 달 이용 횟수</div>
            </div>
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-2xl font-black text-[#f59e0b]">{stats.unique_users_month}</div>
              <div className="text-[#a0a0a0] text-xs mt-1">이번 달 이용자 수</div>
            </div>
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-2xl font-black text-[#0a0a0a]">{stats.unique_users_total}</div>
              <div className="text-[#a0a0a0] text-xs mt-1">누적 이용자 수</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-[#0a0a0a] text-sm font-bold mb-2">월별 이용 추이</div>
              {stats.monthly_trend.length === 0 ? (
                <div className="text-[#a0a0a0] text-xs">데이터 없음</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {stats.monthly_trend.map((row) => {
                    const max = Math.max(...stats.monthly_trend.map((r) => r.count), 1);
                    return (
                      <div key={row.month} className="flex items-center gap-2">
                        <div className="text-[#6b6b6b] text-xs w-16 shrink-0">{row.month}</div>
                        <div className="flex-1 bg-[#f0f0ff] rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-[#5b5ef4] h-full rounded-full"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                        <div className="text-[#0a0a0a] text-xs font-bold w-8 text-right">{row.count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="text-[#0a0a0a] text-sm font-bold mb-2">이번 달 상위 이용자</div>
              {stats.top_users_this_month.length === 0 ? (
                <div className="text-[#a0a0a0] text-xs">이번 달 이용자 없음</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {stats.top_users_this_month.map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between text-xs">
                      <div className="text-[#0a0a0a] truncate">
                        {u.user_name || u.user_email || u.user_id}
                        {u.company_name && <span className="text-[#a0a0a0] ml-1">· {u.company_name}</span>}
                      </div>
                      <div className="text-[#5b5ef4] font-bold shrink-0 ml-2">{u.count}회</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="px-4 py-3 border-b border-[#f0f0f0] text-[#0a0a0a] text-sm font-bold">
          전체 회의록 ({meetings.length}건)
        </div>
        {meetings.length === 0 ? (
          <div className="text-center text-[#a0a0a0] text-sm py-10">회의록이 없어요</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#a0a0a0] border-b border-[#f0f0f0]">
                  <th className="px-4 py-2 font-semibold">제목</th>
                  <th className="px-4 py-2 font-semibold">회사</th>
                  <th className="px-4 py-2 font-semibold">작성자</th>
                  <th className="px-4 py-2 font-semibold">일시</th>
                  <th className="px-4 py-2 font-semibold">길이</th>
                  <th className="px-4 py-2 font-semibold">상태</th>
                  <th className="px-4 py-2 font-semibold">할일</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => openDetail(m.id)}
                    className="border-b border-[#f7f7f7] hover:bg-[#f8f8ff] cursor-pointer"
                  >
                    <td className="px-4 py-2.5 text-[#0a0a0a] font-medium">{m.title}</td>
                    <td className="px-4 py-2.5 text-[#6b6b6b]">{m.company_name}</td>
                    <td className="px-4 py-2.5 text-[#6b6b6b]">{m.user_name || m.user_id}</td>
                    <td className="px-4 py-2.5 text-[#6b6b6b]">
                      {new Date(m.recorded_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5 text-[#6b6b6b]">{formatDuration(m.duration_seconds)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                          m.status === "completed"
                            ? "text-[#16a34a] bg-[#f0fdf4]"
                            : m.status === "failed"
                            ? "text-[#ef4444] bg-[#fef2f2]"
                            : "text-[#d97706] bg-[#fffbeb]"
                        }`}
                      >
                        {STATUS_LABEL[m.status] || m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#6b6b6b]">
                      {m.todo_count > 0 ? `${m.todo_done_count}/${m.todo_count}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selected || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="text-center text-[#a0a0a0] text-sm py-10">불러오는 중...</div>
            ) : selected ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[#0a0a0a] text-base font-bold">{selected.title}</div>
                  <button onClick={() => setSelected(null)} className="text-[#a0a0a0] text-sm">✕</button>
                </div>
                <div className="text-[#a0a0a0] text-xs mb-4">
                  {selected.company_name} · {selected.user_name || selected.user_id} ·{" "}
                  {new Date(selected.recorded_at).toLocaleString("ko-KR")}
                </div>

                <div className="mb-4">
                  <div className="text-[#0a0a0a] text-xs font-bold mb-1.5">📝 요약</div>
                  <div className="text-[#0a0a0a] text-xs leading-relaxed whitespace-pre-wrap bg-[#fafafa] rounded-lg px-3 py-2">
                    {selected.summary || "(요약 없음)"}
                  </div>
                </div>

                {selected.todos.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[#0a0a0a] text-xs font-bold mb-1.5">✅ 할 일</div>
                    <div className="flex flex-col gap-1">
                      {selected.todos.map((t) => (
                        <div key={t.id} className="text-xs text-[#0a0a0a] flex items-center gap-1.5">
                          <span>{t.done ? "☑" : "☐"}</span>
                          <span className={t.done ? "line-through text-[#a0a0a0]" : ""}>{t.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[#0a0a0a] text-xs font-bold mb-1.5">🎙️ 원문(STT)</div>
                  <div className="text-[#6b6b6b] text-xs leading-relaxed whitespace-pre-wrap bg-[#fafafa] rounded-lg px-3 py-2 max-h-60 overflow-y-auto">
                    {selected.transcript || "(원문 없음)"}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
