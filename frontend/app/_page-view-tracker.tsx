"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { API_URL } from "@/lib/api";

function logView(pathname: string, u: User | null) {
  fetch(`${API_URL}/api/page-view/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: pathname,
      user_id: u?.uid ?? null,
      user_name: u?.displayName ?? null,
      user_email: u?.email ?? null,
    }),
  }).catch(() => {});
}

export default function PageViewTracker() {
  const pathname = usePathname();
  const lastLoggedPath = useRef<string | null>(null);
  const authReady = useRef(false);
  const currentUserRef = useRef<User | null>(null);

  // 로그인 상태가 처음 확정되는 시점에 현재 화면을 1회 기록
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      currentUserRef.current = u;
      if (!authReady.current) {
        authReady.current = true;
        if (pathname && lastLoggedPath.current !== pathname) {
          lastLoggedPath.current = pathname;
          logView(pathname, u);
        }
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면 이동 시마다 기록 (로그인 상태 확정 이후)
  useEffect(() => {
    if (!pathname || !authReady.current) return;
    if (lastLoggedPath.current === pathname) return;
    lastLoggedPath.current = pathname;
    logView(pathname, currentUserRef.current);
  }, [pathname]);

  return null;
}
