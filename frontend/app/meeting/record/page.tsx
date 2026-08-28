"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";
import { API_URL } from "@/lib/api";
import { saveRecordingLocally } from "@/lib/meetingAudioStore";

interface ToastState { message: string; type: "success" | "error" | "info"; }
interface Quota { used: number; limit: number; remaining: number; message: string; }

const MAX_RECORD_SECONDS = 30 * 60; // 녹음 최대 30분

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

type Phase = "idle" | "recording" | "uploading" | "error";

export default function MeetingRecordPage() {
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const router = useRouter();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<Date | null>(null);
  const lastBlobRef = useRef<{ blob: Blob; durationSeconds: number } | null>(null);

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email !== "eunsang0510@gmail.com") {
        router.push("/dashboard");
        return;
      }
      if (u) {
        setUser(u);
        setUserName(u.displayName || "");
        fetch(`${API_URL}/api/company/my/${u.uid}`)
          .then((r) => r.json())
          .then((d) => setCompanyId(d.company_id || null));

        u.getIdToken().then((token) => {
          fetch(`${API_URL}/api/meeting/quota/${u.uid}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((d) => setQuota(d))
            .finally(() => setQuotaLoading(false));
        });
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopRecordingRef = useRef<() => void>(() => {});

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
      startedAtRef.current = new Date();
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          const next = e + 1;
          // 최대 녹음 시간(30분) 도달 시 자동 종료
          if (next >= MAX_RECORD_SECONDS) {
            showToast("최대 녹음 시간(30분)에 도달해 자동으로 종료했어요", "info");
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
      lastBlobRef.current = { blob, durationSeconds };

      const localId = `${Date.now()}`;
      try {
        await saveRecordingLocally({
          id: localId,
          blob,
          createdAt: new Date().toISOString(),
          durationSeconds,
          title: title.trim(),
        });
      } catch {
        /* 로컬 저장 실패해도 업로드/요약 흐름은 계속 진행 */
      }

      await uploadAndSummarize(blob, durationSeconds);
    };
    recorder.stop();
  };

  // ref를 항상 최신 stopRecording으로 유지 (setInterval 콜백에서 최신 상태를 참조하기 위함)
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  });

  const uploadAndSummarize = async (blob: Blob, durationSeconds: number) => {
    if (!user) {
      showToast("로그인이 필요해요", "error");
      setPhase("error");
      return;
    }
    setPhase("uploading");
    try {
      const token = await auth.currentUser?.getIdToken();
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      form.append("company_id", companyId || "");
      form.append("user_id", user.uid);
      form.append("user_name", userName);
      form.append("title", title.trim());
      form.append("recorded_at", (startedAtRef.current || new Date()).toISOString());
      form.append("duration_seconds", String(durationSeconds));

      const res = await fetch(`${API_URL}/api/meeting/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "업로드에 실패했어요");
      }
      showToast("회의록을 준비하고 있어요. 완료되면 알려드릴게요!", "success");
      router.push(`/meeting/${data.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "업로드에 실패했어요", "error");
      setPhase("error");
    }
  };

  const retryUpload = () => {
    if (lastBlobRef.current) {
      uploadAndSummarize(lastBlobRef.current.blob, lastBlobRef.current.durationSeconds);
    }
  };

  if (!quotaLoading && quota && quota.remaining <= 0) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="max-w-lg mx-auto">
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="text-3xl">🔒</div>
            <div className="text-[#0a0a0a] text-sm font-medium max-w-xs">{quota.message}</div>
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
          <Link href="/meeting" className="text-[#6b6b6b] text-sm">← 뒤로</Link>
          <div className="text-[#0a0a0a] text-base font-bold">회의 녹음</div>
          <div className="w-8" />
        </div>

        {phase === "idle" && (
          <div className="mb-6">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="회의 제목 (선택)"
              className="w-full border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm text-[#0a0a0a] outline-none focus:border-[#5b5ef4]"
            />
            {quota && (
              <div className="text-[#b0b0b0] text-[11px] mt-2 text-center">
                베타 기간 이번 달 {quota.used}/{quota.limit}회 사용 · 최대 30분까지 녹음 가능
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {phase === "uploading" ? (
            <>
              <div className="w-20 h-20 rounded-full border-4 border-[#e5e5e5] border-t-[#5b5ef4] animate-spin" />
              <div className="text-[#0a0a0a] text-sm font-medium">녹음 파일을 업로드하고 있어요...</div>
              <div className="text-[#6b6b6b] text-xs">잠시만 기다려주세요</div>
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
                <div className="flex flex-col items-center gap-3">
                  <div className="text-[#ef4444] text-sm">업로드에 실패했어요</div>
                  <button
                    onClick={retryUpload}
                    className="px-5 py-2.5 rounded-xl bg-[#5b5ef4] hover:bg-[#4a4de0] text-white text-sm font-bold"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
