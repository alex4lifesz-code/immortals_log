"use client";

import { motion } from "framer-motion";
import { GlowModal } from "@/components/ui/GlowCard";

export function TierColorLegend({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Training Display Update">
      <div className="space-y-3 text-sm text-mist-mid">
        <p>The hardcoded cultivation color guide has been removed from the workout flow.</p>
        <p>Training surfaces now use neutral styling and level-based labels instead of fixed rank colours and synthetic progression names.</p>
      </div>
    </GlowModal>
  );
}

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="text-6xl mb-6 opacity-40">🏛️</div>
      <h2 className="text-xl text-cloud-white mb-2">No Progressions Yet</h2>
      <p className="text-sm text-mist-mid max-w-md mb-6">
        Upload a JSON file in the <span className="text-jade-glow font-medium">Technique Scroll</span> page to populate your progression exercises.
      </p>
    </motion.div>
  );
}
