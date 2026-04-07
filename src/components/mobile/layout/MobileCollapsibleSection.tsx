"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";

interface MobileCollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function MobileCollapsibleSection({ title, defaultOpen = false, children }: MobileCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mobile-card-polish surface-panel surface-panel-strong overflow-hidden rounded-xl">
      <button className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="text-sm text-jade-glow uppercase tracking-wider">{title}</span>
        <motion.span
          className="text-jade-glow"
          animate={{ rotate: open ? 45 : 0, scale: open ? 1.08 : 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 24 }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="px-4 pb-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
