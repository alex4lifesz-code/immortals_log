"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import SearchField from "@/components/ui/SearchField";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api, ApiRequestError } from "@/lib/api-client";
import { getTodayInTimeZone } from "@/lib/constants";
import { translateEnglishToLanguage } from "@/lib/language";
import { normalizeTrainComboLogs, type TrainComboLog } from "@/lib/train-combo";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";

type ComboStop = {
  exerciseId: string;
  name: string;
  progressionLevel: number;
  variant: string;
  isCollapsed: boolean;
};

type ComboPanelId = "routine" | "stops" | "notes" | "review";

const COMBO_PANELS: Array<{ id: ComboPanelId; label: string; description: string }> = [
  { id: "routine", label: "Routine", description: "Name and date" },
  { id: "stops", label: "Stops", description: "Add exercises" },
  { id: "notes", label: "Notes", description: "Instructional notes" },
  { id: "review", label: "Review", description: "Check and save" },
];

export default function TrainComboInputPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = user?.id ?? "";
  const manageMode = searchParams.get("manage") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stopCategoryFilter, setStopCategoryFilter] = useState("all");
  const [stopSort, setStopSort] = useState<"recent" | "name-az" | "category">("recent");
  const [routineName, setRoutineName] = useState("");
  const [trainingDate, setTrainingDate] = useState(getTodayInTimeZone(settings.timeZone));
  const [notes, setNotes] = useState("");
  const [stops, setStops] = useState<ComboStop[]>([]);
  const [activePanel, setActivePanel] = useState<ComboPanelId>("routine");
  const [confirmedPanels, setConfirmedPanels] = useState<ComboPanelId[]>([]);
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [comboRoutines, setComboRoutines] = useState<TrainComboLog[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState("");

  const fetchExercises = useCallback(async () => {
    if (!userId) {
      setExercises([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions/history?logLimit=1&exerciseLimit=5000");
      setExercises(Array.isArray(payload.exercises) ? payload.exercises : []);
    } catch (error) {
      console.error("Failed to load exercises for combo input:", error);
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchExercises();
  }, [fetchExercises]);

  const fetchComboRoutines = useCallback(async () => {
    if (!userId) {
      setComboRoutines([]);
      return;
    }

    try {
      const payload = await api.get<{ routines?: unknown }>("/api/train-combo", { cache: "no-store" });
      setComboRoutines(normalizeTrainComboLogs(payload.routines));
    } catch (error) {
      console.error("Failed to load combo routines:", error);
      setComboRoutines([]);
    }
  }, [userId]);

  useEffect(() => {
    void fetchComboRoutines();
  }, [fetchComboRoutines]);

  useEffect(() => {
    if (!message || message.type !== "success") return;
    const timeoutId = window.setTimeout(() => {
      setMessage((current) => (current?.type === "success" ? null : current));
    }, 3200);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const stopCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(exercises.map((exercise) => (exercise.category || "Other").trim() || "Other")));
    categories.sort((left, right) => left.localeCompare(right));
    return ["all", ...categories];
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = exercises.filter((exercise) => {
      const category = (exercise.category || "Other").trim() || "Other";
      const matchesCategory = stopCategoryFilter === "all" || category === stopCategoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;

      const haystack = [exercise.name, exercise.englishName, exercise.vietnameseName, exercise.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered];
    if (stopSort === "name-az") {
      sorted.sort((left, right) => left.name.localeCompare(right.name));
    } else if (stopSort === "category") {
      sorted.sort((left, right) => {
        const leftCategory = (left.category || "Other").trim() || "Other";
        const rightCategory = (right.category || "Other").trim() || "Other";
        const categoryCompare = leftCategory.localeCompare(rightCategory);
        if (categoryCompare !== 0) return categoryCompare;
        return left.name.localeCompare(right.name);
      });
    } else {
      sorted.sort((left, right) => {
        const leftLatest = left.userProgress?.[0]?.logs?.[0]?.createdAt
          ? new Date(left.userProgress[0].logs[0].createdAt).getTime()
          : Number.NEGATIVE_INFINITY;
        const rightLatest = right.userProgress?.[0]?.logs?.[0]?.createdAt
          ? new Date(right.userProgress[0].logs[0].createdAt).getTime()
          : Number.NEGATIVE_INFINITY;
        if (rightLatest !== leftLatest) return rightLatest - leftLatest;
        return left.name.localeCompare(right.name);
      });
    }

    return sorted;
  }, [exercises, searchTerm, stopCategoryFilter, stopSort]);

  const exerciseById = useMemo(() => {
    return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  const getStopProgressionLabel = (stop: ComboStop): string => {
    const parentExercise = exerciseById.get(stop.exerciseId);
    const tiers = parentExercise?.tiers ?? [];
    return tiers.find((tier) => tier.level === stop.progressionLevel)?.name
      || `${lt("Progression")} ${stop.progressionLevel}`;
  };

  const getStopVariantLabel = (stop: ComboStop): string => {
    return stop.variant.trim() || lt("Default");
  };

  const getDefaultProgressionLevel = (exercise: ProgressionExercise): number => {
    const currentLevel = exercise.userProgress?.[0]?.currentLevel;
    if (typeof currentLevel === "number" && Number.isFinite(currentLevel) && currentLevel > 0) {
      return Math.max(1, Math.trunc(currentLevel));
    }
    const firstTierLevel = exercise.tiers?.[0]?.level;
    if (typeof firstTierLevel === "number" && Number.isFinite(firstTierLevel) && firstTierLevel > 0) {
      return Math.max(1, Math.trunc(firstTierLevel));
    }
    return 1;
  };

  const addStop = (exercise: ProgressionExercise) => {
    setStops((prev) => [
      ...prev.map((stop) => ({ ...stop, isCollapsed: true })),
      {
        exerciseId: exercise.id,
        name: exercise.name,
        progressionLevel: getDefaultProgressionLevel(exercise),
        variant: "",
        isCollapsed: false,
      },
    ]);
    setIsExercisePickerOpen(false);
    setMessage({ type: "success", text: `${exercise.name} ${lt("added to route")}.` });
    if (!routineName.trim()) {
      setRoutineName(`${exercise.name} ${lt("Combo")}`);
    }
  };

  const removeStop = (indexToRemove: number) => {
    setStops((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const updateStopProgressionLevel = (indexToUpdate: number, levelValue: string) => {
    const numeric = Number.parseInt(levelValue, 10);
    const nextLevel = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    setStops((prev) => prev.map((stop, index) => (index === indexToUpdate
      ? { ...stop, progressionLevel: nextLevel }
      : stop)));
  };

  const updateStopVariant = (indexToUpdate: number, variant: string) => {
    setStops((prev) => prev.map((stop, index) => (index === indexToUpdate
      ? { ...stop, variant }
      : stop)));
  };

  const toggleStopCollapsed = (indexToUpdate: number) => {
    setStops((prev) => prev.map((stop, index) => (index === indexToUpdate
      ? { ...stop, isCollapsed: !stop.isCollapsed }
      : stop)));
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    setStops((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const clearRoutineForm = useCallback(() => {
    setRoutineName("");
    setTrainingDate(getTodayInTimeZone(settings.timeZone));
    setNotes("");
    setStops([]);
    setActivePanel("routine");
    setConfirmedPanels([]);
    setMessage(null);
  }, [settings.timeZone]);

  const loadRoutineIntoForm = useCallback((routine: TrainComboLog) => {
    setRoutineName(routine.routineName || "");
    setTrainingDate(routine.trainingDate || getTodayInTimeZone(settings.timeZone));
    setNotes(routine.notes || "");
    setStops(
      routine.exercises.map((stop) => ({
        exerciseId: stop.exerciseId,
        name: stop.name,
        progressionLevel: typeof stop.progressionLevel === "number" ? stop.progressionLevel : 1,
        variant: stop.variant || "",
        isCollapsed: true,
      })),
    );
    setActivePanel("routine");
    setConfirmedPanels([]);
    setMessage(null);
  }, [settings.timeZone]);

  const handleDeleteRoutine = async () => {
    if (!selectedRoutineId || saving) return;
    const selectedRoutine = comboRoutines.find((routine) => routine.id === selectedRoutineId);
    const confirmMessage = selectedRoutine
      ? `${lt("Delete combo routine")}: ${selectedRoutine.routineName}?`
      : lt("Delete this combo routine?");
    if (typeof window !== "undefined" && !window.confirm(confirmMessage)) return;

    setSaving(true);
    setMessage(null);
    try {
      await api.delete(`/api/train-combo?id=${encodeURIComponent(selectedRoutineId)}`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("train-combo-logs-updated"));
      }

      setComboRoutines((prev) => prev.filter((routine) => routine.id !== selectedRoutineId));
      setSelectedRoutineId("");
      setRoutineName("");
      setTrainingDate(getTodayInTimeZone(settings.timeZone));
      setNotes("");
      setStops([]);
      setActivePanel("routine");
      setConfirmedPanels([]);
      clearRoutineForm();
      setMessage({ type: "success", text: lt("Combo routine deleted.") });
    } catch (error) {
      console.error("Failed to delete combo routine:", error);
      setMessage({
        type: "error",
        text: error instanceof ApiRequestError ? error.message : lt("Failed to delete combo routine."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCombo = async () => {
    if (saving) return;

    if (routineName.trim().length < 2) {
      setMessage({ type: "error", text: lt("Enter a routine name first.") });
      return;
    }
    if (stops.length === 0) {
      setMessage({ type: "error", text: lt("Add at least one exercise to the routine.") });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        routineName: routineName.trim(),
        trainingDate,
        notes: notes.trim() || null,
        exercises: stops.map((stop) => ({
          exerciseId: stop.exerciseId,
          name: stop.name,
          progressionLevel: stop.progressionLevel,
          variant: stop.variant,
        })),
      };

      if (manageMode && selectedRoutineId) {
        await api.put("/api/train-combo", { id: selectedRoutineId, ...payload });
      } else {
        await api.post("/api/train-combo", payload);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("train-combo-logs-updated"));
      }

      router.push("/dashboard/train?trainMode=combo");
    } catch (error) {
      console.error("Failed to save combo routine:", error);
      setMessage({
        type: "error",
        text: error instanceof ApiRequestError ? error.message : lt("Failed to save combo routine."),
      });
    } finally {
      setSaving(false);
    }
  };

  const activePanelIndex = COMBO_PANELS.findIndex((panel) => panel.id === activePanel);
  const hasRoutineInfo = routineName.trim().length >= 2 && Boolean(trainingDate);
  const hasStops = stops.length > 0;
  const completionByPanel: Record<ComboPanelId, boolean> = {
    routine: confirmedPanels.includes("routine") && hasRoutineInfo,
    stops: confirmedPanels.includes("stops") && hasStops,
    notes: confirmedPanels.includes("notes"),
    review: confirmedPanels.includes("review") && hasRoutineInfo && hasStops,
  };
  const completedPanelCount = COMBO_PANELS.filter((panel) => completionByPanel[panel.id]).length;
  const panelShellStyle = {
    minHeight: 0,
    height: "100%",
    flex: 1,
    border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)",
    borderRadius: "1rem",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
    boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
  };

  const goToNextPanel = () => {
    if (activePanel === "routine" && !hasRoutineInfo) {
      setMessage({ type: "error", text: lt("Enter a routine name first.") });
      return;
    }
    if (activePanel === "stops" && !hasStops) {
      setMessage({ type: "error", text: lt("Add at least one exercise to the routine.") });
      return;
    }

    setMessage(null);
    setConfirmedPanels((prev) => {
      if (prev.includes(activePanel)) return prev;
      return [...prev, activePanel];
    });

    if (activePanelIndex >= COMBO_PANELS.length - 1) return;
    setActivePanel(COMBO_PANELS[activePanelIndex + 1]?.id ?? "review");
  };

  const goToPreviousPanel = () => {
    if (activePanelIndex <= 0) {
      return;
    }
    setMessage(null);
    setActivePanel(COMBO_PANELS[activePanelIndex - 1]?.id ?? "routine");
  };

  return (
    <PageLayout title={lt("Train - Combo")} mobileContentPaddingClass="p-0 pb-0">
      <section className="mx-0 flex min-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-2xl border" style={{
        borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
      }}>
        <div className="sticky top-0 z-10 border-b px-3 py-2.5" style={{
          borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
        }}>
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
                {manageMode ? lt("Edit Combo Routine") : lt("Build Combo Routine")}
              </h2>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {manageMode
                  ? lt("Select a routine, delete it, or continue to edit and save.")
                  : lt("Add or remove exercises like route stops, then save one combo log.")}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-2 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          <div className="flex min-h-0 flex-1 flex-row gap-2 sm:gap-3 overflow-hidden">
            <aside className="w-[56px] shrink-0 sm:w-[60px]">
              <div className="flex h-full min-h-0 flex-col items-center py-1">
                <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{lt("Steps")}</p>
                <p className="mb-2 text-[9px] text-[color:var(--text-muted)]">{`${completedPanelCount}/${COMBO_PANELS.length}`}</p>

                <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
                  {COMBO_PANELS.map((panel, index) => {
                    const isActive = panel.id === activePanel;
                    const isComplete = completionByPanel[panel.id];
                    return (
                      <button
                        key={panel.id}
                        type="button"
                        onClick={() => setActivePanel(panel.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border text-center transition-all"
                        style={{
                          borderColor: isComplete
                            ? "color-mix(in srgb, var(--gold) 58%, transparent)"
                            : isActive
                              ? "color-mix(in srgb, var(--accent) 56%, transparent)"
                              : "color-mix(in srgb, var(--border) 72%, transparent)",
                          backgroundColor: isComplete
                            ? "color-mix(in srgb, var(--gold) 14%, transparent)"
                            : isActive
                              ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                              : "transparent",
                          color: isComplete
                            ? "var(--gold)"
                            : isActive
                              ? "var(--text-primary)"
                              : "var(--text-muted)",
                          boxShadow: isComplete
                            ? "0 0 14px color-mix(in srgb, var(--gold) 18%, transparent)"
                            : isActive
                              ? "0 0 14px color-mix(in srgb, var(--accent) 12%, transparent)"
                              : "none",
                        }}
                        aria-label={lt(panel.label)}
                        title={`${index + 1}. ${lt(panel.label)}`}
                      >
                        <span className="text-[10px] font-semibold">{index + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex min-h-0 flex-1 flex-col px-1 py-1" style={panelShellStyle}>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">

            {activePanel === "routine" ? (
              <div className="space-y-3">
                {manageMode ? (
                  <div className="rounded-xl border p-2" style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 58%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
                  }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                        {lt("Edit existing combo")}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleDeleteRoutine()}
                        disabled={!selectedRoutineId || saving}
                        className={`h-7 rounded-md border px-2 text-xs ${!selectedRoutineId || saving ? "opacity-50" : ""}`}
                        style={{
                          borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
                          color: "var(--danger-hover)",
                          backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
                        }}
                      >
                        {lt("Delete")}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <select
                        value={selectedRoutineId}
                        onChange={(event) => {
                          const routineId = event.target.value;
                          setSelectedRoutineId(routineId);
                          if (!routineId) {
                            clearRoutineForm();
                            return;
                          }
                          const selectedRoutine = comboRoutines.find((routine) => routine.id === routineId);
                          if (selectedRoutine) {
                            loadRoutineIntoForm(selectedRoutine);
                          }
                        }}
                        className="h-9 w-full rounded-md border px-2 text-xs outline-none"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 60%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                        aria-label={lt("Select combo routine")}
                      >
                        <option value="">{lt("Choose a combo routine")}</option>
                        {comboRoutines.map((routine) => (
                          <option key={`manage-combo-${routine.id}`} value={routine.id}>{routine.routineName}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedRoutineId) return;
                          setActivePanel("stops");
                        }}
                        disabled={!selectedRoutineId}
                        className={`h-8 rounded-md border px-2 text-xs font-semibold ${!selectedRoutineId ? "opacity-50" : ""}`}
                        style={{
                          borderColor: "color-mix(in srgb, var(--forest) 42%, transparent)",
                          color: "var(--forest)",
                          backgroundColor: "color-mix(in srgb, var(--forest) 12%, var(--ink-deep))",
                        }}
                      >
                        {lt("Continue to Edit")}
                      </button>
                    </div>
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                    {lt("Created Date")}
                  </span>
                  <input
                    type="date"
                    value={trainingDate}
                    onChange={(event) => setTrainingDate(event.target.value)}
                    className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                      color: "var(--cloud-white)",
                    }}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                    {lt("Routine name")}
                  </span>
                  <input
                    value={routineName}
                    onChange={(event) => setRoutineName(event.target.value)}
                    placeholder={lt("e.g. Pull + Push + Legs")}
                    className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                      color: "var(--cloud-white)",
                    }}
                  />
                </label>
              </div>
            ) : null}

            {activePanel === "stops" ? (
              <>
                <div className={stops.length === 0 ? "rounded-xl border p-2" : "p-1"} style={stops.length === 0 ? {
                  borderColor: "color-mix(in srgb, var(--forest) 34%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--forest) 7%, var(--ink-deep))",
                } : undefined}>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                      {lt("Route stops")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsExercisePickerOpen(true)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold"
                      style={{
                        borderColor: "color-mix(in srgb, var(--forest) 42%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--forest) 16%, var(--ink-deep))",
                        color: "var(--forest)",
                      }}
                      aria-label={lt("Add exercises")}
                      title={lt("Add exercises")}
                    >
                      +
                    </button>
                  </div>
                  {stops.length === 0 ? (
                    <p className="px-1 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      {lt("No exercises added yet.")}
                    </p>
                  ) : (
                    <div className="mt-1 space-y-2">
                      {stops.map((stop, index) => (
                        <article
                          key={`${stop.exerciseId}-${index}`}
                          className="rounded-md px-2 py-1.5"
                          style={{
                            borderTop: "1px solid color-mix(in srgb, var(--ink-light) 58%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleStopCollapsed(index)}
                              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
                              style={{
                                backgroundColor: "transparent",
                                color: "var(--text-primary)",
                              }}
                              aria-label={stop.isCollapsed ? lt("Expand route stop") : lt("Collapse route stop")}
                            >
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{
                                backgroundColor: "color-mix(in srgb, var(--forest) 30%, transparent)",
                                color: "var(--forest)",
                              }}>
                                {index + 1}
                              </span>
                              <p className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text-primary)" }}>
                                {stop.name}
                              </p>
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]" style={{
                                border: "1px solid color-mix(in srgb, var(--ink-light) 62%, transparent)",
                                color: "var(--text-muted)",
                              }}>
                                {stop.isCollapsed ? "+" : "-"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStop(index, -1)}
                              disabled={index === 0}
                              className="h-7 w-7 rounded-md border text-xs"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 60%, transparent)",
                                color: "var(--text-secondary)",
                                opacity: index === 0 ? 0.45 : 1,
                              }}
                              aria-label={lt("Move up")}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStop(index, 1)}
                              disabled={index === stops.length - 1}
                              className="h-7 w-7 rounded-md border text-xs"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 60%, transparent)",
                                color: "var(--text-secondary)",
                                opacity: index === stops.length - 1 ? 0.45 : 1,
                              }}
                              aria-label={lt("Move down")}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStop(index)}
                              className="h-7 rounded-md border px-2 text-xs"
                              style={{
                                borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
                                color: "var(--danger-hover)",
                                backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
                              }}
                            >
                              {lt("Remove")}
                            </button>
                          </div>

                          {(() => {
                            const parentExercise = exerciseById.get(stop.exerciseId);
                            const tiers = parentExercise?.tiers ?? [];
                            const variations = parentExercise?.variations ?? [];
                            const progressionLabel = getStopProgressionLabel(stop);
                            const variantLabel = getStopVariantLabel(stop);

                            if (stop.isCollapsed) {
                              return (
                                <div className="mt-2 space-y-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                  <p>{`${lt("Progression")}: ${progressionLabel}`}</p>
                                  <p>{`${lt("Variant")}: ${variantLabel}`}</p>
                                </div>
                              );
                            }

                            return (
                              <div className="mt-2 space-y-2">
                                <div className="space-y-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                  <p>{`${lt("Progression")}: ${progressionLabel}`}</p>
                                  <p>{`${lt("Variant")}: ${variantLabel}`}</p>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="block">
                                    <span className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                                      {lt("Progression")}
                                    </span>
                                    <select
                                      value={String(stop.progressionLevel)}
                                      onChange={(event) => updateStopProgressionLevel(index, event.target.value)}
                                      className="h-8 w-full rounded-md border px-2 text-xs outline-none"
                                      style={{
                                        borderColor: "color-mix(in srgb, var(--ink-light) 60%, transparent)",
                                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                        color: "var(--cloud-white)",
                                      }}
                                      aria-label={lt("Progression")}
                                    >
                                      {tiers.length > 0 ? tiers.map((tier) => (
                                        <option key={`${stop.exerciseId}-tier-${tier.level}`} value={String(tier.level)}>
                                          {tier.name}
                                        </option>
                                      )) : (
                                        <option value={String(stop.progressionLevel)}>{`${lt("Progression")} ${stop.progressionLevel}`}</option>
                                      )}
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                                      {lt("Variant")}
                                    </span>
                                    <select
                                      value={stop.variant}
                                      onChange={(event) => updateStopVariant(index, event.target.value)}
                                      className="h-8 w-full rounded-md border px-2 text-xs outline-none"
                                      style={{
                                        borderColor: "color-mix(in srgb, var(--ink-light) 60%, transparent)",
                                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                        color: "var(--cloud-white)",
                                      }}
                                      aria-label={lt("Variant")}
                                    >
                                      <option value="">{lt("Default")}</option>
                                      {variations.map((variation) => (
                                        <option key={`${stop.exerciseId}-variation-${variation.id}`} value={variation.name}>
                                          {variation.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              </div>
                            );
                          })()}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {activePanel === "notes" ? (
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                  {lt("Notes")}
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={6}
                  placeholder={lt("Instructional notes for this routine")}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                    color: "var(--cloud-white)",
                  }}
                />
              </label>
            ) : null}

            {activePanel === "review" ? (
              <div className="space-y-2 rounded-xl border p-3" style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 52%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
              }}>
                <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{lt("Review")}</p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{lt("Routine")}: </span>{routineName || "-"}
                </p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{lt("Created Date")}: </span>{trainingDate || "-"}
                </p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{lt("Stops")}: </span>{stops.length}
                </p>
                {stops.length > 0 ? (
                  <div className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {stops.map((stop, index) => (
                      <div key={`review-stop-${stop.exerciseId}-${index}`} className="space-y-0.5">
                        <p style={{ color: "var(--text-primary)" }}>{`${index + 1}. ${stop.name}`}</p>
                        <p>{`${lt("Progression")}: ${getStopProgressionLabel(stop)}`}</p>
                        <p>{`${lt("Variant")}: ${getStopVariantLabel(stop)}`}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{lt("Notes")}: </span>{notes.trim() || lt("None")}
                </p>
              </div>
            ) : null}

                <AnimatePresence mode="wait">
                  {message ? (
                    <motion.p
                      key={`${message.type}:${message.text}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="text-xs"
                      style={{ color: message.type === "success" ? "var(--forest)" : "var(--danger-hover)" }}
                    >
                      {message.text}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>

            </div>
          </div>
        </div>

        <div
          className="shrink-0 border-t px-3 py-2 safe-area-bottom"
          style={{
            "--safe-area-bottom-offset": "0.5rem",
            borderTopColor: "color-mix(in srgb, var(--ink-light) 36%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, transparent)",
          } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-[56px] shrink-0 sm:w-[60px]" aria-hidden />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={goToPreviousPanel}
                disabled={activePanelIndex <= 0}
                className={`h-9 min-w-[78px] justify-center rounded-lg px-3 ${activePanelIndex <= 0 ? "pointer-events-none opacity-45" : ""}`}
                style={{
                  borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                  backgroundColor: "transparent",
                  color: "var(--mist-light)",
                }}
              >
                ← {lt("Back")}
              </GlowButton>

              {activePanel === "review" ? (
                <GlowButton
                  variant="jade"
                  size="sm"
                  onClick={() => void handleSaveCombo()}
                  disabled={saving}
                  className="h-9 min-w-[78px] justify-center rounded-lg px-3"
                  style={{
                    borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-dark))",
                    color: "var(--text-primary)",
                  }}
                >
                  {saving ? lt("Saving...") : (manageMode && selectedRoutineId ? lt("Save Changes") : lt("Save Combo"))}
                </GlowButton>
              ) : (
                <GlowButton
                  variant="jade"
                  size="sm"
                  onClick={goToNextPanel}
                  className="h-9 min-w-[78px] justify-center rounded-lg px-3"
                  style={{
                    borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-dark))",
                    color: "var(--text-primary)",
                  }}
                >
                  {lt("Next")} →
                </GlowButton>
              )}
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {activePanel === "stops" && isExercisePickerOpen ? (
          <>
            <motion.div
              key="combo-exercise-picker-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[236]"
              style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
              onClick={() => setIsExercisePickerOpen(false)}
            />

            <motion.aside
              key="combo-exercise-picker-sheet"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 right-0 z-[238] rounded-t-3xl border-t border-x overflow-hidden safe-area-left safe-area-right safe-area-top safe-area-bottom"
              style={{
                left: "0px",
                top: "max(env(safe-area-inset-top,0px),0.5rem)",
                borderColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
              }}
            >
              <div className="h-full min-h-0 flex flex-col overflow-hidden">
                <div className="sticky top-0 z-10 border-b safe-area-top" style={{
                  "--safe-area-top-offset": "10px",
                  borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
                } as React.CSSProperties}>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                        {lt("Add exercises")}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setIsExercisePickerOpen(false)}
                        className="h-8 w-8 rounded-md border text-sm"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          color: "var(--mist-light)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                        }}
                        aria-label={lt("Close exercise picker")}
                      >
                        x
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 border-t" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                    <SearchField
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={lt("Search exercises")}
                      aria-label={lt("Search exercises")}
                      className="h-8 text-sm"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                      }}
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={stopCategoryFilter}
                        onChange={(event) => setStopCategoryFilter(event.target.value)}
                        className="h-8 rounded-md border px-2 text-xs outline-none"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                        aria-label={lt("Filter by category")}
                      >
                        {stopCategoryOptions.map((category) => (
                          <option key={`combo-stop-category-${category}`} value={category}>
                            {category === "all" ? lt("All categories") : category}
                          </option>
                        ))}
                      </select>
                      <select
                        value={stopSort}
                        onChange={(event) => setStopSort(event.target.value as "recent" | "name-az" | "category")}
                        className="h-8 rounded-md border px-2 text-xs outline-none"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                        aria-label={lt("Sort exercises")}
                      >
                        <option value="recent">{lt("Recent first")}</option>
                        <option value="name-az">{lt("Name A-Z")}</option>
                        <option value="category">{lt("Category")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  data-mobile-scroll-container="true"
                  className="min-h-0 flex-1 overflow-y-auto scrollbar-hide overflow-x-hidden px-2 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)]"
                  style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto", touchAction: "pan-y" }}
                >
                  {loading ? (
                    <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {lt("Loading exercises...")}
                    </p>
                  ) : filteredExercises.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {lt("No exercises match your search.")}
                    </p>
                  ) : (
                    filteredExercises.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => addStop(exercise)}
                        className="mx-1 my-0.5 block w-[calc(100%-0.5rem)] rounded-md px-3 py-2.5 text-left"
                        style={{
                          backgroundColor: "transparent",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                            {exercise.name}
                          </p>
                          <span className="shrink-0 text-[11px]" style={{ color: "var(--forest)" }}>
                            + {lt("Add")}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                          {(exercise.category || lt("Other")).trim() || lt("Other")}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </PageLayout>
  );
}
