// src/hooks/useGettingStarted.ts — Track getting started checklist progress

import { useState, useEffect, useCallback } from "react";

export interface GettingStartedTasks {
  firstCheckin: boolean;
  firstTraining: boolean;
  exploreLibrary: boolean;
  addFriend: boolean;
  customizeSettings: boolean;
}

const DEFAULT_TASKS: GettingStartedTasks = {
  firstCheckin: false,
  firstTraining: false,
  exploreLibrary: false,
  addFriend: false,
  customizeSettings: false,
};

const STORAGE_KEY = "getting-started-tasks";
const DISMISSED_KEY = "getting-started-dismissed";

export function useGettingStarted() {
  const [tasks, setTasks] = useState<GettingStartedTasks>(DEFAULT_TASKS);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load from localStorage + server
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<GettingStartedTasks>;
        setTasks((t) => ({ ...t, ...parsed }));
      }
      const isDismissed = localStorage.getItem(DISMISSED_KEY) === "true";
      setDismissed(isDismissed);
    } catch {
      // Ignore
    }
    setLoading(false);
  }, []);

  const completeTask = useCallback((taskId: keyof GettingStartedTasks) => {
    setTasks((prev) => {
      const updated = { ...prev, [taskId]: true };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Ignore
    }
  }, []);

  const completedCount = Object.values(tasks).filter(Boolean).length;
  const totalCount = Object.keys(tasks).length;
  const allComplete = completedCount === totalCount;

  return {
    tasks,
    dismissed,
    loading,
    completedCount,
    totalCount,
    allComplete,
    completeTask,
    dismiss,
  };
}
