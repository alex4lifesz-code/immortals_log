"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise } from "../workout/types";
import { stripBwPercentHint } from "../workout/utils";

export default function HistoryPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);

  const userId = user?.id ?? "";

  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }
    setPhysique(loadUserPhysique(userId));
  }, [userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions");
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void fetchExercises();
  }, [fetchExercises]);

  const subtitle = "Review your training logs and cultivation entries";

  const historyInsights = useMemo(() => {
    const flattened = exercises.flatMap((exercise) => {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      const displayName = stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode));
      return logs.map((log) => ({
        id: log.id,
        exerciseId: exercise.id,
        exerciseName: displayName,
        level: log.level,
        createdAt: log.createdAt,
      }));
    });

    const sorted = [...flattened].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const logsLast7Days = sorted.filter((entry) => now - new Date(entry.createdAt).getTime() <= sevenDaysMs).length;

    const uniqueExercises = new Set(sorted.map((entry) => entry.exerciseId)).size;

    const countsByExercise = new Map<string, number>();
    for (const entry of sorted) {
      countsByExercise.set(entry.exerciseName, (countsByExercise.get(entry.exerciseName) ?? 0) + 1);
    }
    const topExercise = [...countsByExercise.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    return {
      total: sorted.length,
      logsLast7Days,
      uniqueExercises,
      topExerciseName: topExercise?.[0] ?? "None yet",
      topExerciseCount: topExercise?.[1] ?? 0,
      recentEntries: sorted.slice(0, 5),
    };
  }, [exercises, settings.terminologyMode]);

  return (
    <PageLayout
      title="History"
      subtitle={subtitle}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="nyaa-history-page space-y-2 px-0 py-2 sm:py-3">
        {loading ? (
          <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
            Loading history...
          </div>
        ) : (
          <>
            <div className="nyaa-history-table-shell">
              <MemoTrainingLogTable
                exercises={exercises}
                physique={physique}
                onRefresh={fetchExercises}
                userId={userId}
              />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
