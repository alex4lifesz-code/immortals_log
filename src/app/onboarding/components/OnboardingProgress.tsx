"use client";

import { motion } from "framer-motion";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string;
  ofLabel?: string;
}

export default function OnboardingProgress({
  currentStep,
  totalSteps,
  stepLabel = "Step",
  ofLabel = "of",
}: OnboardingProgressProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="w-full px-6 pt-4">
      <div className="flex items-center justify-between text-xs text-mist-mid mb-2">
        <span>
          {stepLabel} {currentStep + 1} {ofLabel} {totalSteps}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-1.5 bg-ink-deep rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-jade-deep to-jade-glow rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
