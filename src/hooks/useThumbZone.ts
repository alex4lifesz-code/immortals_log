"use client";

import { useMemo } from "react";

export type ThumbZone = "easy" | "stretch" | "hard";

export function useThumbZone() {
  return useMemo(() => {
    const classify = (y: number, viewportHeight: number): ThumbZone => {
      const ratio = y / viewportHeight;
      if (ratio > 0.4) return "easy";
      if (ratio > 0.15) return "stretch";
      return "hard";
    };

    return { classify };
  }, []);
}
