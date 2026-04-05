"use client";

import { motion, type PanInfo } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface MobileFABProps {
  icon?: ReactNode;
  label?: string;
  onClick: () => void;
  side?: "left" | "right";
}

type FabPosition = { x: number; y: number };

export default function MobileFAB({ icon = "+", label, onClick, side = "right" }: MobileFABProps) {
  const haptics = useHapticFeedback();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panOriginRef = useRef<FabPosition>({ x: 0, y: 0 });

  const [isPositionReady, setIsPositionReady] = useState(false);
  const [position, setPosition] = useState<FabPosition>({ x: 16, y: 16 });
  const lastSafePositionRef = useRef<FabPosition>({ x: 16, y: 16 });

  const resolveBottomNavTop = useCallback(() => {
    const nav = document.querySelector<HTMLElement>("[data-mobile-bottom-nav='true']");
    return nav ? nav.getBoundingClientRect().top : window.innerHeight;
  }, []);

  const getViewportBounds = useCallback(() => {
    const el = buttonRef.current;
    const navTop = resolveBottomNavTop();
    const margin = 12;
    const gapAboveNav = 10;
    const width = el?.offsetWidth ?? 56;
    const height = el?.offsetHeight ?? 56;

    const minX = margin;
    const maxX = Math.max(minX, window.innerWidth - width - margin);
    const minY = margin;
    const maxY = Math.max(minY, Math.min(window.innerHeight - height - margin, navTop - height - gapAboveNav));

    return { minX, maxX, minY, maxY };
  }, [resolveBottomNavTop]);

  const clampToBounds = useCallback((next: FabPosition): FabPosition => {
    const bounds = getViewportBounds();
    return {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, next.x)),
      y: Math.min(bounds.maxY, Math.max(bounds.minY, next.y)),
    };
  }, [getViewportBounds]);

  const isOutOfBounds = useCallback((next: FabPosition): boolean => {
    const bounds = getViewportBounds();
    return next.x < bounds.minX || next.x > bounds.maxX || next.y < bounds.minY || next.y > bounds.maxY;
  }, [getViewportBounds]);

  useEffect(() => {
    const placeDefault = () => {
      const el = buttonRef.current;
      const width = el?.offsetWidth ?? 56;
      const height = el?.offsetHeight ?? 56;
      const navTop = resolveBottomNavTop();
      const sideInset = 16;
      const yGap = 12;

      const targetX = side === "left"
        ? sideInset
        : Math.max(sideInset, window.innerWidth - width - sideInset);
      const targetY = Math.max(12, Math.min(window.innerHeight - height - 12, navTop - height - yGap));
      const next = clampToBounds({ x: targetX, y: targetY });

      setPosition(next);
      lastSafePositionRef.current = next;
      setIsPositionReady(true);
    };

    const rafId = window.requestAnimationFrame(placeDefault);
    window.addEventListener("resize", placeDefault);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", placeDefault);
    };
  }, [clampToBounds, resolveBottomNavTop, side]);

  useEffect(() => {
    if (!isPositionReady) return;
    const clamped = clampToBounds(position);
    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped);
      lastSafePositionRef.current = clamped;
    }
  }, [clampToBounds, isPositionReady, position]);

  const handlePanStart = useCallback(() => {
    panOriginRef.current = { ...position };
  }, [position]);

  const handlePan = useCallback((_event: PointerEvent, info: PanInfo) => {
    const rawNext = {
      x: panOriginRef.current.x + info.offset.x,
      y: panOriginRef.current.y + info.offset.y,
    };
    const clamped = clampToBounds(rawNext);
    setPosition(clamped);
    lastSafePositionRef.current = clamped;
  }, [clampToBounds]);

  const handlePanEnd = useCallback(() => {
    if (isOutOfBounds(position)) {
      setPosition(lastSafePositionRef.current);
    }
  }, [isOutOfBounds, position]);

  const handleTap = useCallback(() => {
    haptics.medium();
    onClick();
  }, [haptics, onClick]);

  return (
    <motion.button
      ref={buttonRef}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.92 }}
      className="mobile-fab-polish fixed z-40 flex h-14 min-w-14 touch-none select-none items-center justify-center gap-2 rounded-full bg-jade px-4 text-cloud-white shadow-[0_12px_28px_rgba(0,0,0,0.4)]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        visibility: isPositionReady ? "visible" : "hidden",
      }}
      onPanStart={handlePanStart}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      onTap={handleTap}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleTap();
        }
      }}
      aria-label={label || "Primary action"}
    >
      <span className="text-xl leading-none">{icon}</span>
      {label ? <span className="text-sm font-semibold">{label}</span> : null}
    </motion.button>
  );
}
