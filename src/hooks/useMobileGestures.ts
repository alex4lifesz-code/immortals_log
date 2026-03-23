"use client";

import { useMemo } from "react";
import type { TouchEvent } from "react";

interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}

export function useMobileGestures(handlers: GestureHandlers) {
  return useMemo(() => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let longPressTimer: number | null = null;

    const clearLongPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    return {
      onTouchStart: (event: TouchEvent) => {
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        clearLongPress();
        longPressTimer = window.setTimeout(() => {
          handlers.onLongPress?.();
        }, 420);
      },
      onTouchEnd: (event: TouchEvent) => {
        clearLongPress();
        const touch = event.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const dt = Date.now() - startTime;

        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) || dt > 500) return;
        if (dx > 0) handlers.onSwipeRight?.();
        else handlers.onSwipeLeft?.();
      },
      onTouchMove: () => clearLongPress(),
    };
  }, [handlers]);
}
