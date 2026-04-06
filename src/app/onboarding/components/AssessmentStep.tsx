"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { CultivationCopy } from "@/lib/copy";

interface AssessmentStepProps {
  copy: CultivationCopy["onboarding"]["assessment"];
  onContinue: (data: {
    fitnessBackground: string;
    primaryGoal: string;
    trainingDaysPerWeek: number;
    benchmarkAnswers: Record<string, string>;
  }) => void;
  onBack: () => void;
  initialData?: {
    fitnessBackground?: string;
    primaryGoal?: string;
    trainingDaysPerWeek?: number;
    assessmentAnswers?: Record<string, string>;
  } | null;
}

type SubStep = "experience" | "goal" | "days" | "benchmarks";
const SUB_STEPS: SubStep[] = ["experience", "goal", "days", "benchmarks"];

export default function AssessmentStep({ copy, onContinue, onBack, initialData }: AssessmentStepProps) {
  const [subStep, setSubStep] = useState<SubStep>("experience");
  const [fitnessBackground, setFitnessBackground] = useState(initialData?.fitnessBackground ?? "");
  const [primaryGoal, setPrimaryGoal] = useState(initialData?.primaryGoal ?? "");
  const [trainingDays, setTrainingDays] = useState<number | null>(initialData?.trainingDaysPerWeek ?? null);
  const [benchmarks, setBenchmarks] = useState<Record<string, string>>(initialData?.assessmentAnswers ?? {});

  const subStepIndex = SUB_STEPS.indexOf(subStep);

  const handleNext = () => {
    const nextIdx = subStepIndex + 1;
    if (nextIdx < SUB_STEPS.length) {
      setSubStep(SUB_STEPS[nextIdx]);
    } else {
      onContinue({
        fitnessBackground,
        primaryGoal,
        trainingDaysPerWeek: trainingDays ?? 3,
        benchmarkAnswers: benchmarks,
      });
    }
  };

  const handlePrev = () => {
    if (subStepIndex > 0) {
      setSubStep(SUB_STEPS[subStepIndex - 1]);
    } else {
      onBack();
    }
  };

  const canProceed = () => {
    switch (subStep) {
      case "experience": return !!fitnessBackground;
      case "goal": return !!primaryGoal;
      case "days": return trainingDays !== null;
      case "benchmarks": return true; // Optional
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col min-h-[80vh] px-6 py-8"
    >
      <h2 className="text-2xl font-bold text-cloud-white mb-1">{copy.title}</h2>
      <p className="text-mist-mid text-sm mb-6">{copy.subtitle}</p>

      {/* Sub-step progress dots */}
      <div className="flex gap-1.5 mb-8">
        {SUB_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= subStepIndex ? "bg-jade" : "bg-ink-light/30"
            }`}
          />
        ))}
      </div>

      <div className="flex-1">
        {/* Experience sub-step */}
        {subStep === "experience" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-lg font-semibold text-cloud-white mb-4">{copy.trainingExperience}</h3>
            {copy.trainingOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFitnessBackground(opt.value)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  fitnessBackground === opt.value
                    ? "border-jade/60 bg-jade-deep/30"
                    : "border-ink-light/20 bg-ink-deep/30 hover:border-ink-light/40"
                }`}
              >
                <span className="text-cloud-white font-medium text-sm">{opt.label}</span>
                <p className="text-mist-mid text-xs mt-0.5">{opt.description}</p>
              </button>
            ))}
          </motion.div>
        )}

        {/* Goal sub-step */}
        {subStep === "goal" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-lg font-semibold text-cloud-white mb-4">{copy.primaryGoal}</h3>
            {copy.goalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPrimaryGoal(opt.value)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  primaryGoal === opt.value
                    ? "border-jade/60 bg-jade-deep/30"
                    : "border-ink-light/20 bg-ink-deep/30 hover:border-ink-light/40"
                }`}
              >
                <span className="text-cloud-white font-medium text-sm">{opt.label}</span>
                <p className="text-mist-mid text-xs mt-0.5">{opt.description}</p>
              </button>
            ))}
          </motion.div>
        )}

        {/* Training days sub-step */}
        {subStep === "days" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-lg font-semibold text-cloud-white mb-4">{copy.trainingDays}</h3>
            {copy.daysOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTrainingDays(opt.value)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  trainingDays === opt.value
                    ? "border-jade/60 bg-jade-deep/30"
                    : "border-ink-light/20 bg-ink-deep/30 hover:border-ink-light/40"
                }`}
              >
                <span className="text-cloud-white font-medium text-sm">{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Benchmarks sub-step */}
        {subStep === "benchmarks" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-cloud-white">{copy.benchmarkTitle}</h3>
              <p className="text-mist-mid text-xs mt-1">{copy.benchmarkSubtitle}</p>
            </div>
            {copy.benchmarkExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="p-4 rounded-xl bg-ink-deep/30 border border-ink-light/20"
              >
                <div className="mb-2">
                  <span className="text-cloud-white font-medium text-sm">{exercise.name}</span>
                  <p className="text-mist-mid text-xs">{exercise.description}</p>
                </div>
                <div className="flex gap-2">
                  {copy.benchmarkLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setBenchmarks((prev) => ({ ...prev, [exercise.id]: level.value }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                        benchmarks[exercise.id] === level.value
                          ? "border-jade/60 bg-jade-deep/30 text-jade-light"
                          : "border-ink-light/20 text-mist-mid hover:border-ink-light/40"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8 pt-4 border-t border-ink-light/10">
        <button
          onClick={handlePrev}
          className="flex-1 py-3 rounded-xl border border-ink-light text-mist-light
                     hover:bg-ink-mid transition-colors text-sm font-medium"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
            canProceed()
              ? "bg-jade-deep border border-jade/50 text-jade-light hover:bg-jade/30"
              : "bg-ink-deep border border-ink-light/20 text-mist-dark cursor-not-allowed"
          }`}
        >
          {subStep === "benchmarks" ? "Continue" : "Next"}
        </button>
      </div>
    </motion.div>
  );
}
