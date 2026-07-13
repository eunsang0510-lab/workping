// BOM(﻿)이 env var에 붙는 Windows/PowerShell 문제 방어
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/^﻿/, "");

// 서비스 출시 연도 — 이전 연도는 데이터가 없으므로 연도 선택지에서 제외
export const APP_LAUNCH_YEAR = 2026;

export function yearOptions(maxYear: number): number[] {
  const years: number[] = [];
  for (let y = maxYear; y >= APP_LAUNCH_YEAR; y--) years.push(y);
  return years;
}
