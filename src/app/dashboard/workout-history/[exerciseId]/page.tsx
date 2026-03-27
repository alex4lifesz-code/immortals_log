"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { inferExerciseType, formatSetReps, formatSetValue } from "@/lib/unit-conversion";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import {
  parseModifierWithBand,
  formatResistanceBandLabel,
  stripBwPercentHint,
  getExerciseCategoryLabel,
} from "@/app/dashboard/workout/utils";

type CompactLog = {
  id: string;
  createdAt: string;
  level: number;
  val1: number | null;
  val2: number | null;
  val3: number | null;
  reps1: number | null;
  reps2: number | null;
  reps3: number | null;
  modifier: string | null;
  resistanceBandKg: number | null;
  variant: string | null;
  notes: string | null;
  isTimed: boolean;
};

function formatSimpleSet(log: CompactLog, index: 0 | 1 | 2, weightUnit: "kg" | "lbs"): string {
  const value = index === 0 ? log.val1 : index === 1 ? log.val2 : log.val3;
  const reps = index === 0 ? log.reps1 : index === 1 ? log.reps2 : log.reps3;
  if (value == null && reps == null) return "-";
  const valueDisplay = formatSetValue(value, log.isTimed ? "timed" : "weighted", weightUnit);
  if (log.isTimed) return valueDisplay;
  if (reps == null) return valueDisplay;
  return `${valueDisplay} x ${formatSetReps(reps, "weighted")}`;
}

function getSimpleSetParts(log: CompactLog, index: 0 | 1 | 2, weightUnit: "kg" | "lbs"): { value: string; reps: string } {
  const value = index === 0 ? log.val1 : index === 1 ? log.val2 : log.val3;
  const reps = index === 0 ? log.reps1 : index === 1 ? log.reps2 : log.reps3;
  const valueDisplay = value == null ? "-" : formatSetValue(value, log.isTimed ? "timed" : "weighted", weightUnit);
  const repsDisplay = log.isTimed ? "-" : reps == null ? "-" : formatSetReps(reps, "weighted");
  return { value: valueDisplay, reps: repsDisplay };
}

export default function WorkoutHistoryDetailPage() {
  const params = useParams<{ exerciseId: string }>();
  const exerciseId = params?.exerciseId ?? "";
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const weightUnit = settings.defaultWeightUnit || "kg";

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<ProgressionExercise | null>(null);

  const fetchExercise = useCallback(async () => {
    if (!exerciseId) return;
    setLoading(true);
    try {
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions");
      const match = (data.exercises || []).find((item) => item.id === exerciseId) ?? null;
      setExercise(match);
    } catch (error) {
      console.error("Failed to load workout history detail", error);
      setExercise(null);
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  useEffect(() => {
    void fetchExercise();
  }, [fetchExercise]);

  const logs = useMemo<CompactLog[]>(() => {
    if (!exercise) return [];
    return (exercise.userProgress?.[0]?.logs ?? [])
      .map((log) => {
        const hasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
        const exerciseType = inferExerciseType(exercise, hasHold);
        const parsed = parseModifierWithBand(log.modifier);
        return {
          id: log.id,
          createdAt: log.createdAt,
          level: parsed.displayLevelOverride ?? log.level,
          val1: hasHold ? log.holdTime : log.weight1,
          val2: hasHold ? log.holdTime2 : log.weight2,
          val3: hasHold ? log.holdTime3 : log.weight3,
          reps1: log.reps1,
          reps2: log.reps2,
          reps3: log.reps3,
          modifier: parsed.modifierWeightKg != null
            ? [parsed.baseModifier, `+${parsed.modifierWeightKg}kg`].filter(Boolean).join(" | ")
            : parsed.baseModifier,
          resistanceBandKg: parsed.resistanceBandKg,
          variant: log.variant,
          notes: log.notes,
          isTimed: exerciseType === "timed",
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [exercise]);

  const displayName = useMemo(() => {
    if (!exercise) return "Workout";
    return stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode));
  }, [exercise, settings.terminologyMode]);

  const logsLast7Days = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return logs.filter((log) => now - new Date(log.createdAt).getTime() <= sevenDaysMs).length;
  }, [logs]);

  return (
    <PageLayout
      title={`${displayName} History`}
      subtitle="Compact training record for this workout"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 py-2 sm:py-3">
        <div className="flex items-center justify-between rounded-xl border border-ink-light/45 px-3 py-2" style={{ background: "var(--surface-gradient-strong)" }}>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-cloud-white">{displayName}</p>
            <p className="text-[10px] text-mist-dark">{exercise ? getExerciseCategoryLabel(exercise) : "Exercise"}</p>
          </div>
          <Link
            href="/dashboard/workout-history"
            className="rounded-md border border-jade-glow/35 bg-jade-deep/15 px-2 py-1 text-[10px] font-semibold text-jade-light hover:bg-jade-deep/25"
          >
            Back
          </Link>
        </div>

        {loading ? (
          <div className="rounded-xl border border-ink-light/40 p-5 text-center text-xs text-mist-dark" style={{ background: "var(--surface-gradient-strong)" }}>
            Loading workout history...
          </div>
        ) : !exercise ? (
          <div className="rounded-xl border border-crimson/30 bg-crimson-deep/10 p-5 text-center text-xs text-crimson-light">
            Workout not found.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-jade-glow/25 p-3" style={{ background: "var(--surface-gradient-strong)" }}>
                <p className="text-[10px] uppercase tracking-wide text-mist-dark">Total Logs</p>
                <p className="mt-1 text-xl font-bold text-jade-light">{logs.length}</p>
              </div>
              <div className="rounded-lg border border-gold/25 p-3" style={{ background: "var(--surface-gradient-strong)" }}>
                <p className="text-[10px] uppercase tracking-wide text-mist-dark">Last 7 Days</p>
                <p className="mt-1 text-xl font-bold text-gold-glow">{logsLast7Days}</p>
              </div>
            </section>

            <section className="space-y-2">
              {logs.length === 0 ? (
                <div className="rounded-lg border border-ink-light/45 bg-ink-dark/30 px-3 py-4 text-center text-xs text-mist-mid">
                  No logs for this workout yet.
                </div>
              ) : (
                logs.map((log) => (
                  <article
                    key={log.id}
                    className="rounded-xl border border-ink-light/45 bg-ink-dark/30 px-2.5 py-2 shadow-[var(--shadow-elev-1)]"
                  >
                    {(() => {
                      const set1 = getSimpleSetParts(log, 0, weightUnit);
                      const set2 = getSimpleSetParts(log, 1, weightUnit);
                      const set3 = getSimpleSetParts(log, 2, weightUnit);
                      return (
                    <div className="space-y-1 text-[10px] leading-none">
                      <div className="flex items-center gap-2 whitespace-nowrap overflow-x-auto scrollbar-hide tabular-nums">
                        <span className="text-mist-dark">{formatDateWithPreference(log.createdAt, dateFormat)}</span>
                        <span className="rounded-md border border-jade-glow/30 bg-jade-deep/15 px-1.5 py-1 text-jade-light">
                          Lv {log.level}
                        </span>
                        <div className="inline-flex items-center gap-1">
                          <span className="text-mist-dark">S1</span>
                          <span className="inline-block w-[3.4rem] text-right text-cloud-white">{set1.value}</span>
                          <span className="text-mist-dark">x</span>
                          <span className="inline-block w-[1.8rem] text-left text-cloud-white">{set1.reps}</span>
                        </div>
                        <div className="inline-flex items-center gap-1">
                          <span className="text-mist-dark">S2</span>
                          <span className="inline-block w-[3.4rem] text-right text-cloud-white">{set2.value}</span>
                          <span className="text-mist-dark">x</span>
                          <span className="inline-block w-[1.8rem] text-left text-cloud-white">{set2.reps}</span>
                        </div>
                        <div className="inline-flex items-center gap-1">
                          <span className="text-mist-dark">S3</span>
                          <span className="inline-block w-[3.4rem] text-right text-cloud-white">{set3.value}</span>
                          <span className="text-mist-dark">x</span>
                          <span className="inline-block w-[1.8rem] text-left text-cloud-white">{set3.reps}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 whitespace-nowrap overflow-x-auto scrollbar-hide">
                        {log.modifier && (
                          <span className="rounded border border-gold/30 bg-gold/10 px-1.5 py-1 text-gold-glow">
                            {log.modifier}
                          </span>
                        )}
                        {log.resistanceBandKg != null && (
                          <span className="rounded border border-mountain-blue-glow/30 bg-mountain-blue-deep/20 px-1.5 py-1 text-mountain-blue-glow">
                            {formatResistanceBandLabel(log.resistanceBandKg)}
                          </span>
                        )}
                        {log.variant && (
                          <span className="max-w-[180px] truncate rounded border border-ink-light/40 bg-ink-mid/35 px-1.5 py-1 text-mist-light" title={log.variant}>
                            {log.variant}
                          </span>
                        )}
                        {log.notes && (
                          <span className="max-w-[220px] truncate text-mist-light" title={log.notes}>
                            {log.notes}
                          </span>
                        )}
                        {!log.modifier && log.resistanceBandKg == null && !log.variant && !log.notes && (
                          <span className="text-mist-dark">-</span>
                        )}
                      </div>
                    </div>
                      );
                    })()}
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
}
