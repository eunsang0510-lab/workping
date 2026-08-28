"use client";

import { useEffect, useState, useCallback, use } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import Confirm from "@/components/Confirm";
import AdAnchor from "@/components/AdAnchor";
import { API_URL } from "@/lib/api";

const getAuthHeader = async () => {
  const token = await auth.currentUser?.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

interface DiffSegment { type: "equal" | "insert" | "delete"; text: string; }
interface TodoDetail { id: string; text: string; done: boolean; diff: DiffSegment[]; }
interface DeletedTodo { id: string; text: string; }

interface MeetingDetail {
  id: string;
  company_id: string;
  title: string;
  recorded_at: string;
  duration_seconds: number | null;
  user_id: string;
  user_name: string | null;
  status: string;
  error_message: string | null;
  transcript: string | null;
  summary: string | null;
  summary_diff: DiffSegment[];
  edited: boolean;
  todos: TodoDetail[];
  deleted_todos: DeletedTodo[];
  updated_at: string | null;
  updated_by_name: string | null;
}

interface ToastState { message: string; type: "success" | "error" | "info"; }
interface EditTodo { id: string; text: string; done: boolean; }

function DiffText({ segments }: { segments: DiffSegment[] }) {
  if (!segments || segments.length === 0) return null;
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "insert") {
          return (
            <span key={i} className="bg-amber-100 text-amber-800 rounded px-0.5">
              {seg.text}
            </span>
          );
        }
        if (seg.type === "delete") {
          return (
            <span key={i} className="line-through text-[#b0b0b0]">
              {seg.text}
            </span>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editTodos, setEditTodos] = useState<EditTodo[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  const fetchMeeting = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/meeting/${id}`, { headers: await getAuthHeader() });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "회의록을 찾을 수 없어요", "error");
        return;
      }
      setMeeting(data);
    } catch {
      showToast("회의록을 불러오지 못했어요", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email === "eunsang0510@gmail.com") {
        setUser(u);
        fetchMeeting();
      } else if (u) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router, fetchMeeting]);

  // 처리 중이면 완료될 때까지 주기적으로 다시 조회 (푸시 알림을 못 받는 경우 대비)
  useEffect(() => {
    if (meeting?.status !== "processing") return;
    const timer = setInterval(fetchMeeting, 5000);
    return () => clearInterval(timer);
  }, [meeting?.status, fetchMeeting]);

  const startEditing = () => {
    if (!meeting) return;
    setEditTitle(meeting.title);
    setEditSummary(meeting.summary || "");
    setEditTodos(meeting.todos.map((t) => ({ id: t.id, text: t.text, done: t.done })));
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const addTodo = () => {
    setEditTodos((prev) => [...prev, { id: crypto.randomUUID(), text: "", done: false }]);
  };

  const removeTodo = (todoId: string) => {
    setEditTodos((prev) => prev.filter((t) => t.id !== todoId));
  };

  const saveEdits = async () => {
    if (!editTitle.trim()) { showToast("제목을 입력해주세요", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/meeting/${id}`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({
          title: editTitle.trim(),
          summary: editSummary,
          todos: editTodos.filter((t) => t.text.trim()).map((t) => ({ ...t, text: t.text.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장에 실패했어요");
      setMeeting(data);
      setEditing(false);
      showToast("수정 내용을 저장했어요", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "저장에 실패했어요", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleTodoDone = async (todoId: string, done: boolean) => {
    if (!meeting) return;
    const nextTodos = meeting.todos.map((t) => (t.id === todoId ? { ...t, done } : t));
    setMeeting({ ...meeting, todos: nextTodos });
    try {
      const res = await fetch(`${API_URL}/api/meeting/${id}`, {
        method: "PUT",
        headers: await getAuthHeader(),
        body: JSON.stringify({
          todos: nextTodos.map((t) => ({ id: t.id, text: t.text, done: t.done })),
        }),
      });
      const data = await res.json();
      if (res.ok) setMeeting(data);
    } catch {
      showToast("할일 상태 변경에 실패했어요", "error");
      fetchMeeting();
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`${API_URL}/api/meeting/${id}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "삭제에 실패했어요");
      showToast("회의록을 삭제했어요", "success");
      router.push("/meeting");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "삭제에 실패했어요", "error");
    } finally {
      setDeleteConfirm(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#6b6b6b] text-sm">불러오는 중...</div>;
  }
  if (!meeting) {
    return <div className="min-h-screen flex items-center justify-center text-[#6b6b6b] text-sm">회의록을 찾을 수 없어요</div>;
  }

  const canDelete = user && (user.uid === meeting.user_id);

  if (meeting.status === "processing" || meeting.status === "failed") {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {deleteConfirm && (
          <Confirm message="이 회의록을 삭제할까요?" onConfirm={handleDelete} onCancel={() => setDeleteConfirm(false)} />
        )}
        <div className="max-w-lg mx-auto">
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            {meeting.status === "processing" ? (
              <>
                <div className="w-16 h-16 rounded-full border-4 border-[#e5e5e5] border-t-[#5b5ef4] animate-spin" />
                <div className="text-[#0a0a0a] text-sm font-medium">AI가 회의록을 준비하고 있어요</div>
                <div className="text-[#6b6b6b] text-xs">완료되면 알림으로 알려드릴게요. 이 화면을 나가도 괜찮아요.</div>
              </>
            ) : (
              <>
                <div className="text-3xl">⚠️</div>
                <div className="text-[#0a0a0a] text-sm font-medium">회의록 생성에 실패했어요</div>
                {meeting.error_message && (
                  <div className="text-[#b0b0b0] text-xs text-center max-w-xs">{meeting.error_message}</div>
                )}
                {canDelete && (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-[#f8f8f8] text-[#ef4444] text-sm font-bold"
                  >
                    삭제하기
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {deleteConfirm && (
        <Confirm
          message="이 회의록을 삭제할까요?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          {!editing ? (
            <button onClick={startEditing} className="text-[#5b5ef4] text-sm font-semibold">수정</button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={cancelEditing} className="text-[#6b6b6b] text-sm">취소</button>
              <button onClick={saveEdits} disabled={saving} className="text-[#5b5ef4] text-sm font-bold disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full text-lg font-bold text-[#0a0a0a] border border-[#e5e5e5] rounded-xl px-3 py-2 mb-2 outline-none focus:border-[#5b5ef4]"
          />
        ) : (
          <div className="text-lg font-bold text-[#0a0a0a] mb-1">{meeting.title}</div>
        )}

        <div className="text-[#6b6b6b] text-xs mb-5">
          {new Date(meeting.recorded_at).toLocaleString("ko-KR")}
          {meeting.user_name ? ` · ${meeting.user_name}` : ""}
        </div>

        {meeting.edited && meeting.updated_by_name && (
          <div className="text-[11px] text-[#6b6b6b] bg-[#f8f8f8] rounded-lg px-3 py-2 mb-4">
            ✏️ {meeting.updated_by_name}님이 수정함
            {meeting.updated_at ? ` · ${new Date(meeting.updated_at).toLocaleString("ko-KR")}` : ""}
            <span className="ml-1">
              (<span className="bg-amber-100 text-amber-800 rounded px-1">노란색</span> = 추가,{" "}
              <span className="line-through text-[#b0b0b0]">취소선</span> = 삭제)
            </span>
          </div>
        )}

        {/* 요약 */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 mb-4">
          <div className="text-[#0a0a0a] text-sm font-bold mb-2">📝 요약</div>
          {editing ? (
            <textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              rows={8}
              className="w-full text-sm text-[#0a0a0a] border border-[#e5e5e5] rounded-lg px-3 py-2 outline-none focus:border-[#5b5ef4] whitespace-pre-wrap"
            />
          ) : (
            <div className="text-sm text-[#0a0a0a] leading-relaxed whitespace-pre-wrap">
              {meeting.summary_diff.length > 0
                ? <DiffText segments={meeting.summary_diff} />
                : <span className="text-[#b0b0b0]">요약 내용이 없어요</span>}
            </div>
          )}
        </div>

        {/* 할 일 */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 mb-4">
          <div className="text-[#0a0a0a] text-sm font-bold mb-3">✅ 할 일</div>
          {editing ? (
            <div className="flex flex-col gap-2">
              {editTodos.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <input
                    value={t.text}
                    onChange={(e) =>
                      setEditTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)))
                    }
                    className="flex-1 text-sm border border-[#e5e5e5] rounded-lg px-3 py-2 outline-none focus:border-[#5b5ef4]"
                    placeholder="할 일 내용"
                  />
                  <button onClick={() => removeTodo(t.id)} className="text-[#b0b0b0] hover:text-[#ef4444] text-sm px-1">✕</button>
                </div>
              ))}
              <button onClick={addTodo} className="text-[#5b5ef4] text-xs font-semibold text-left mt-1">+ 항목 추가</button>
            </div>
          ) : meeting.todos.length === 0 && meeting.deleted_todos.length === 0 ? (
            <div className="text-[#b0b0b0] text-sm">할 일이 없어요</div>
          ) : (
            <div className="flex flex-col gap-2">
              {meeting.todos.map((t) => (
                <label key={t.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => toggleTodoDone(t.id, e.target.checked)}
                    className="mt-0.5 accent-[#5b5ef4]"
                  />
                  <span className={`text-sm leading-relaxed ${t.done ? "line-through text-[#b0b0b0]" : "text-[#0a0a0a]"}`}>
                    {t.diff.length > 0 ? <DiffText segments={t.diff} /> : t.text}
                  </span>
                </label>
              ))}
              {meeting.deleted_todos.map((t) => (
                <div key={t.id} className="text-sm text-[#d4a5a5] line-through">{t.text}</div>
              ))}
            </div>
          )}
        </div>

        {/* 원문 */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 mb-4">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="w-full flex items-center justify-between text-[#0a0a0a] text-sm font-bold"
          >
            <span>🎧 녹음 원문(STT)</span>
            <span className="text-[#6b6b6b] text-xs">{showTranscript ? "접기" : "펼치기"}</span>
          </button>
          {showTranscript && (
            <div className="text-[#6b6b6b] text-xs leading-relaxed whitespace-pre-wrap mt-3 border-t border-[#f0f0f0] pt-3">
              {meeting.transcript || "원문이 없어요"}
            </div>
          )}
        </div>

        <AdAnchor />

        {canDelete && !editing && (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="w-full text-center text-[#ef4444] text-xs font-semibold py-3"
          >
            회의록 삭제
          </button>
        )}
      </div>
    </div>
  );
}
