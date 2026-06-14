"use client";

import { useEffect } from "react";

export default function KeepAlive() {
  useEffect(() => {
    const ping = () => fetch("/api/keep-alive").catch(() => {});
    ping();
    const id = setInterval(ping, 10 * 60 * 1000); // 10분마다
    return () => clearInterval(id);
  }, []);

  return null;
}
