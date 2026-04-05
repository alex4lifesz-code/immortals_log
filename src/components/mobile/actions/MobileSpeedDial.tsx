"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import MobileFAB from "@/components/mobile/actions/MobileFAB";

interface SpeedDialAction {
  id: string;
  label: string;
  onClick: () => void;
}

interface MobileSpeedDialProps {
  actions: SpeedDialAction[];
  side?: "left" | "right";
}

export default function MobileSpeedDial({ actions, side = "right" }: MobileSpeedDialProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close quick actions"
            className="mobile-speed-dial-backdrop z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
        )}

        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed bottom-40 z-40 flex flex-col gap-2 ${side === "left" ? "left-4" : "right-4"}`}
          >
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ delay: index * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="mobile-card-polish min-h-12 rounded-xl border border-border bg-ink-deep px-4 py-2 text-sm text-cloud-white"
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
              >
                {action.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <MobileFAB icon={open ? "x" : "+"} onClick={() => setOpen((v) => !v)} side={side} />
    </>
  );
}
