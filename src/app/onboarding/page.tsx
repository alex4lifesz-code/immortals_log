"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";
import OnboardingProgress from "./components/OnboardingProgress";
import WelcomeStep from "./components/WelcomeStep";
import AssessmentStep from "./components/AssessmentStep";
import TierAssignmentStep from "./components/TierAssignmentStep";
import FirstCheckinStep from "./components/FirstCheckinStep";
import TourStep from "./components/TourStep";

const DISPLAY_SETTINGS_STORAGE_KEY = "cultivateos-display-settings";
const TOTAL_STEPS = 5;

function getStoredLanguage(): LanguageMode {
  if (typeof window === "undefined") return "english";
  try {
    const raw = window.localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
    if (!raw) return "english";
    const parsed = JSON.parse(raw) as { languageMode?: LanguageMode };
    return parsed.languageMode === "vietnamese" ? "vietnamese" : "english";
  } catch {
    return "english";
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const onboarding = useOnboarding();
  const [currentStep, setCurrentStep] = useState(0);
  const [recommendedTier, setRecommendedTier] = useState("mortal");
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [lang] = useState<LanguageMode>(getStoredLanguage);

  const copy = getCopy(lang);

  // Resume from last saved step
  useEffect(() => {
    if (!onboarding.loading && onboarding.step > 0 && onboarding.step < TOTAL_STEPS) {
      queueMicrotask(() => setCurrentStep(onboarding.step));
    }
    const recommendedTier = onboarding.profile?.recommendedTier;
    if (recommendedTier) {
      queueMicrotask(() => setRecommendedTier(recommendedTier));
    }
  }, [onboarding.loading, onboarding.step, onboarding.profile]);

  // If onboarding already done, redirect to dashboard
  useEffect(() => {
    if (!onboarding.loading && (onboarding.completed || onboarding.skipped)) {
      router.replace("/dashboard");
    }
  }, [onboarding.loading, onboarding.completed, onboarding.skipped, router]);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      onboarding.setStep(step);
    },
    [onboarding]
  );

  const handleAssessmentComplete = useCallback(
    async (data: {
      fitnessBackground: string;
      primaryGoal: string;
      trainingDaysPerWeek: number;
      benchmarkAnswers: Record<string, string>;
    }) => {
      const result = await onboarding.saveAssessment(data);
      if (result) {
        setRecommendedTier(result.recommendedTier);
      }
      goToStep(2);
    },
    [onboarding, goToStep]
  );

  const handleTierConfirm = useCallback(
    async (tier: string) => {
      // Update assessment with selected tier if different
      if (onboarding.profile) {
        await onboarding.saveAssessment({
          fitnessBackground: onboarding.profile.fitnessBackground ?? "new",
          primaryGoal: onboarding.profile.primaryGoal ?? "consistency",
          trainingDaysPerWeek: onboarding.profile.trainingDaysPerWeek ?? 3,
          benchmarkAnswers: onboarding.profile.assessmentAnswers ?? {},
          selectedTier: tier,
        });
      }
      goToStep(3);
    },
    [onboarding, goToStep]
  );

  const handleComplete = useCallback(async () => {
    await onboarding.complete();
    // Update auth context so dashboard layout won't redirect back
    if (user) {
      login({ ...user, onboardingCompleted: true, onboardingStep: 5 });
    }
    router.replace("/dashboard");
  }, [onboarding, user, login, router]);

  const handleSkip = useCallback(async () => {
    await onboarding.skip();
    // Update auth context so dashboard layout won't redirect back
    if (user) {
      login({ ...user, onboardingSkipped: true, onboardingStep: 5 });
    }
    router.replace("/dashboard");
  }, [onboarding, user, login, router]);

  if (onboarding.loading) {
    return (
      <div className="safe-area-shell min-h-app flex items-center justify-center">
        <p className="text-mist-mid text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="safe-area-shell min-h-app bg-void-black relative overflow-x-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-void-black via-ink-deep to-jade-glow/10 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-80 h-80 bg-jade-deep/10 rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto">
        {/* Progress bar (hidden on welcome step) */}
        {currentStep > 0 && (
          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            stepLabel={copy.onboarding.progress.step}
            ofLabel={copy.onboarding.progress.of}
          />
        )}

        {/* Skip button */}
        {currentStep > 0 && (
          <div className="flex justify-end px-6 pt-2">
            <button
              onClick={() => setShowSkipConfirm(true)}
              className="text-xs text-mist-dark hover:text-mist-mid transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {/* Steps */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <WelcomeStep
              key="welcome"
              copy={copy.onboarding.welcome}
              onContinue={() => goToStep(1)}
            />
          )}
          {currentStep === 1 && (
            <AssessmentStep
              key="assessment"
              copy={copy.onboarding.assessment}
              onContinue={handleAssessmentComplete}
              onBack={() => goToStep(0)}
              initialData={onboarding.profile}
            />
          )}
          {currentStep === 2 && (
            <TierAssignmentStep
              key="tier"
              copy={copy.onboarding.tierAssignment}
              recommendedTier={recommendedTier}
              onContinue={handleTierConfirm}
              onBack={() => goToStep(1)}
            />
          )}
          {currentStep === 3 && (
            <FirstCheckinStep
              key="checkin"
              copy={copy.onboarding.firstCheckin}
              onContinue={() => goToStep(4)}
              onBack={() => goToStep(2)}
            />
          )}
          {currentStep === 4 && (
            <TourStep
              key="tour"
              copy={copy.onboarding.tour}
              onComplete={handleComplete}
              onBack={() => goToStep(3)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Skip confirmation modal */}
      <AnimatePresence>
        {showSkipConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60"
            onClick={() => setShowSkipConfirm(false)}
          >
            <div
              className="w-full max-w-sm p-6 rounded-2xl bg-ink-deep border border-ink-light/30"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-cloud-white mb-2">
                {copy.onboarding.skipConfirm.title}
              </h3>
              <p className="text-mist-mid text-sm mb-6">
                {copy.onboarding.skipConfirm.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ink-light text-mist-light
                             hover:bg-ink-mid transition-colors text-sm"
                >
                  {copy.onboarding.skipConfirm.cancel}
                </button>
                <button
                  onClick={handleSkip}
                  className="flex-1 py-2.5 rounded-xl bg-crimson-deep/30 border border-crimson/30
                             text-crimson-light hover:bg-crimson/20 transition-colors text-sm"
                >
                  {copy.onboarding.skipConfirm.confirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
