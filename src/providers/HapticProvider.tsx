"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

type HapticContextValue = ReturnType<typeof useHapticFeedback>;

const HapticContext = createContext<HapticContextValue | null>(null);

export function HapticProvider({ children }: { children: ReactNode }) {
  const haptics = useHapticFeedback();
  const value = useMemo(() => haptics, [haptics]);
  return <HapticContext.Provider value={value}>{children}</HapticContext.Provider>;
}

export function useHaptic() {
  const ctx = useContext(HapticContext);
  if (!ctx) throw new Error("useHaptic must be used within HapticProvider");
  return ctx;
}
