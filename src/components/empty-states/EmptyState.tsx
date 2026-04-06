"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type IllustrationType = "meditation" | "training" | "scroll" | "mountain" | "community";

const ILLUSTRATION_MAP: Record<IllustrationType, { emoji: string; bg: string }> = {
  meditation: { emoji: "🧘", bg: "from-jade-deep/20 to-transparent" },
  training: { emoji: "⚔️", bg: "from-crimson-deep/20 to-transparent" },
  scroll: { emoji: "📜", bg: "from-gold-dim/20 to-transparent" },
  mountain: { emoji: "🏔️", bg: "from-mountain-blue/20 to-transparent" },
  community: { emoji: "🤝", bg: "from-jade-deep/20 to-transparent" },
};

interface EmptyStateProps {
  illustration: IllustrationType;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  extra?: ReactNode;
}

export default function EmptyState({
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  extra,
}: EmptyStateProps) {
  const illust = ILLUSTRATION_MAP[illustration];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center py-12 px-6"
    >
      {/* Illustration circle */}
      <div
        className={`w-20 h-20 rounded-full bg-gradient-to-br ${illust.bg} border border-ink-light/20
                    flex items-center justify-center mb-6`}
      >
        <span className="text-3xl">{illust.emoji}</span>
      </div>

      <h3 className="text-lg font-bold text-cloud-white mb-2 max-w-xs">{title}</h3>
      <p className="text-mist-mid text-sm max-w-sm mb-6 leading-relaxed">{description}</p>

      {extra}

      <div className="flex flex-col gap-2 w-full max-w-xs">
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="w-full py-2.5 rounded-xl bg-jade-deep border border-jade/50 text-jade-light
                       font-medium text-sm hover:bg-jade/30 transition-colors"
          >
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="w-full py-2.5 rounded-xl border border-ink-light text-mist-light
                       font-medium text-sm hover:bg-ink-mid transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}
