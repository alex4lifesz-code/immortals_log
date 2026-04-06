"use client";

import { motion } from "framer-motion";
import type { CultivationCopy } from "@/lib/copy";

interface TourStepProps {
  copy: CultivationCopy["onboarding"]["tour"];
  onComplete: () => void;
  onBack: () => void;
}

export default function TourStep({ copy, onComplete, onBack }: TourStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col min-h-[80vh] px-6 py-8"
    >
      <h2 className="text-2xl font-bold text-cloud-white mb-1">{copy.title}</h2>
      <p className="text-mist-mid text-sm mb-8">{copy.subtitle}</p>

      <div className="flex-1 space-y-3">
        {copy.tabs.map((tab, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-start gap-4 p-4 rounded-xl bg-ink-deep/40 border border-ink-light/15"
          >
            <div className="w-10 h-10 rounded-lg bg-jade-deep/20 border border-jade/20
                            flex items-center justify-center flex-shrink-0">
              <span className="text-xl">{tab.icon}</span>
            </div>
            <div>
              <h3 className="text-cloud-white font-semibold text-sm">{tab.name}</h3>
              <p className="text-mist-mid text-xs mt-0.5 leading-relaxed">{tab.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8 pt-4 border-t border-ink-light/10">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-ink-light text-mist-light
                     hover:bg-ink-mid transition-colors text-sm font-medium"
        >
          Back
        </button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          className="flex-1 py-3 rounded-xl bg-jade-deep border border-jade/50 text-jade-light
                     hover:bg-jade/30 transition-colors text-sm font-semibold"
        >
          {copy.cta}
        </motion.button>
      </div>
    </motion.div>
  );
}
