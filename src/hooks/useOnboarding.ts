// src/hooks/useOnboarding.ts — Hook for managing onboarding state

import { useState, useEffect, useCallback } from "react";

interface OnboardingState {
  step: number;
  completed: boolean;
  skipped: boolean;
  profile: {
    fitnessBackground?: string;
    primaryGoal?: string;
    trainingDaysPerWeek?: number;
    assessmentAnswers?: Record<string, string>;
    recommendedTier?: string;
    currentTier?: string;
  } | null;
  loading: boolean;
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    step: 0,
    completed: false,
    skipped: false,
    profile: null,
    loading: true,
  });

  // Load onboarding status
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/onboarding", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setState({
          step: data.data?.onboardingStep ?? 0,
          completed: data.data?.onboardingCompleted ?? false,
          skipped: data.data?.onboardingSkipped ?? false,
          profile: data.data?.profile ?? null,
          loading: false,
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const setStep = useCallback(async (step: number) => {
    setState((s) => ({ ...s, step }));
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "complete-step", step }),
      });
    } catch {
      // Best-effort persistence
    }
  }, []);

  const complete = useCallback(async () => {
    setState((s) => ({ ...s, completed: true }));
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "complete" }),
      });
    } catch {
      // Best-effort
    }
  }, []);

  const skip = useCallback(async () => {
    setState((s) => ({ ...s, skipped: true }));
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "skip" }),
      });
    } catch {
      // Best-effort
    }
  }, []);

  const saveAssessment = useCallback(
    async (data: {
      fitnessBackground: string;
      primaryGoal: string;
      trainingDaysPerWeek: number;
      benchmarkAnswers: Record<string, string>;
      selectedTier?: string;
    }) => {
      try {
        const res = await fetch("/api/onboarding/assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        const result = await res.json();
        const tierData = result.data as { recommendedTier: string; currentTier: string };
        setState((s) => ({
          ...s,
          step: 2,
          profile: {
            ...s.profile,
            ...data,
            recommendedTier: tierData.recommendedTier,
            currentTier: tierData.currentTier,
          },
        }));
        return tierData;
      } catch {
        return null;
      }
    },
    []
  );

  return {
    ...state,
    setStep,
    complete,
    skip,
    saveAssessment,
  };
}
