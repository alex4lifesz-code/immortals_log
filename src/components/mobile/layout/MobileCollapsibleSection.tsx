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
    <section className="overflow-hidden rounded-xl border border-border bg-ink-deep">
      <button className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="text-sm font-semibold text-cloud-white">{title}</span>
        <span className="text-mist-light">{open ? "-" : "+"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
