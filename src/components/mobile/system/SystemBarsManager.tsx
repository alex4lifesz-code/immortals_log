"use client";

import { useEffect } from "react";
import { useSystemBars } from "@/hooks/useSystemBars";

function blurActiveField() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && /^(input|textarea|select)$/i.test(active.tagName)) {
    active.blur();
  }
}

function syncViewportSize() {
  if (typeof window === "undefined") return;

  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));

  document.documentElement.style.setProperty("--app-viewport-width", `${width}px`);
}

export default function SystemBarsManager() {
  useSystemBars();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafA = 0;
    let rafB = 0;

    const scheduleSync = () => {
      if (rafA) window.cancelAnimationFrame(rafA);
      if (rafB) window.cancelAnimationFrame(rafB);

      rafA = window.requestAnimationFrame(() => {
        syncViewportSize();
        rafB = window.requestAnimationFrame(() => {
          syncViewportSize();
        });
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        blurActiveField();
        return;
      }

      scheduleSync();
      window.dispatchEvent(new Event("resize"));
    };

    const visualViewport = window.visualViewport;

    scheduleSync();
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    window.addEventListener("focus", scheduleSync);
    window.addEventListener("pageshow", scheduleSync);
    document.addEventListener("visibilitychange", handleVisibility);
    visualViewport?.addEventListener("resize", scheduleSync);
    visualViewport?.addEventListener("scroll", scheduleSync);

    return () => {
      if (rafA) window.cancelAnimationFrame(rafA);
      if (rafB) window.cancelAnimationFrame(rafB);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      window.removeEventListener("focus", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      visualViewport?.removeEventListener("resize", scheduleSync);
      visualViewport?.removeEventListener("scroll", scheduleSync);
    };
  }, []);

  return null;
}
