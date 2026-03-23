"use client";

import { useCallback } from "react";
import { hapticSelection, triggerHaptic, type HapticLevel } from "@/utils/haptics";

export function useHapticFeedback() {
  const impact = useCallback((level: HapticLevel) => {
    void triggerHaptic(level);
  }, []);

  const selection = useCallback(() => {
    void hapticSelection();
  }, []);

  return {
    impact,
    selection,
    light: () => impact("light"),
    medium: () => impact("medium"),
    heavy: () => impact("heavy"),
  };
}
