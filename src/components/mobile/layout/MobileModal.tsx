"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface MobileModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

export default function MobileModal({ open, onClose, children, ariaLabel }: MobileModalProps) {
  const trapRef = useFocusTrap(open);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-void-black/65"
            onClick={onClose}
          />
          <motion.section
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-[61] surface-panel surface-panel-strong rounded-t-3xl p-5"
          >
            {children}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
