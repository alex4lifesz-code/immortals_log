"use client";

import { memo, useCallback, useRef } from "react";
import { useAppContext } from "@/context/AppContext";

function SwipeNavigation({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isMobile, mobileSidebarOpen, setMobileSidebarOpen } = useAppContext();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const disableEdgeSidebarSwipe = false;

  const onTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isMobile]);

  const onTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || disableEdgeSidebarSwipe || !touchStartRef.current || mobileSidebarOpen) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      return;
    }

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const startedInLeftZone = touchStartRef.current.x <= 84;
    const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 1.05;
    const isRightSwipe = dx >= 44;

    if (startedInLeftZone && isHorizontalSwipe && isRightSwipe) {
      setMobileSidebarOpen(true);
    }

    touchStartRef.current = null;
  }, [isMobile, disableEdgeSidebarSwipe, mobileSidebarOpen, setMobileSidebarOpen]);

  return (
    <div
      className="flex-1 min-w-0 overflow-auto"
      style={{ willChange: 'transform', WebkitOverflowScrolling: 'touch' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}

export default memo(SwipeNavigation);
