"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface MobileToastProps {
  open: boolean;
  message: string;
  tone?: "neutral" | "success" | "error";
}

export default function MobileToast({ open, message, tone = "neutral" }: MobileToastProps) {
  const toneClass =
    tone === "success"
      ? "border-jade/60 text-jade-light"
      : tone === "error"
      ? "border-crimson/70 text-crimson-light"
      : "border-border text-cloud-white";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 16, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] left-1/2 z-[70] w-[88%] -translate-x-1/2 rounded-xl border bg-ink-dark/95 px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${toneClass}`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
