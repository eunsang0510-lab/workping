"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import { API_URL } from "@/lib/api";
import { checkSystemAdmin } from "@/lib/systemAdmin";
import { saveRecordingLocally } from "@/lib/meetingAudioStore";

interface ToastState { message: string; type: "success" | "error" | "info"; }

const MAX_RECORD_SECONDS = 60 * 60; // 1on1은 최대 1시간

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function formatElapsed(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

type Phase = "idle" | "recording" | "uploading" | "done" | "error";

function OneOnOneRecordInner() {
  const params = useSearchParams();
  const cycleId = params.get("cycleId") || "";
  const userId = params.get("userId") || "";

  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      checkSystemAdmin(u.email).then((ok) => {
        if (!ok) router.push("/login");
      });
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          const next = e + 1;
          if (next >= MAX_RECORD_SECONDS) {
            showToast("최대 녹음 시간(1시간)에 도달해 자동으로 종료했어요", "info");
            stopRecordingRef.current();
          }
          return next;
        });
      }, 1000);
    } catch {
      showToast("마이크 권한이 필요해요", "error");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (timerRef.current) clearInterval(timerRef.current);

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const durationSeconds = elapsed;

      const localId = `1on1-${Date.now()}`;
      try {
        await saveRecordingLocally({ id: localId, blob, createdAt: new Date().toISOString(), durationSeconds });
      } catch {
        /* 로컬 저장 실패해도 업로드는 계속 진행 */
      }

      await upload(blob, durationSeconds);
    };
    recorder.stop();
  };

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  });

  const upload = async (blob: Blob, durationSeconds: number) => {
    if (!user) return;
    setPhase("uploading");
    try {
      const token = await auth.currentUser?.getIdToken();
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      form.append("cycle_id", cycleId);
      form.append("evaluatee_user_id", userId);
      form.append("duration_seconds", String(durationSeconds));

      const res = await fetch(`${API_URL}/api/evaluation/one-on-one/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "업로드에 실패했어요");
      setPhase("done");
      showToast("1on1 녹음을 업로드했어요. AI가 분석 중이에요", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "업로드에 실패했어요", "error");
      setPhase("error");
    }
  };

  if (!cycleId || !userId) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Link href="/evaluation/team" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[#6b6b6b] text-sm">
            잘못된 접근이에요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-6 flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg w-full mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <Link href="/evaluation/team" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="text-[#0a0a0a] text-base font-bold">1on1 면담 녹음</div>
          <div className="w-8" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {phase === "uploading" ? (
            <>
              <div className="w-20 h-20 rounded-full border-4 border-[#e5e5e5] border-t-[#5b5ef4] animate-spin" />
              <div className="text-[#0a0a0a] text-sm font-medium">업로드하고 있어요...</div>
            </>
          ) : phase === "done" ? (
            <>
              <div className="text-4xl">✅</div>
              <div className="text-[#0a0a0a] text-sm font-medium">업로드 완료. AI가 분석 중이에요</div>
              <Link href="/evaluation/team" className="text-[#5b5ef4] text-xs font-bold">
                평가 검토로 돌아가기
              </Link>
            </>
          ) : (
            <>
              <div className="text-5xl font-bold text-[#0a0a0a] tabular-nums">{formatElapsed(elapsed)}</div>
              {phase === "recording" && (
                <div className="flex items-center gap-2 text-[#ef4444] text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" /> 녹음 중
                </div>
              )}
              {phase === "idle" && (
                <button
                  onClick={startRecording}
                  className="w-24 h-24 rounded-full bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-3xl shadow-[0_8px_24px_rgba(91,94,244,0.35)] transition-all"
                >
                  🎙️
                </button>
              )}
              {phase === "recording" && (
                <button
                  onClick={stopRecording}
                  className="w-24 h-24 rounded-full bg-[#ef4444] hover:bg-[#dc2626] text-white text-3xl shadow-[0_8px_24px_rgba(239,68,68,0.35)] transition-all"
                >
                  ■
                </button>
              )}
              {phase === "error" && (
                <div className="text-[#ef4444] text-sm">업로드에 실패했어요. 다시 시도해주세요</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OneOnOneRecordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="text-[#5b5ef4]">로딩 중...</div></div>}>
      <OneOnOneRecordInner />
    </Suspense>
  );
}
