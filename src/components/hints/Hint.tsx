"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useFirstTimeHint } from "@/hooks/useFirstTimeHint";

interface HintProps {
  id: string;
  title: string;
  description: string;
  position?: "top" | "bottom";
}

export default function Hint({ id, title, description, position = "bottom" }: HintProps) {
  const { visible, dismiss } = useFirstTimeHint(id);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: position === "bottom" ? -8 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === "bottom" ? -8 : 8 }}
          className={`absolute left-0 right-0 z-40 mx-4 ${
            position === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
          }`}
        >
          <div className="relative p-3 rounded-xl bg-jade-deep/90 border border-jade/30 backdrop-blur-sm shadow-lg">
            {/* Arrow */}
            <div
              className={`absolute left-6 w-2.5 h-2.5 bg-jade-deep/90 border-jade/30 rotate-45 ${
                position === "bottom"
                  ? "-top-1.5 border-t border-l"
                  : "-bottom-1.5 border-b border-r"
              }`}
            />

            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-jade-light">{title}</h4>
                <p className="text-xs text-mist-light/80 mt-0.5 leading-relaxed">{description}</p>
              </div>
              <button
                onClick={dismiss}
                className="text-jade-light/60 hover:text-jade-light text-xs p-1 flex-shrink-0"
                aria-label="Dismiss hint"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
