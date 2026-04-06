"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { CultivationCopy } from "@/lib/copy";

type TierKey = "mortal" | "initiate" | "disciple" | "master" | "grandmaster" | "immortal";

const TIER_ORDER: TierKey[] = ["mortal", "initiate", "disciple", "master", "grandmaster", "immortal"];

const TIER_ICONS: Record<TierKey, string> = {
  mortal: "🌱",
  initiate: "🔥",
  disciple: "⚔️",
  master: "🏔️",
  grandmaster: "👑",
  immortal: "✨",
};

interface TierAssignmentStepProps {
  copy: CultivationCopy["onboarding"]["tierAssignment"];
  recommendedTier: string;
  onContinue: (selectedTier: string) => void;
  onBack: () => void;
}

export default function TierAssignmentStep({
  copy,
  recommendedTier,
  onContinue,
  onBack,
}: TierAssignmentStepProps) {
  const [selectedTier, setSelectedTier] = useState<TierKey>(
    (recommendedTier as TierKey) || "mortal"
  );

  const tierInfo = copy.tiers[selectedTier];
  const recommendedIndex = TIER_ORDER.indexOf(recommendedTier as TierKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col min-h-[80vh] px-6 py-8"
    >
      <h2 className="text-2xl font-bold text-cloud-white mb-1">{copy.title}</h2>
      <p className="text-mist-mid text-sm mb-8">{copy.subtitle}</p>

      {/* Recommended tier highlight */}
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-jade-deep/30 to-ink-deep border border-jade/30 mb-6 text-center"
      >
        <span className="text-5xl mb-3 block">{TIER_ICONS[selectedTier]}</span>
        <h3 className="text-2xl font-bold text-jade-light mb-2">{tierInfo.name}</h3>
        <p className="text-mist-light text-sm leading-relaxed">{tierInfo.description}</p>
        {selectedTier === recommendedTier && (
          <span className="inline-block mt-3 text-xs text-jade bg-jade-deep/50 px-3 py-1 rounded-full border border-jade/30">
            Recommended
          </span>
        )}
      </motion.div>

      {/* Tier selector */}
      <p className="text-mist-mid text-xs mb-3">{copy.adjustPrompt}</p>
      <div className="grid grid-cols-3 gap-2 mb-auto">
        {TIER_ORDER.map((tier, i) => {
          const isSelected = tier === selectedTier;
          const isRecommended = tier === recommendedTier;

          return (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`relative p-3 rounded-xl border text-center transition-all ${
                isSelected
                  ? "border-jade/60 bg-jade-deep/30"
                  : "border-ink-light/20 bg-ink-deep/30 hover:border-ink-light/40"
              }`}
            >
              <span className="text-lg block mb-1">{TIER_ICONS[tier]}</span>
              <span className={`text-xs font-medium ${isSelected ? "text-jade-light" : "text-mist-mid"}`}>
                {copy.tiers[tier].name}
              </span>
              {isRecommended && !isSelected && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-jade rounded-full" />
              )}
            </button>
          );
        })}
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
        <button
          onClick={() => onContinue(selectedTier)}
          className="flex-1 py-3 rounded-xl bg-jade-deep border border-jade/50 text-jade-light
                     hover:bg-jade/30 transition-colors text-sm font-semibold"
        >
          {copy.confirmCta}
        </button>
      </div>
    </motion.div>
  );
}
