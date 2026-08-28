"use client";

import { useEffect } from "react";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

let anchorRequested = false;

/**
 * 화면 하단에 작게 붙는 Google "앵커(anchor) 광고"를 켠다.
 * adsbygoogle.js 스크립트 자체는 app/layout.tsx에 전역으로 심어져 있으므로
 * (AdSense 사이트 소유 확인용) 여기서는 노출 요청(push)만 한다.
 * 노출·유지는 Google Auto ads가 전담하므로 우리가 직접 새로고침 로직을
 * 짤 필요가 없고, AdSense의 "사용자 요청 없는 자동 갱신 금지" 정책과도 무관하다.
 */
export default function AdAnchor() {
  useEffect(() => {
    if (!ADSENSE_CLIENT || anchorRequested) return;
    anchorRequested = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({
        google_ad_client: ADSENSE_CLIENT,
        enable_page_level_ads: true,
        overlays: { bottom: true },
      });
    } catch {
      /* 스크립트가 아직 로드되지 않았으면 무시 */
    }
  }, []);

  return null;
}
