"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import type { CelebrationId } from "@/hooks/useCelebration";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";

const CELEBRATION_ICONS: Record<CelebrationId, string> = {
  firstCheckin: "📖",
  firstTraining: "⚔️",
  firstFriend: "🤝",
  streak7: "🔥",
  rankUp: "🏔️",
  gettingStartedComplete: "✨",
};

interface CelebrationProps {
  celebrationId: CelebrationId | null;
  onDismiss: () => void;
  lang?: LanguageMode;
}

export default function Celebration({ celebrationId, onDismiss, lang = "english" }: CelebrationProps) {
  const copy = getCopy(lang).celebrations;

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!celebrationId) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [celebrationId, onDismiss]);

  const celebrationCopy = celebrationId ? copy[celebrationId] : null;
  const icon = celebrationId ? CELEBRATION_ICONS[celebrationId] : "";

  return (
    <AnimatePresence>
      {celebrationId && celebrationCopy && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs p-8 rounded-2xl bg-gradient-to-br from-ink-deep to-void-black
                       border border-jade/30 text-center shadow-2xl"
          >
            {/* Glowing icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="w-16 h-16 mx-auto rounded-full bg-jade-deep/40 border border-jade/30
                         flex items-center justify-center mb-5"
            >
              <span className="text-3xl">{icon}</span>
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-bold text-jade-light mb-2"
            >
              {celebrationCopy.title}
            </motion.h3>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-mist-mid text-sm mb-6 leading-relaxed"
            >
              {celebrationCopy.description}
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={onDismiss}
              className="px-6 py-2 rounded-xl bg-jade-deep border border-jade/50 text-jade-light
                         text-sm font-medium hover:bg-jade/30 transition-colors"
            >
              Continue
            </motion.button>

            <p className="text-xs text-mist-dark mt-3">Tap anywhere to dismiss</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
