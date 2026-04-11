"use client";

import { AnimatePresence, motion } from "framer-motion";

interface ExitConfirmationToastProps {
  open: boolean;
  text?: string;
}

export default function ExitConfirmationToast({
  open,
  text = "Press back again to exit",
}: ExitConfirmationToastProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 22, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 18, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] left-1/2 z-[80] w-[88%] -translate-x-1/2 rounded-xl border border-border bg-ink-deep/95 px-4 py-3 text-center text-sm text-cloud-white shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
          role="status"
          aria-live="polite"
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
