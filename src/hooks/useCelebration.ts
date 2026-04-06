// src/hooks/useCelebration.ts — Track which celebrations have been shown

import { useState, useCallback } from "react";

export type CelebrationId =
  | "firstCheckin"
  | "firstTraining"
  | "firstFriend"
  | "streak7"
  | "rankUp"
  | "gettingStartedComplete";

const STORAGE_KEY = "shown-celebrations";

function getShownCelebrations(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveShownCelebrations(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore
  }
}

export function useCelebration() {
  const [activeCelebration, setActiveCelebration] = useState<CelebrationId | null>(null);

  const trigger = useCallback((id: CelebrationId) => {
    const shown = getShownCelebrations();
    if (shown.has(id)) return;
    shown.add(id);
    saveShownCelebrations(shown);
    setActiveCelebration(id);
  }, []);

  const dismiss = useCallback(() => {
    setActiveCelebration(null);
  }, []);

  const hasBeenShown = useCallback((id: CelebrationId) => {
    return getShownCelebrations().has(id);
  }, []);

  return { activeCelebration, trigger, dismiss, hasBeenShown };
}
