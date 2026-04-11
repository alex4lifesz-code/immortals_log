"use client";

import { motion, AnimatePresence } from "framer-motion";
import MobileButton from "@/components/mobile/inputs/MobileButton";

interface UnsavedChangesModalProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export default function UnsavedChangesModal({ open, onStay, onLeave }: UnsavedChangesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] bg-void-black/70"
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-[76] rounded-t-3xl border-t border-border bg-ink-deep p-5 pb-[max(env(safe-area-inset-bottom,0px),20px)] pl-[max(env(safe-area-inset-left,0px),20px)] pr-[max(env(safe-area-inset-right,0px),20px)]"
          >
            <h3 className="text-lg font-semibold text-cloud-white">Unsaved changes</h3>
            <p className="mt-1 text-sm text-mist-light">Leave this screen and discard your current edits?</p>
            <div className="mt-4 flex gap-3">
              <MobileButton variant="ghost" className="flex-1" onClick={onStay}>
                Stay
              </MobileButton>
              <MobileButton variant="danger" className="flex-1" onClick={onLeave}>
                Discard
              </MobileButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
