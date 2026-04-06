// src/hooks/useFirstTimeHint.ts — Track dismissed hints in localStorage

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "dismissed-hints";

function getDismissedHints(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissedHints(hints: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hints]));
  } catch {
    // Ignore
  }
}

export function useFirstTimeHint(hintId: string) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = getDismissedHints();
    if (!dismissed.has(hintId)) {
      // Small delay before showing to avoid layout flicker
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hintId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    const dismissed = getDismissedHints();
    dismissed.add(hintId);
    saveDismissedHints(dismissed);
  }, [hintId]);

  return { visible, dismiss };
}
