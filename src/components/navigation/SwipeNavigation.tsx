"use client";

import { memo, useRef, useCallback } from "react";
import { useAppContext } from "@/context/AppContext";

// SwipeNavigation v2.0: Tap-based navigation is primary.
// Horizontal swipe-to-open sidebar is enabled only in native APK
// for quick access to the filter/sidebar panel.

function SwipeNavigation({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isNativeApp, setMobileSidebarOpen, mobileSidebarOpen, isMobile } = useAppContext();
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const isSwipingRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isNativeApp || !isMobile) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    isSwipingRef.current = false;
  }, [isNativeApp, isMobile]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !isNativeApp || !isMobile) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Disambiguate: if vertical movement is dominant, it's a scroll — bail out
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      touchStartRef.current = null;
      return;
    }

    // Only consider edge swipes from the left 40px for opening
    if (touchStartRef.current.x < 40 && dx > 30) {
      isSwipingRef.current = true;
    }
  }, [isNativeApp, isMobile]);

  const onTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !isNativeApp || !isMobile) {
      touchStartRef.current = null;
      return;
    }
    if (isSwipingRef.current && !mobileSidebarOpen) {
      setMobileSidebarOpen(true);
    }
    touchStartRef.current = null;
    isSwipingRef.current = false;
  }, [isNativeApp, isMobile, mobileSidebarOpen, setMobileSidebarOpen]);

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ willChange: 'transform', WebkitOverflowScrolling: 'touch' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}

export default memo(SwipeNavigation);
