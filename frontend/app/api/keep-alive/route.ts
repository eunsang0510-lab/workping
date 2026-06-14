import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/^﻿/, "");
  try {
    const res = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, backend: data, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, ts: new Date().toISOString() }, { status: 500 });
  }
}
