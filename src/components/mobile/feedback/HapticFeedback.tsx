"use client";

import { useEffect } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface HapticFeedbackProps {
  trigger: unknown;
  level?: "light" | "medium" | "heavy";
}

export default function HapticFeedback({ trigger, level = "light" }: HapticFeedbackProps) {
  const haptics = useHapticFeedback();

  useEffect(() => {
    if (level === "medium") haptics.medium();
    else if (level === "heavy") haptics.heavy();
    else haptics.light();
  }, [haptics, level, trigger]);

  return null;
}
