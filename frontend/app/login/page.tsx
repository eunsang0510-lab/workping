"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Login() {
  const [mode, setMode] = useState<"select" | "personal" | "company">("select");
  const [loading, setLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push("/dashboard");
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await fetch(`${API_URL}/api/auth/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: user.email, name: user.displayName || "" }),
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("로그인 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySearch = async () => {
    if (!companySearch.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/company/search?name=${companySearch}`);
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error("검색 실패:", error);
    }
  };

  const handleCompanyLogin = async () => {
    if (!selectedCompany || !email || !password) {
      setError("모든 항목을 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error: any) {
      if (error.code === "auth/invalid-credential") {
        setError("이메일 또는 비밀번호가 올바르지 않아요");
      } else {
        setError("로그인에 실패했어요. 다시 시도해주세요");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#5b5ef4] rounded-2xl mb-4 cursor-pointer">
              <span className="text-white text-xl font-black">W</span>
            </div>
          </Link>
          <h1 className="text-[#0a0a0a] text-2xl font-black tracking-tight">
            Work<span className="text-[#5b5ef4]">Ping</span>
          </h1>
          <p className="text-[#6b6b6b] mt-1 text-sm">GPS 기반 스마트 근태관리</p>
        </div>

        {/* 회원 유형 선택 */}
        {mode === "select" && (
          <div className="space-y-3">
            <div className="text-[#a0a0a0] text-xs text-center mb-4 uppercase tracking-wider">회원 유형 선택</div>
            <button
              onClick={() => setMode("personal")}
              className="w-full bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 text-left transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f0f0ff] rounded-xl flex items-center justify-center text-lg">👤</div>
                <div>
                  <div className="text-[#0a0a0a] font-bold text-sm">개인 회원</div>
                  <div className="text-[#6b6b6b] text-xs">구글 계정으로 로그인</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => setMode("company")}
              className="w-full bg-white border border-[#e5e5e5] hover:border-[#5b5ef4] rounded-xl p-4 text-left transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f0fdf4] rounded-xl flex items-center justify-center text-lg">🏢</div>
                <div>
                  <div className="text-[#0a0a0a] font-bold text-sm">기업 회원</div>
                  <div className="text-[#6b6b6b] text-xs">회사 이메일로 로그인</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* 개인 로그인 */}
        {mode === "personal" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("select")}
              className="text-[#6b6b6b] text-sm flex items-center gap-1 mb-2 hover:text-[#0a0a0a] transition-colors"
            >
              ← 뒤로
            </button>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#f8f8f8] text-[#0a0a0a] font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 border border-[#e5e5e5] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? "로그인 중..." : "Google로 시작하기"}
            </button>
          </div>
        )}

        {/* 기업 로그인 */}
        {mode === "company" && (
          <div className="space-y-3">
            <button
              onClick={() => { setMode("select"); setSelectedCompany(null); setCompanies([]); }}
              className="text-[#6b6b6b] text-sm flex items-center gap-1 mb-2 hover:text-[#0a0a0a] transition-colors"
            >
              ← 뒤로
            </button>

            {!selectedCompany && (
              <>
                <div className="text-[#a0a0a0] text-xs uppercase tracking-wider mb-2">회사 검색</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="회사 이름 검색"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCompanySearch()}
                    className="flex-1 bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                  />
                  <button
                    onClick={handleCompanySearch}
                    className="bg-[#5b5ef4] hover:bg-[#4a4de0] text-white px-4 rounded-xl transition-all text-sm font-bold"
                  >
                    검색
                  </button>
                </div>
                {companies.length > 0 && (
                  <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                    {companies.map((company, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCompany(company)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f8f8f8] transition-all border-b border-[#e5e5e5] last:border-0 text-left"
                      >
                        <span className="text-lg">🏢</span>
                        <span className="text-[#0a0a0a] text-sm">{company.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {companies.length === 0 && companySearch && (
                  <div className="text-[#a0a0a0] text-sm text-center py-4">검색 결과가 없어요</div>
                )}
              </>
            )}

            {selectedCompany && (
              <>
                <div className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-2">
                    <span>🏢</span>
                    <span className="text-[#0a0a0a] text-sm font-medium">{selectedCompany.name}</span>
                  </div>
                  <button onClick={() => setSelectedCompany(null)} className="text-[#a0a0a0] text-xs hover:text-[#0a0a0a]">변경</button>
                </div>
                <input
                  type="email"
                  placeholder="회사 이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCompanyLogin()}
                  className="w-full bg-white border border-[#e5e5e5] text-[#0a0a0a] rounded-xl px-4 py-3 outline-none focus:border-[#5b5ef4] transition-all text-sm placeholder-[#a0a0a0]"
                />
                {error && <div className="text-[#ef4444] text-xs text-center">{error}</div>}
                <button
                  onClick={handleCompanyLogin}
                  disabled={loading}
                  className="w-full bg-[#5b5ef4] hover:bg-[#4a4de0] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-sm"
                >
                  {loading ? "로그인 중..." : "로그인"}
                </button>
                <div className="text-[#a0a0a0] text-xs text-center">
                  초기 비밀번호: 이메일 앞부분 + 생년월일 (예: hong19901225)
                </div>
              </>
            )}
          </div>
        )}

        <p className="text-[#a0a0a0] text-xs text-center mt-6">
          로그인 시 <Link href="/terms" className="text-[#5b5ef4] hover:underline">서비스 이용약관</Link> 및 <Link href="/privacy" className="text-[#5b5ef4] hover:underline">개인정보처리방침</Link>에 동의합니다
        </p>
        {mode === "company" && !selectedCompany && (
          <p className="text-[#a0a0a0] text-xs text-center mt-2">
            회사 등록 및 기타 문의 :{" "}
            <a href="mailto:workpingofficial@gmail.com" className="text-[#5b5ef4] hover:underline">
              workpingofficial@gmail.com
            </a>
          </p>
        )}
      </div>
    </main>
  );
}