"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface MobileFABProps {
  icon?: ReactNode;
  label?: string;
  onClick: () => void;
  side?: "left" | "right";
}

export default function MobileFAB({ icon = "+", label, onClick, side = "right" }: MobileFABProps) {
  const haptics = useHapticFeedback();

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      className={`fixed bottom-24 z-40 flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-jade px-4 text-cloud-white shadow-[0_12px_28px_rgba(0,0,0,0.4)] ${side === "left" ? "left-4" : "right-4"}`}
      onClick={() => {
        haptics.medium();
        onClick();
      }}
      aria-label={label || "Primary action"}
    >
      <span className="text-xl leading-none">{icon}</span>
      {label ? <span className="text-sm font-semibold">{label}</span> : null}
    </motion.button>
  );
}
