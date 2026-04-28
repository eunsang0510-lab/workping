"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: "bg-[#f0fdf4] border-[#bbf7d0] text-[#16a34a]",
    error: "bg-[#fef2f2] border-[#fecaca] text-[#ef4444]",
    info: "bg-[#f0f0ff] border-[#c7c8fa] text-[#4a4de0]",
  };

  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };

  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm border rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-3 animate-fade-in ${colors[type]}`}>
      <span className="text-lg">{icons[type]}</span>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}