"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { normalizeTrainComboLogs, type TrainComboLog } from "@/lib/train-combo";
import { translateEnglishToLanguage } from "@/lib/language";
import { lbsToKg } from "@/lib/unit-conversion";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";

type LoggerValueMode = "weight" | "timed";
type LoggerUnit = "kg" | "lbs" | "seconds" | "minutes";

type LoggerSetRow = {
  value: string;
  reps: string;
};

type LoggerSectionCollapse = {
  modifier: boolean;
};

type LoggerStopState = {
  valueMode: LoggerValueMode;
  unit: LoggerUnit;
  modifier: string;
  sets: LoggerSetRow[];
  collapsed: LoggerSectionCollapse;
};

const STOP_FLASH_DURATION_MS = 700;
const STOP_FLASH_SCALE = 1.06;
const MODIFIER_MIN = -50;
const MODIFIER_MAX = 50;
const MODIFIER_STEP = 0.5;
const WEIGHT_VALUE_STEP = 0.5;
const TIMED_VALUE_STEP = 1;
const REPS_STEP = 1;
const SUMMARY_STEP_KEY = "__combo-summary-step__";

function normalizeSetRows(rows: LoggerSetRow[] | undefined): LoggerSetRow[] {
  const safeRows = Array.isArray(rows)
    ? rows.map((row) => ({
        value: typeof row?.value === "string" ? row.value : "",
        reps: typeof row?.reps === "string" ? row.reps : "",
      }))
    : [];

  let lastFilledIndex = -1;
  safeRows.forEach((row, index) => {
    if (row.value.trim() || row.reps.trim()) lastFilledIndex = index;
  });

  return safeRows.slice(0, Math.max(lastFilledIndex + 1, 1));
}

export default function ComboLoggerPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const comboId = typeof params?.id === "string" ? params.id : "";
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);

  const [loading, setLoading] = useState(true);
  const [routine, setRoutine] = useState<TrainComboLog | null>(null);
  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [stopStates, setStopStates] = useState<Record<string, LoggerStopState>>({});
  const [completedStops, setCompletedStops] = useState<Record<string, boolean>>({});
  const [flashingStopKey, setFlashingStopKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRoutineAndExercises = useCallback(async () => {
    if (!comboId) {
      setRoutine(null);
      setMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [comboPayload, progressionPayload] = await Promise.all([
        api.get<{ routines?: unknown; logs?: unknown }>("/api/train-combo", { cache: "no-store" }),
        api.get<{ exercises?: ProgressionExercise[] }>("/api/progressions/history?logLimit=1&exerciseLimit=5000", { cache: "no-store" }),
      ]);

      const routines = normalizeTrainComboLogs(comboPayload.routines);
      const logs = normalizeTrainComboLogs(comboPayload.logs);
      const matched = routines.find((entry) => entry.id === comboId) || logs.find((entry) => entry.id === comboId) || null;

      setRoutine(matched);
      setExercises(Array.isArray(progressionPayload.exercises) ? progressionPayload.exercises : []);
      setMessage(null);
    } catch (error) {
      console.error("Failed to load combo logger:", error);
      setRoutine(null);
      setExercises([]);
      setMessage({ type: "error", text: "Failed to load combo workout logger." });
    } finally {
      setLoading(false);
    }
  }, [comboId]);

  useEffect(() => {
    void fetchRoutineAndExercises();
  }, [fetchRoutineAndExercises]);

  const exerciseById = useMemo(() => {
    return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  const getStopKey = (exerciseId: string, index: number) => `${exerciseId}-${index}`;

  const createInitialStopState = useCallback((): LoggerStopState => {
    const defaultWeightUnit = settings.defaultWeightUnit === "lbs" ? "lbs" : "kg";
    return {
      valueMode: "weight",
      unit: defaultWeightUnit,
      modifier: "0",
      sets: [{ value: "", reps: "" }],
      collapsed: {
        modifier: true,
      },
    };
  }, [settings.defaultWeightUnit]);

  useEffect(() => {
    if (!routine) {
      setStopStates({});
      setCompletedStops({});
      setFlashingStopKey(null);
      setActiveStopIndex(0);
      return;
    }

    setStopStates((prev) => {
      const next: Record<string, LoggerStopState> = {};
      routine.exercises.forEach((stop, index) => {
        const key = getStopKey(stop.exerciseId, index);
        if (!prev[key]) {
          next[key] = createInitialStopState();
          return;
        }

        next[key] = {
          ...prev[key],
          sets: normalizeSetRows(prev[key].sets),
        };
      });
      return next;
    });

    setActiveStopIndex((prev) => {
      if (routine.exercises.length === 0) return 0;
      return Math.min(prev, routine.exercises.length);
    });
  }, [createInitialStopState, routine]);

  const getProgressionLabel = (exerciseId: string, progressionLevel?: number) => {
    const level = typeof progressionLevel === "number" && Number.isFinite(progressionLevel) ? progressionLevel : 1;
    const parentExercise = exerciseById.get(exerciseId);
    const matchedTier = parentExercise?.tiers?.find((tier) => tier.level === level);
    return matchedTier?.name || `${lt("Progression")} ${level}`;
  };

  const updateStopState = (index: number, updater: (current: LoggerStopState) => LoggerStopState) => {
    if (!routine || !routine.exercises[index]) return;
    const key = getStopKey(routine.exercises[index].exerciseId, index);
    setStopStates((prev) => {
      const current = prev[key] ?? createInitialStopState();
      return {
        ...prev,
        [key]: updater(current),
      };
    });
  };

  const addSetRow = (index: number) => {
    updateStopState(index, (current) => ({
      ...current,
      sets: [...current.sets, { value: "", reps: "" }],
    }));
  };

  const removeSetRow = (index: number, setIndex: number) => {
    updateStopState(index, (current) => {
      if (current.sets.length <= 1) return current;
      return {
        ...current,
        sets: current.sets.filter((_, rowIndex) => rowIndex !== setIndex),
      };
    });
  };

  const parseNumber = (value: string, integerOnly = false): number | null => {
    if (!value || value.trim() === "") return null;
    const parsed = integerOnly ? Number.parseInt(value, 10) : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toStoredWeightKg = (value: number | null, unit: LoggerUnit): number | null => {
    if (value == null) return null;
    return unit === "lbs" ? lbsToKg(value) : value;
  };

  const toStoredSeconds = (value: number | null, unit: LoggerUnit): number | null => {
    if (value == null) return null;
    const seconds = unit === "minutes" ? value * 60 : value;
    return Math.max(0, Math.round(seconds));
  };

  const activeStop = routine?.exercises[activeStopIndex] ?? null;
  const activeStopState = activeStop
    ? stopStates[getStopKey(activeStop.exerciseId, activeStopIndex)] ?? createInitialStopState()
    : null;
  const summaryStepIndex = routine?.exercises.length ?? 0;
  const isSummaryStep = Boolean(routine) && activeStopIndex === summaryStepIndex;
  const routineExercises = routine?.exercises ?? [];
  const allStopsComplete = routineExercises.length > 0
    && routineExercises.every((stop, index) => {
      const stopKey = getStopKey(stop.exerciseId, index);
      return Boolean(completedStops[stopKey]);
    });

  const isFirstSetReady = (state: LoggerStopState | null) => {
    if (!state || state.sets.length === 0) return false;
    const firstSet = state.sets[0];
    return Boolean(firstSet?.value?.trim() && firstSet?.reps?.trim());
  };

  const goToNextStop = () => {
    if (!routine || routine.exercises.length === 0) return;

    const currentStop = routine.exercises[activeStopIndex];
    const currentKey = currentStop ? getStopKey(currentStop.exerciseId, activeStopIndex) : null;

    if (currentKey && isFirstSetReady(activeStopState)) {
      setCompletedStops((prev) => ({ ...prev, [currentKey]: true }));
    }

    const lastIndex = routine.exercises.length;
    const nextIndex = Math.min(lastIndex, activeStopIndex + 1);
    if (nextIndex === activeStopIndex) return;

    const nextStop = routine.exercises[nextIndex];
    const nextKey = nextStop ? getStopKey(nextStop.exerciseId, nextIndex) : SUMMARY_STEP_KEY;
    setActiveStopIndex(nextIndex);
    setFlashingStopKey(nextKey);
  };

  const handleLogComboWorkout = async () => {
    if (!routine || saving) return;

    const incompleteStop = routine.exercises.find((stop, index) => {
      const stopKey = getStopKey(stop.exerciseId, index);
      return !completedStops[stopKey];
    });

    if (incompleteStop) {
      setMessage({ type: "error", text: lt("Complete each stop's first set before logging the full combo.") });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const trainingDate = new Date().toISOString().slice(0, 10);
      const createdAt = new Date().toISOString();

      for (let index = 0; index < routine.exercises.length; index += 1) {
        const stop = routine.exercises[index];
        const stopKey = getStopKey(stop.exerciseId, index);
        const state = stopStates[stopKey] ?? createInitialStopState();

        const parsedSets = state.sets
          .map((set) => ({
            value: parseNumber(set.value, false),
            reps: parseNumber(set.reps, true),
          }))
          .filter((set) => set.value != null || set.reps != null);

        const primarySets = [parsedSets[0] ?? null, parsedSets[1] ?? null, parsedSets[2] ?? null];

        const toWeight = (value: number | null) => (state.valueMode === "weight" ? toStoredWeightKg(value, state.unit) : null);
        const toTime = (value: number | null) => (state.valueMode === "timed" ? toStoredSeconds(value, state.unit) : null);

        await api.post(`/api/progressions/${stop.exerciseId}/log`, {
          level: typeof stop.progressionLevel === "number" ? Math.max(1, Math.trunc(stop.progressionLevel)) : 1,
          trainingDate,
          weight1: toWeight(primarySets[0]?.value ?? null),
          reps1: primarySets[0]?.reps ?? null,
          weight2: toWeight(primarySets[1]?.value ?? null),
          reps2: primarySets[1]?.reps ?? null,
          weight3: toWeight(primarySets[2]?.value ?? null),
          reps3: primarySets[2]?.reps ?? null,
          holdTime: toTime(primarySets[0]?.value ?? null),
          holdTime2: toTime(primarySets[1]?.value ?? null),
          holdTime3: toTime(primarySets[2]?.value ?? null),
          sets: parsedSets.map((set) => ({
            value: state.valueMode === "timed" ? toTime(set.value) : toWeight(set.value),
            reps: set.reps,
            metric: state.valueMode === "timed" ? "time" : "weight",
          })),
          variant: stop.variant?.trim() || null,
          modifier: null,
          notes: routine.notes || null,
          completed: false,
          createdAt,
        });
      }

      await api.post("/api/train-combo", {
        entryType: "log",
        routineName: routine.routineName,
        trainingDate,
        createdAt,
        notes: routine.notes || null,
        exercises: routine.exercises.map((stop) => ({
          exerciseId: stop.exerciseId,
          name: stop.name,
          progressionLevel: typeof stop.progressionLevel === "number" ? Math.max(1, Math.trunc(stop.progressionLevel)) : 1,
          variant: stop.variant || "",
        })),
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("train-combo-logs-updated"));
      }

      setMessage({ type: "success", text: lt("Combo workout logged successfully.") });
      router.push("/dashboard/history");
    } catch (error) {
      console.error("Failed to log combo workout:", error);
      setMessage({ type: "error", text: lt("Failed to log combo workout. Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!flashingStopKey) return;
    const timeout = window.setTimeout(() => setFlashingStopKey(null), STOP_FLASH_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [flashingStopKey]);

  const modifierLabel = activeStopState
    ? `${activeStopState.modifier || "0"} ${activeStopState.valueMode === "timed" ? "" : activeStopState.unit}`.trim()
    : "";

  return (
    <PageLayout title={lt("Train - Combo Logger")} mobileContentPaddingClass="p-0 pb-0">
      <section
        className="mx-0 flex min-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-2xl border"
        style={{
          borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
        }}
      >
        <div
          className="sticky top-0 z-10 border-b px-3 py-2.5"
          style={{
            borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
          }}
        >
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/train?trainMode=combo"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md"
              style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
              aria-label={lt("Back to train combo")}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
                {lt("Combo Workout Logger")}
              </h2>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {routine ? routine.routineName : lt("Select stops to log this combo routine.")}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          {message ? (
            <div
              className="mb-2 rounded-lg border px-3 py-2 text-[11px]"
              style={{
                borderColor: message.type === "success"
                  ? "color-mix(in srgb, var(--forest) 42%, transparent)"
                  : "color-mix(in srgb, var(--danger) 46%, transparent)",
                backgroundColor: message.type === "success"
                  ? "color-mix(in srgb, var(--forest) 10%, transparent)"
                  : "color-mix(in srgb, var(--danger) 10%, transparent)",
                color: message.type === "success" ? "var(--cloud-white)" : "var(--danger-hover)",
              }}
            >
              {message.text}
            </div>
          ) : null}

          {loading ? (
            <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              {lt("Loading combo routine...")}
            </p>
          ) : !routine ? (
            <div className="space-y-3 rounded-xl border px-3 py-3" style={{
              borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
            }}>
              <p className="text-sm" style={{ color: "var(--danger-hover)" }}>{lt("Combo routine not found.")}</p>
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard/train?trainMode=combo")}
                className="h-9 min-w-[78px] justify-center rounded-lg px-3"
                style={{
                  borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                  backgroundColor: "transparent",
                  color: "var(--mist-light)",
                }}
              >
                {lt("Back")}
              </GlowButton>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-row gap-2 sm:gap-3 overflow-hidden">
              <aside className="w-[56px] shrink-0 sm:w-[60px]">
                <div className="flex h-full min-h-0 flex-col items-center py-1">
                  <p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{lt("Stops")}</p>
                  <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
                    {routine.exercises.map((stop, index) => {
                      const isActive = index === activeStopIndex;
                      const stopKey = getStopKey(stop.exerciseId, index);
                      const isCompleted = Boolean(completedStops[stopKey]);
                      const isFlashing = flashingStopKey === stopKey;
                      return (
                        <button
                          key={`combo-stop-step-${routine.id}-${stop.exerciseId}-${index}`}
                          type="button"
                          onClick={() => setActiveStopIndex(index)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border text-center transition-all"
                          style={{
                            borderColor: isActive
                              ? "color-mix(in srgb, var(--accent) 56%, transparent)"
                              : isCompleted
                                ? "color-mix(in srgb, var(--gold) 58%, transparent)"
                              : "color-mix(in srgb, var(--border) 72%, transparent)",
                            backgroundColor: isActive
                              ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                              : isCompleted
                                ? "color-mix(in srgb, var(--gold) 14%, transparent)"
                              : "transparent",
                            color: isCompleted
                              ? "var(--gold)"
                              : isActive
                                ? "var(--text-primary)"
                                : "var(--text-muted)",
                            boxShadow: isFlashing
                              ? "0 0 0 2px color-mix(in srgb, var(--accent) 34%, transparent), 0 0 20px color-mix(in srgb, var(--accent) 44%, transparent)"
                              : isActive
                              ? "0 0 14px color-mix(in srgb, var(--accent) 12%, transparent)"
                              : isCompleted
                                ? "0 0 14px color-mix(in srgb, var(--gold) 18%, transparent)"
                              : "none",
                            transform: isFlashing ? `scale(${STOP_FLASH_SCALE})` : "scale(1)",
                          }}
                          aria-label={`${index + 1}. ${stop.name}`}
                          title={`${index + 1}. ${stop.name}`}
                        >
                          <span className="text-[10px] font-semibold">{index + 1}</span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setActiveStopIndex(summaryStepIndex)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border text-center transition-all"
                      style={{
                        borderColor: isSummaryStep
                          ? "color-mix(in srgb, var(--accent) 56%, transparent)"
                          : allStopsComplete
                            ? "color-mix(in srgb, var(--gold) 58%, transparent)"
                            : "color-mix(in srgb, var(--border) 72%, transparent)",
                        backgroundColor: isSummaryStep
                          ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                          : allStopsComplete
                            ? "color-mix(in srgb, var(--gold) 14%, transparent)"
                            : "transparent",
                        color: allStopsComplete
                          ? "var(--gold)"
                          : isSummaryStep
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        boxShadow: isSummaryStep
                          ? "0 0 14px color-mix(in srgb, var(--accent) 12%, transparent)"
                          : allStopsComplete
                            ? "0 0 14px color-mix(in srgb, var(--gold) 18%, transparent)"
                            : "none",
                      }}
                      aria-label={lt("Summary")}
                      title={lt("Summary")}
                    >
                      <span className="text-[10px] font-semibold">{summaryStepIndex + 1}</span>
                    </button>
                  </div>
                </div>
              </aside>

              <div className="min-w-0 flex min-h-0 flex-1 flex-col rounded-xl border px-2 py-2" style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
                boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
              }}>
                {isSummaryStep && routine ? (
                  <div className="min-h-0 flex flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                      <section
                        className="rounded-xl border px-3 py-3"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
                          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                        }}
                      >
                        <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Summary")}</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--text-primary)" }}>{routine.routineName}</p>
                        <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          {`${Object.values(completedStops).filter(Boolean).length}/${routine.exercises.length} ${lt("stops completed")}`}
                        </p>
                      </section>

                      <section
                        className="rounded-xl border px-3 py-3"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
                          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                        }}
                      >
                        <div className="space-y-2">
                          {routine.exercises.map((stop, index) => {
                            const stopKey = getStopKey(stop.exerciseId, index);
                            const stopState = stopStates[stopKey] ?? createInitialStopState();
                            const firstSet = stopState.sets[0] ?? { value: "", reps: "" };
                            const done = Boolean(completedStops[stopKey]);
                            return (
                              <div
                                key={`combo-summary-stop-${stop.exerciseId}-${index}`}
                                className="rounded-lg border px-2.5 py-2"
                                style={{
                                  borderColor: done
                                    ? "color-mix(in srgb, var(--gold) 38%, transparent)"
                                    : "color-mix(in srgb, var(--border) 70%, transparent)",
                                  backgroundColor: done
                                    ? "color-mix(in srgb, var(--gold) 8%, transparent)"
                                    : "color-mix(in srgb, var(--surface) 88%, black)",
                                }}
                              >
                                <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>{`${index + 1}. ${stop.name}`}</p>
                                <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                                  {firstSet.value && firstSet.reps
                                    ? `${firstSet.value} ${stopState.valueMode === "timed" ? (stopState.unit === "minutes" ? lt("min") : lt("sec")) : stopState.unit} • ${firstSet.reps} ${lt("reps")}`
                                    : lt("First set incomplete")}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>

                    <div
                      className="mt-2 shrink-0 border-t pt-2"
                      style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 36%, transparent)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <GlowButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveStopIndex((prev) => Math.max(0, prev - 1))}
                          className="h-9 min-w-[78px] justify-center rounded-lg px-3"
                          style={{
                            borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                            backgroundColor: "transparent",
                            color: "var(--mist-light)",
                          }}
                        >
                          ← {lt("Back")}
                        </GlowButton>

                        <GlowButton
                          variant="jade"
                          size="sm"
                          onClick={() => void handleLogComboWorkout()}
                          disabled={saving || !allStopsComplete}
                          className={`h-9 min-w-[118px] justify-center rounded-lg px-3 ${saving || !allStopsComplete ? "pointer-events-none opacity-45" : ""}`}
                          style={{
                            borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-dark))",
                            color: "var(--text-primary)",
                          }}
                        >
                          {saving ? lt("Logging...") : lt("Log Combo")}
                        </GlowButton>
                      </div>
                    </div>
                  </div>
                ) : !activeStop || !activeStopState ? (
                  <p className="px-2 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {lt("No stops in this combo routine.")}
                  </p>
                ) : (
                  <div className="min-h-0 flex flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                      <div className="rounded-md px-2 py-2" style={{
                        borderTop: "1px solid color-mix(in srgb, var(--ink-light) 58%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
                      }}>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {`${activeStopIndex + 1}. ${activeStop.name}`}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          {`${lt("Progression")}: ${getProgressionLabel(activeStop.exerciseId, activeStop.progressionLevel)}`}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          {`${lt("Variant")}: ${activeStop.variant?.trim() || lt("Default")}`}
                        </p>
                      </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateStopState(activeStopIndex, (current) => ({
                            ...current,
                            valueMode: "weight",
                            unit: current.unit === "lbs" ? "lbs" : "kg",
                          }))}
                          className="h-10 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all"
                          style={{
                            borderColor: activeStopState.valueMode === "weight" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                            backgroundColor: activeStopState.valueMode === "weight" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                            color: activeStopState.valueMode === "weight" ? "var(--text-primary)" : "var(--text-secondary)",
                            boxShadow: activeStopState.valueMode === "weight" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                          }}
                        >
                          {lt("Weight")}
                        </button>

                        <button
                          type="button"
                          onClick={() => updateStopState(activeStopIndex, (current) => ({
                            ...current,
                            valueMode: "timed",
                            unit: current.unit === "minutes" ? "minutes" : "seconds",
                          }))}
                          className="h-10 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all"
                          style={{
                            borderColor: activeStopState.valueMode === "timed" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                            backgroundColor: activeStopState.valueMode === "timed" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                            color: activeStopState.valueMode === "timed" ? "var(--text-primary)" : "var(--text-secondary)",
                            boxShadow: activeStopState.valueMode === "timed" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                          }}
                        >
                          {lt("Timed")}
                        </button>

                        {activeStopState.valueMode === "timed" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateStopState(activeStopIndex, (current) => ({ ...current, unit: "seconds" }))}
                              className="h-10 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all"
                              style={{
                                borderColor: activeStopState.unit === "seconds" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                backgroundColor: activeStopState.unit === "seconds" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                color: activeStopState.unit === "seconds" ? "var(--text-primary)" : "var(--text-secondary)",
                                boxShadow: activeStopState.unit === "seconds" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                              }}
                            >
                              {lt("Seconds")}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStopState(activeStopIndex, (current) => ({ ...current, unit: "minutes" }))}
                              className="h-10 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all"
                              style={{
                                borderColor: activeStopState.unit === "minutes" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                backgroundColor: activeStopState.unit === "minutes" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                color: activeStopState.unit === "minutes" ? "var(--text-primary)" : "var(--text-secondary)",
                                boxShadow: activeStopState.unit === "minutes" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                              }}
                            >
                              {lt("Minutes")}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => updateStopState(activeStopIndex, (current) => ({ ...current, unit: "kg" }))}
                              className="h-10 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all"
                              style={{
                                borderColor: activeStopState.unit === "kg" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                backgroundColor: activeStopState.unit === "kg" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                color: activeStopState.unit === "kg" ? "var(--text-primary)" : "var(--text-secondary)",
                                boxShadow: activeStopState.unit === "kg" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                              }}
                            >
                              {lt("Kg")}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStopState(activeStopIndex, (current) => ({ ...current, unit: "lbs" }))}
                              className="h-10 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all"
                              style={{
                                borderColor: activeStopState.unit === "lbs" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                backgroundColor: activeStopState.unit === "lbs" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                color: activeStopState.unit === "lbs" ? "var(--text-primary)" : "var(--text-secondary)",
                                boxShadow: activeStopState.unit === "lbs" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                              }}
                            >
                              {lt("Lbs")}
                            </button>
                          </>
                        )}
                    </div>

                    <section
                      className="rounded-xl border px-3 py-3"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
                        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => updateStopState(activeStopIndex, (current) => ({
                          ...current,
                          collapsed: { ...current.collapsed, modifier: !current.collapsed.modifier },
                        }))}
                        className="flex w-full items-start justify-between gap-2 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{lt("Modifier")}</p>
                          <p className="mt-1 text-[10px] text-[color:var(--text-secondary)]">{lt("Using weighted reps or a resistance band?")} {lt("Expand to set the modifier value.")}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className="min-w-[84px] rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold"
                            style={{
                              borderColor: Number(activeStopState.modifier || "0") === 0 ? "color-mix(in srgb, var(--accent) 36%, transparent)" : "color-mix(in srgb, var(--danger) 56%, transparent)",
                              backgroundColor: Number(activeStopState.modifier || "0") === 0 ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "color-mix(in srgb, var(--danger) 14%, transparent)",
                              color: Number(activeStopState.modifier || "0") === 0 ? "var(--text-muted)" : "var(--danger-hover)",
                            }}
                          >
                            {Number(activeStopState.modifier || "0") === 0 ? lt("None") : modifierLabel}
                          </span>
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px]"
                            style={{
                              borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                              color: "var(--text-muted)",
                              backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                            }}
                          >
                            {activeStopState.collapsed.modifier ? "+" : "−"}
                          </span>
                        </div>
                      </button>

                      {!activeStopState.collapsed.modifier ? (
                        <div className="mt-3 rounded-xl px-2.5 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                          <input
                            type="range"
                            min={String(MODIFIER_MIN)}
                            max={String(MODIFIER_MAX)}
                            step={String(MODIFIER_STEP)}
                            value={activeStopState.modifier}
                            onChange={(event) => updateStopState(activeStopIndex, (current) => ({ ...current, modifier: event.target.value }))}
                            className="h-1.5 w-full cursor-pointer accent-[var(--jade-glow)]"
                            aria-label={lt("Weight modifier slider")}
                          />
                          <div className="mt-2 flex items-center justify-between text-[9px] text-[color:var(--text-muted)]">
                            <span>-50</span>
                            <span>0</span>
                            <span>+50</span>
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section
                      className="rounded-xl border px-3 py-3"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
                        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Sets")}</p>

                      <div className="mt-3 space-y-2.5">
                        {activeStopState.sets.map((setRow, setIndex) => {
                          const hasSummaryValues = Boolean(setRow.value || setRow.reps);
                          const isLastRow = setIndex === activeStopState.sets.length - 1;
                          const ready = Boolean(setRow.value.trim() && setRow.reps.trim());

                          return (
                          <div
                            key={`combo-set-row-${activeStopIndex}-${setIndex}`}
                            className="rounded-xl border px-3 py-3 transition-all duration-700"
                            style={{
                              borderColor: "color-mix(in srgb, var(--border) 76%, transparent)",
                              background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid)), color-mix(in srgb, var(--ink-mid) 92%, black))",
                              boxShadow: hasSummaryValues
                                ? "0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent)"
                                : "none",
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-[color:var(--text-primary)]"
                                style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 24%, transparent)" }}
                              >
                                {lt("Set")} {setIndex + 1}
                              </span>

                              <div className="flex items-center gap-2">
                                {isLastRow ? (
                                  <>
                                    {activeStopState.sets.length > 1 ? (
                                      <button
                                        type="button"
                                        onClick={() => removeSetRow(activeStopIndex, setIndex)}
                                        className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all"
                                        style={{
                                          borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                                          backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                                          color: "var(--text-secondary)",
                                          opacity: 0.96,
                                          boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                                        }}
                                      >
                                        {lt("Remove")}
                                      </button>
                                    ) : null}
                                    <GlowButton
                                      variant="jade"
                                      size="sm"
                                      onClick={() => addSetRow(activeStopIndex)}
                                      className="h-7 rounded-full px-3 text-[10px] transition-all"
                                      style={
                                        ready
                                          ? {
                                              boxShadow:
                                                "0 0 0 1px color-mix(in srgb, var(--jade-glow) 72%, transparent) inset, 0 0 14px color-mix(in srgb, var(--jade-glow) 55%, transparent), 0 0 26px color-mix(in srgb, var(--jade-glow) 32%, transparent)",
                                            }
                                          : { boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent) inset" }
                                      }
                                    >
                                      + {lt("Add Set")}
                                    </GlowButton>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => removeSetRow(activeStopIndex, setIndex)}
                                    className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                                      color: "var(--text-secondary)",
                                      opacity: 0.96,
                                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                                    }}
                                  >
                                    {lt("Remove")}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                                  {activeStopState.valueMode === "timed" ? (activeStopState.unit === "minutes" ? lt("Minutes") : lt("Seconds")) : lt("Weight")}
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step={String(activeStopState.valueMode === "timed" ? TIMED_VALUE_STEP : WEIGHT_VALUE_STEP)}
                                  value={setRow.value}
                                  onChange={(event) => updateStopState(activeStopIndex, (current) => ({
                                    ...current,
                                    sets: current.sets.map((row, rowIndex) => rowIndex === setIndex ? { ...row, value: event.target.value } : row),
                                  }))}
                                  placeholder={activeStopState.valueMode === "timed" ? lt("Time") : lt("Weight")}
                                  className="h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none"
                                  style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--col-weight)" }}
                                />
                              </label>

                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{lt("Reps")}</span>
                                <input
                                  type="number"
                                  min="0"
                                  step={String(REPS_STEP)}
                                  value={setRow.reps}
                                  onChange={(event) => updateStopState(activeStopIndex, (current) => ({
                                    ...current,
                                    sets: current.sets.map((row, rowIndex) => rowIndex === setIndex ? { ...row, reps: event.target.value } : row),
                                  }))}
                                  placeholder={lt("Reps")}
                                  className="h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none"
                                  style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--col-reps)" }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                        })}

                      </div>
                    </section>
                    </div>

                    <div
                      className="mt-2 shrink-0 border-t pt-2"
                      style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 36%, transparent)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <GlowButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveStopIndex((prev) => Math.max(0, prev - 1))}
                          disabled={activeStopIndex <= 0}
                          className={`h-9 min-w-[78px] justify-center rounded-lg px-3 ${activeStopIndex <= 0 ? "pointer-events-none opacity-45" : ""}`}
                          style={{
                            borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                            backgroundColor: "transparent",
                            color: "var(--mist-light)",
                          }}
                        >
                          ← {lt("Back")}
                        </GlowButton>

                        <GlowButton
                          variant="jade"
                          size="sm"
                          onClick={goToNextStop}
                          disabled={activeStopIndex >= (routine?.exercises.length ?? 0)}
                          className={`h-9 min-w-[78px] justify-center rounded-lg px-3 ${activeStopIndex >= (routine?.exercises.length ?? 0) ? "pointer-events-none opacity-45" : ""}`}
                          style={{
                            borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-dark))",
                            color: "var(--text-primary)",
                          }}
                        >
                          {lt("Next")} →
                        </GlowButton>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
