"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise, LogTableFilter } from "../workout/types";
import { stripBwPercentHint } from "../workout/utils";

export default function HistoryPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const searchParams = useSearchParams();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const [selectedLogFilter, setSelectedLogFilter] = useState<LogTableFilter | null>(null);

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

  useEffect(() => {
    const exerciseId = searchParams.get("exerciseId");
    if (!exerciseId) {
      setSelectedLogFilter(null);
      return;
    }

    const levelParam = searchParams.get("level");
    const parsedLevel = levelParam ? Number.parseInt(levelParam, 10) : null;
    setSelectedLogFilter({
      exerciseId,
      levelNameLevel: Number.isFinite(parsedLevel as number) ? parsedLevel : null,
    });
  }, [searchParams]);

  const subtitle = useMemo(() => {
    if (!selectedLogFilter) return "Review your training logs and cultivation entries";
    return "Filtered to selected exercise history";
  }, [selectedLogFilter]);

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

    const filtered = selectedLogFilter
      ? flattened.filter((entry) => {
          if (entry.exerciseId !== selectedLogFilter.exerciseId) return false;
          if (selectedLogFilter.levelNameLevel == null) return true;
          return entry.level === selectedLogFilter.levelNameLevel;
        })
      : flattened;

    const sorted = [...filtered].sort(
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
  }, [exercises, selectedLogFilter, settings.terminologyMode]);

  return (
    <PageLayout
      title="History"
      subtitle={subtitle}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:py-3">
        {loading ? (
          <div className="rounded-xl border border-ink-light/40 p-6 text-center text-sm text-mist-dark" style={{ background: "var(--surface-gradient-strong)" }}>
            Loading history...
          </div>
        ) : (
          <>
            <section className="flex flex-wrap gap-3">
              <div
                className="min-w-[220px] flex-1 rounded-xl border border-jade-glow/25 p-3 shadow-[var(--shadow-elev-1)] md:basis-[calc(50%-0.375rem)]"
                style={{ background: "var(--surface-gradient-strong)" }}
              >
                <p className="text-[10px] uppercase tracking-wider text-mist-dark">Total Log Entries</p>
                <div className="mt-1 text-2xl font-bold text-jade-light">{historyInsights.total}</div>
                <p className="mt-1 text-[11px] text-mist-light">
                  Unique exercises: <span className="font-semibold text-cloud-white">{historyInsights.uniqueExercises}</span>
                </p>
              </div>

              <div
                className="min-w-[220px] flex-1 rounded-xl border border-gold/25 p-3 shadow-[var(--shadow-elev-1)] md:basis-[calc(50%-0.375rem)]"
                style={{ background: "var(--surface-gradient-strong)" }}
              >
                <p className="text-[10px] uppercase tracking-wider text-mist-dark">Last 7 Days</p>
                <div className="mt-1 text-2xl font-bold text-gold-glow">{historyInsights.logsLast7Days}</div>
                <p className="mt-1 truncate text-[11px] text-mist-light" title={historyInsights.topExerciseName}>
                  Top: <span className="font-semibold text-cloud-white">{historyInsights.topExerciseName}</span>
                  {historyInsights.topExerciseCount > 0 ? ` (${historyInsights.topExerciseCount})` : ""}
                </p>
              </div>

              <div
                className="basis-full rounded-xl border border-ink-light/45 p-3 shadow-[var(--shadow-elev-1)]"
                style={{ background: "var(--surface-gradient-strong)" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-mist-dark">Recent History</p>
                  {selectedLogFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedLogFilter(null)}
                      className="text-[10px] font-semibold text-jade-light hover:text-jade-glow transition-colors"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                {historyInsights.recentEntries.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {historyInsights.recentEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="inline-flex min-w-[190px] flex-1 items-center justify-between gap-2 rounded-lg border border-ink-light/35 bg-ink-dark/35 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-cloud-white">{entry.exerciseName}</p>
                          <p className="text-[10px] text-mist-dark">{formatDateWithPreference(entry.createdAt, dateFormat)}</p>
                        </div>
                        <span className="shrink-0 rounded-md border border-jade-glow/30 bg-jade-deep/18 px-1.5 py-0.5 text-[10px] text-jade-light">
                          Lv {entry.level}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-mist-mid">No training history yet.</p>
                )}
              </div>
            </section>

            <MemoTrainingLogTable
              exercises={exercises}
              physique={physique}
              selectedLogFilter={selectedLogFilter}
              onSelectExercise={setSelectedLogFilter}
              onRefresh={fetchExercises}
              userId={userId}
            />
          </>
        )}
      </div>
    </PageLayout>
  );
}
