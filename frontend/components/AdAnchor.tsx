"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "";
const EXCLUDED_PATHS = ["/login"];

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
 *
 * 로그인 화면에서는 첫 진입 인상이 중요해 광고를 노출하지 않는다. 앵커 광고는
 * 한 번 노출 요청되면 SPA 네비게이션 동안 계속 떠 있으므로, 로그인 화면이 아닌
 * 페이지로 넘어온 시점에만 최초 요청을 보낸다(이미 요청된 뒤 로그인 화면으로
 * 돌아가도 광고 자체를 다시 없앨 방법은 없다 — Google Auto ads의 구조적 한계).
 */
export default function AdAnchor() {
  const pathname = usePathname();

  useEffect(() => {
    if (!ADSENSE_CLIENT || anchorRequested) return;
    if (EXCLUDED_PATHS.includes(pathname)) return;
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
  }, [pathname]);

  return null;
}
