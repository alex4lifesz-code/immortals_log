"use client";

import { motion } from "framer-motion";
import type { CultivationCopy } from "@/lib/copy";

interface WelcomeStepProps {
  copy: CultivationCopy["onboarding"]["welcome"];
  onContinue: () => void;
}

export default function WelcomeStep({ copy, onContinue }: WelcomeStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center"
    >
      {/* Cultivation symbol */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-jade-deep/40 to-jade-glow/20 border border-jade/30
                   flex items-center justify-center mb-8"
      >
        <span className="text-4xl">🏔️</span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-cloud-white mb-3"
      >
        {copy.title}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-jade-light text-lg mb-4 max-w-md"
      >
        {copy.subtitle}
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-mist-mid text-sm mb-10 max-w-lg leading-relaxed"
      >
        {copy.description}
      </motion.p>

      {/* Feature cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid gap-4 w-full max-w-md mb-10"
      >
        {copy.features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            className="flex items-start gap-4 p-4 rounded-xl bg-ink-deep/50 border border-ink-light/20"
          >
            <span className="text-2xl flex-shrink-0 mt-0.5">{feature.icon}</span>
            <div className="text-left">
              <h3 className="text-cloud-white font-semibold text-sm">{feature.title}</h3>
              <p className="text-mist-mid text-xs mt-0.5">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="w-full max-w-md py-3.5 rounded-xl bg-jade-deep border border-jade/50 text-jade-light
                   font-semibold text-base hover:bg-jade/30 transition-colors"
      >
        {copy.cta}
      </motion.button>
    </motion.div>
  );
}
