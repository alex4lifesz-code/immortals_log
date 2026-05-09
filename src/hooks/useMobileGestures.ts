"use client";

import { useMemo } from "react";
import { useRef } from "react";
import type { TouchEvent } from "react";

interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}

export function useMobileGestures(handlers: GestureHandlers) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);

  return useMemo(() => {
    const clearLongPress = () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    return {
      onTouchStart: (event: TouchEvent) => {
        const touch = event.touches[0];
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        startTimeRef.current = Date.now();
        clearLongPress();
        longPressTimerRef.current = window.setTimeout(() => {
          handlers.onLongPress?.();
        }, 420);
      },
      onTouchEnd: (event: TouchEvent) => {
        clearLongPress();
        const touch = event.changedTouches[0];
        const dx = touch.clientX - startXRef.current;
        const dy = touch.clientY - startYRef.current;
        const dt = Date.now() - startTimeRef.current;

        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) || dt > 500) return;
        if (dx > 0) handlers.onSwipeRight?.();
        else handlers.onSwipeLeft?.();
      },
      onTouchMove: () => clearLongPress(),
    };
  }, [handlers]);
}
