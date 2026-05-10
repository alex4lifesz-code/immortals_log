"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { getDefaultExerciseDbOptions, type ExerciseDbOptions } from "@/lib/exercise-db-settings";
import { PROGRESSION_EXERCISES_UPDATED_EVENT } from "@/lib/progression-events";
import type {
  SimpleExercise,
  TrainingCategory,
  SimpleExerciseType,
  MuscleGroup,
} from "@/lib/exercise-types";
import {
  getCategoryIcon,
  getExerciseTypeIcon,
} from "@/lib/exercise-types";

type EditorPanelId = "identity" | "classification" | "structure" | "review";

const EDITOR_PANELS: Array<{ id: EditorPanelId; label: string; description: string }> = [
  { id: "identity", label: "Identity", description: "Exercise name" },
  { id: "classification", label: "Class", description: "Category and muscles" },
  { id: "structure", label: "Structure", description: "Progression and variants" },
  { id: "review", label: "Review", description: "Apply changes" },
];

function joinList(values: string[]): string {
  return values.join(", ") || "—";
}

function splitDraftLabels(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().slice(0, 200))
    .filter(Boolean);
}

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const userId = user?.id;
  const exerciseId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [exercise, setExercise] = useState<SimpleExercise | null>(null);
  const [dbOptions, setDbOptions] = useState<ExerciseDbOptions>(getDefaultExerciseDbOptions());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<TrainingCategory>("Gym");
  const [exerciseType, setExerciseType] = useState<SimpleExerciseType>("weighted");
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [progression, setProgression] = useState<string[]>([]);
  const [progressionDraft, setProgressionDraft] = useState("");
  const [variations, setVariations] = useState<string[]>([]);
  const [variationDraft, setVariationDraft] = useState("");
  const [activePanel, setActivePanel] = useState<EditorPanelId>("identity");
  const [confirmedPanels, setConfirmedPanels] = useState<EditorPanelId[]>([]);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  const resolveExerciseName = useCallback((item: SimpleExercise) => {
    return getExerciseDisplayName(
      {
        name: item.englishName || item.name,
        wuxiaName: item.vietnameseName || "",
        englishName: item.englishName,
        vietnameseName: item.vietnameseName,
      },
      settings.terminologyMode,
      settings.showExerciseForeignLanguage,
    );
  }, [settings.showExerciseForeignLanguage, settings.terminologyMode]);

  const displayName = useMemo(() => {
    if (!exercise) return "Exercise Editor";
    return resolveExerciseName(exercise);
  }, [exercise, resolveExerciseName]);

  useEffect(() => {
    if (!exercise) return;
    setName(exercise.name);
    setCategory(exercise.category);
    setExerciseType(exercise.exerciseType);
    setMuscleGroups(exercise.muscleGroups ?? []);
    setProgression((exercise.progression ?? []).filter(Boolean));
    setVariations((exercise.variations ?? []).map((variation) => variation.name).filter(Boolean));
  }, [exercise]);

  const loadExercise = useCallback(async () => {
    if (!userId || !exerciseId) return;

    setLoading(true);
    setError("");
    try {
      const [libraryData, optionsData] = await Promise.all([
        api.get<{ exercises?: SimpleExercise[] }>("/api/exercise-library"),
        api.get<{ options?: ExerciseDbOptions }>("/api/exercise-library/db-settings"),
      ]);

      if (optionsData.options) {
        setDbOptions(optionsData.options);
      }

      const found = (libraryData.exercises ?? []).find((item) => item.id === exerciseId) ?? null;
      setExercise(found);
      if (!found) {
        setError("Exercise not found.");
      }
    } catch (err) {
      console.error("Failed to load exercise details:", err);
      setError("Failed to load exercise details.");
    } finally {
      setLoading(false);
    }
  }, [exerciseId, userId]);

  useEffect(() => {
    void loadExercise();
  }, [loadExercise]);

  useEffect(() => {
    const step = searchParams.get("step");
    if (!step) return;
    if (EDITOR_PANELS.some((panel) => panel.id === step)) {
      setActivePanel(step as EditorPanelId);
    }
  }, [searchParams]);

  useEffect(() => {
    const field = searchParams.get("field");
    if (!field) {
      setHighlightedField(null);
      return;
    }

    setHighlightedField(field);

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`editor-field-${field}`);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    const timeout = window.setTimeout(() => {
      setHighlightedField((current) => (current === field ? null : current));
    }, 2600);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [activePanel, searchParams]);

  const isFocusedField = (field: string) => highlightedField === field;
  const getEditorFieldStyle = (field: string) => ({
    scrollMarginTop: "5.5rem",
    borderColor: isFocusedField(field)
      ? "color-mix(in srgb, var(--forest) 52%, transparent)"
      : "color-mix(in srgb, var(--border) 78%, transparent)",
    backgroundColor: isFocusedField(field)
      ? "color-mix(in srgb, var(--forest) 12%, var(--surface))"
      : "color-mix(in srgb, var(--surface) 92%, black)",
    boxShadow: isFocusedField(field)
      ? "0 0 0 1px color-mix(in srgb, var(--forest) 18%, transparent) inset, 0 0 22px color-mix(in srgb, var(--forest) 12%, transparent)"
      : "none",
    animation: isFocusedField(field) ? "exerciseEditorFieldFocus 1.9s ease-out 1" : "none",
    transition: "border-color 320ms ease, background-color 320ms ease, box-shadow 320ms ease, opacity 420ms ease",
    opacity: isFocusedField(field) ? 1 : 0.98,
  });

  const inputCls = "w-full rounded-lg border border-ink-light/40 bg-ink-dark px-3 py-2 text-sm text-cloud-white outline-none transition-colors focus:border-jade-glow/60";
  const chipBase = "text-[11px] rounded-lg border px-2.5 py-1.5 transition-all duration-150";
  const chipOn = "border-jade-glow/50 bg-jade-deep/40 text-jade-light";
  const chipOff = "border-ink-light/40 bg-ink-dark/60 text-mist-light hover:border-accent/55 hover:bg-accent/18 hover:text-cloud-white";

  const toggleMuscle = (muscle: MuscleGroup) => {
    setMuscleGroups((prev) => (prev.includes(muscle) ? prev.filter((item) => item !== muscle) : [...prev, muscle]));
  };

  const addUniqueLabel = (value: string, current: string[], setValue: (next: string[]) => void) => {
    const next = value.trim().slice(0, 200);
    if (!next) return false;
    if (current.some((item) => item.toLowerCase() === next.toLowerCase())) return false;
    setValue([...current, next]);
    return true;
  };

  const addDraftLabels = useCallback((value: string, current: string[], setValue: (next: string[]) => void) => {
    const nextLabels = splitDraftLabels(value);
    if (nextLabels.length === 0) return false;

    const existing = new Set(current.map((item) => item.toLowerCase()));
    const additions: string[] = [];

    for (const label of nextLabels) {
      const normalized = label.toLowerCase();
      if (existing.has(normalized)) continue;
      existing.add(normalized);
      additions.push(label);
    }

    if (additions.length === 0) return false;
    setValue([...current, ...additions]);
    return true;
  }, []);

  const moveProgressionStage = (index: number, direction: -1 | 1) => {
    setProgression((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const postEditHistory = async (field: string, beforeValue: string, afterValue: string) => {
    if (!exercise) return;
    await api.post("/api/exercise-library/edit-history", {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      field,
      beforeValue,
      afterValue,
    });
  };

  const handleSave = async () => {
    if (!exercise || !exerciseId) return;

    setError("");
    setStatus("");

    const nextName = name.trim();
    if (nextName.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (muscleGroups.length === 0) {
      setError("Select at least one muscle group.");
      return;
    }
    if (progression.length === 0) {
      setError("Add at least one progression stage.");
      return;
    }

    const previousVariationNames = (exercise.variations ?? []).map((variation) => variation.name).filter(Boolean);
    const beforeMuscles = joinList(exercise.muscleGroups ?? []);
    const afterMuscles = joinList(muscleGroups);
    const beforeProgression = joinList(exercise.progression ?? []);
    const afterProgression = joinList(progression);
    const beforeVariations = joinList(previousVariationNames);
    const afterVariations = joinList(variations);

    const hasChanges =
      nextName !== exercise.name
      || category !== exercise.category
      || exerciseType !== exercise.exerciseType
      || beforeMuscles !== afterMuscles
      || beforeProgression !== afterProgression
      || beforeVariations !== afterVariations;

    if (!hasChanges) {
      setStatus("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/exercise-library/${exerciseId}`, {
        name: nextName,
        category,
        exerciseType,
        muscleGroups,
        progression,
        variations,
      });

      const historyWrites: Promise<unknown>[] = [];
      if (nextName !== exercise.name) {
        historyWrites.push(postEditHistory("Name", exercise.name, nextName));
      }
      if (category !== exercise.category) {
        historyWrites.push(postEditHistory("Category", exercise.category, category));
      }
      if (exerciseType !== exercise.exerciseType) {
        historyWrites.push(postEditHistory("Type", exercise.exerciseType, exerciseType));
      }
      if (beforeMuscles !== afterMuscles) {
        historyWrites.push(postEditHistory("Muscles", beforeMuscles, afterMuscles));
      }
      if (beforeProgression !== afterProgression) {
        historyWrites.push(postEditHistory("Progression", beforeProgression, afterProgression));
      }
      if (beforeVariations !== afterVariations) {
        historyWrites.push(postEditHistory("Variants", beforeVariations, afterVariations));
      }

      await Promise.all(historyWrites);

      const updatedExercise: SimpleExercise = {
        ...exercise,
        name: nextName,
        category,
        exerciseType,
        muscleGroups,
        progression,
        variations: variations.map((value, index) => ({
          id: exercise.variations?.[index]?.id,
          name: value,
        })),
        updatedAt: new Date().toISOString(),
      };

      setExercise(updatedExercise);
      setConfirmedPanels((prev) => (prev.includes("review") ? prev : [...prev, "review"]));
      window.dispatchEvent(new Event(PROGRESSION_EXERCISES_UPDATED_EVENT));
      setStatus("Exercise saved successfully.");
    } catch (err) {
      console.error("Failed to save exercise:", err);
      setError(err instanceof Error ? err.message : "Failed to save exercise.");
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    if (!exercise) return false;
    return name.trim() !== exercise.name
      || category !== exercise.category
      || exerciseType !== exercise.exerciseType
      || joinList(muscleGroups) !== joinList(exercise.muscleGroups ?? [])
      || joinList(progression) !== joinList(exercise.progression ?? [])
      || joinList(variations) !== joinList((exercise.variations ?? []).map((variation) => variation.name).filter(Boolean));
  }, [exercise, name, category, exerciseType, muscleGroups, progression, variations]);

  const saveReady = name.trim().length >= 2 && muscleGroups.length > 0 && progression.length > 0;
  const shellMinHeight = "calc(100dvh - 0.5rem)";
  const panelShellStyle = { minHeight: 0, height: "100%" };
  const activePanelIndex = EDITOR_PANELS.findIndex((panel) => panel.id === activePanel);

  const completionByPanel: Record<EditorPanelId, boolean> = {
    identity: confirmedPanels.includes("identity") && name.trim().length >= 2,
    classification: confirmedPanels.includes("classification") && Boolean(category) && Boolean(exerciseType) && muscleGroups.length > 0,
    structure: confirmedPanels.includes("structure") && progression.length > 0,
    review: confirmedPanels.includes("review") && saveReady,
  };

  const handleResetDraft = () => {
    if (!exercise) return;
    setName(exercise.name);
    setCategory(exercise.category);
    setExerciseType(exercise.exerciseType);
    setMuscleGroups(exercise.muscleGroups ?? []);
    setProgression((exercise.progression ?? []).filter(Boolean));
    setVariations((exercise.variations ?? []).map((variation) => variation.name).filter(Boolean));
    setProgressionDraft("");
    setVariationDraft("");
    setError("");
    setStatus("");
    setActivePanel("identity");
    setConfirmedPanels([]);
  };

  const goToNextPanel = () => {
    if (activePanelIndex >= EDITOR_PANELS.length - 1) return;

    setConfirmedPanels((prev) => {
      const canConfirmCurrent =
        (activePanel === "identity" && name.trim().length >= 2)
        || (activePanel === "classification" && Boolean(category) && Boolean(exerciseType) && muscleGroups.length > 0)
        || (activePanel === "structure" && progression.length > 0);

      if (!canConfirmCurrent || prev.includes(activePanel)) return prev;
      return [...prev, activePanel];
    });

    setActivePanel(EDITOR_PANELS[activePanelIndex + 1]?.id ?? "review");
  };

  const goToPreviousPanel = () => {
    if (activePanelIndex <= 0) return;
    setActivePanel(EDITOR_PANELS[activePanelIndex - 1]?.id ?? "identity");
  };

  const renderPanelActions = (mode: "next" | "save" = "next") => (
    <div
      className="mt-auto flex items-center justify-between gap-2 border-t pt-3"
      style={{ borderColor: "color-mix(in srgb, var(--ink-light) 34%, transparent)" }}
    >
      <GlowButton
        variant="ghost"
        size="sm"
        onClick={goToPreviousPanel}
        disabled={activePanelIndex <= 0}
        className={`h-10 min-w-[96px] justify-center rounded-xl ${activePanelIndex <= 0 ? "pointer-events-none opacity-45" : ""}`}
        style={{
          borderColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--ink-dark) 92%, var(--ink-deep))",
          color: "var(--cloud-white)",
          boxShadow: "0 0 0 1px rgba(88,101,242,0.06) inset",
        }}
      >
        ← Back
      </GlowButton>

      {mode === "save" ? (
        <GlowButton
          variant="jade"
          size="sm"
          disabled={saving || !saveReady}
          onClick={() => void handleSave()}
          className="h-10 min-w-[110px] justify-center rounded-xl"
        >
          {saving ? "Saving..." : "Save"}
        </GlowButton>
      ) : (
        <GlowButton variant="jade" size="sm" onClick={goToNextPanel} className="h-10 min-w-[96px] justify-center rounded-xl">
          Next →
        </GlowButton>
      )}
    </div>
  );

  if (!user || user.role !== "admin") {
    return (
      <PageLayout
        title="Exercise Editor"
        subtitle="Update category, type, muscles, progression, and variants for this exercise"
        mobileContentPaddingClass="p-0 pb-0"
        mobileScrollContainerEnabled={false}
      >
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="text-5xl opacity-50">🔒</div>
          <h3 className="text-lg font-semibold text-crimson-light">Access Restricted</h3>
          <p className="text-sm text-mist-dark text-center max-w-md">
            Exercise editing is available only to admins.
          </p>
          <GlowButton variant="ghost" size="sm" onClick={() => router.push("/dashboard/overview")}>
            ← Return to Overview
          </GlowButton>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Exercise Editor"
      subtitle="Update category, type, muscles, progression, and variants for this exercise"
      mobileContentPaddingClass="p-0 pb-0"
      mobileScrollContainerEnabled={false}
    >
      {loading ? (
        <GlowCard glow="jade" hoverable={false}>
          <p className="py-4 text-center text-sm text-mist-dark">Loading exercise editor...</p>
        </GlowCard>
      ) : error && !exercise ? (
        <GlowCard glow="jade" hoverable={false}>
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
            <GlowButton onClick={() => router.push("/dashboard/exercise-db")} variant="jade" size="sm">
              Return to library
            </GlowButton>
          </div>
        </GlowCard>
      ) : (
        <div className="flex flex-col px-0" style={{ minHeight: shellMinHeight }}>
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-2xl border"
            style={{
              minHeight: shellMinHeight,
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
                  href="/dashboard/exercise-db"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors"
                  style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                  aria-label="Back to exercise library"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Exercise Library</p>
                  <h2 className="mt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-primary)]">Edit Exercise</h2>
                  <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">A train-style stepper for updating exercise details.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 px-2 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              {error ? (
                <div
                  className="rounded-lg border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
                    color: "color-mix(in srgb, var(--danger) 78%, white)",
                  }}
                >
                  {error}
                </div>
              ) : null}

              {status ? (
                <div
                  className="rounded-lg border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: "color-mix(in srgb, var(--forest) 35%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--forest) 10%, transparent)",
                    color: "color-mix(in srgb, var(--forest) 82%, white)",
                  }}
                >
                  {status}
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-row gap-3 overflow-hidden">
                <aside className="w-[68px] shrink-0 sm:w-[72px]">
                  <div className="flex h-full min-h-full flex-col items-center py-1">
                    <div className="flex flex-1 flex-col items-center gap-1.5">
                      {EDITOR_PANELS.map((panel, index) => {
                        const isActive = activePanel === panel.id;
                        return (
                          <button
                            key={panel.id}
                            type="button"
                            onClick={() => setActivePanel(panel.id)}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-center transition-all"
                            style={{
                              border: completionByPanel[panel.id]
                                ? "1px solid color-mix(in srgb, var(--forest) 42%, transparent)"
                                : isActive
                                  ? "1px solid color-mix(in srgb, var(--accent) 42%, transparent)"
                                  : "1px solid color-mix(in srgb, var(--border) 80%, transparent)",
                              backgroundColor: completionByPanel[panel.id]
                                ? "color-mix(in srgb, var(--forest) 14%, transparent)"
                                : isActive
                                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                                  : "transparent",
                              color: completionByPanel[panel.id]
                                ? "color-mix(in srgb, var(--forest) 82%, white)"
                                : isActive
                                  ? "var(--text-primary)"
                                  : "var(--text-muted)",
                              boxShadow: completionByPanel[panel.id]
                                ? "0 0 16px color-mix(in srgb, var(--forest) 12%, transparent)"
                                : isActive
                                  ? "0 0 14px color-mix(in srgb, var(--accent) 10%, transparent)"
                                  : "none",
                            }}
                            aria-label={panel.label}
                            title={`${panel.label} • ${panel.description}`}
                          >
                            <span className="text-[11px] font-semibold">{index + 1}</span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={handleResetDraft}
                        className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                        style={{
                          border: "1px solid transparent",
                          backgroundColor: "transparent",
                          color: "var(--text-muted)",
                        }}
                        aria-label="Reset editor"
                        title="Reset editor"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-5h-5" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 9a8 8 0 0 0-13.66-3.66L4 9m16 6-2.34 3.66A8 8 0 0 1 4 15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </aside>

                <div className="min-w-0 flex min-h-0 flex-1 flex-col pr-0.5">
                  {activePanel === "identity" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="flex-1 overflow-y-auto pr-0.5">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Exercise identity</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Confirm the parent exercise name before moving on.</p>
                        </div>

                        <div className="mt-4 rounded-lg border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
                          <label className="block space-y-2">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Parent exercise</span>
                            <input
                              type="text"
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              className={inputCls}
                              maxLength={200}
                              placeholder="Enter exercise name"
                            />
                          </label>
                          <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">This is the label shown throughout the training system.</p>
                        </div>
                      </div>

                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "classification" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="flex-1 overflow-y-auto pr-0.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Classification</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Set the category, training type, and targeted muscle groups.</p>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div id="editor-field-category" className="rounded-lg border px-3 py-3" style={getEditorFieldStyle("category")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Category</label>
                            <div className="flex flex-wrap gap-2">
                              {dbOptions.categories.map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setCategory(item as TrainingCategory)}
                                  className={`${chipBase} ${category === item ? chipOn : chipOff}`}
                                >
                                  {getCategoryIcon(item as TrainingCategory)} {item}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div id="editor-field-type" className="rounded-lg border px-3 py-3" style={getEditorFieldStyle("type")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Type</label>
                            <div className="flex flex-wrap gap-2">
                              {dbOptions.types.map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setExerciseType(item as SimpleExerciseType)}
                                  className={`${chipBase} ${exerciseType === item ? chipOn : chipOff}`}
                                >
                                  {getExerciseTypeIcon(item as SimpleExerciseType)} {item}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div id="editor-field-muscles" className="rounded-lg border px-3 py-3" style={getEditorFieldStyle("muscles")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Muscle groups</label>
                            <div className="flex flex-wrap gap-2">
                              {dbOptions.muscles.map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => toggleMuscle(item as MuscleGroup)}
                                  className={`${chipBase} ${muscleGroups.includes(item as MuscleGroup) ? chipOn : chipOff}`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "structure" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="flex-1 overflow-y-auto pr-0.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Exercise structure</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Define the progression stages and optional variations used in the library.</p>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div id="editor-field-progression" className="rounded-lg border px-3 py-3" style={getEditorFieldStyle("progression")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Progression</label>
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {progression.length === 0 ? (
                                <span className="text-[11px] text-[color:var(--text-secondary)]">No progression stages yet.</span>
                              ) : progression.map((value, index) => (
                                <span key={`${value}-${index}`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", color: "var(--text-primary)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
                                  <span className="rounded px-1 text-[10px]" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "color-mix(in srgb, var(--accent) 70%, white)" }}>
                                    {index + 1}
                                  </span>
                                  <span>{value}</span>
                                  <button
                                    type="button"
                                    onClick={() => moveProgressionStage(index, -1)}
                                    disabled={index === 0}
                                    className="rounded px-1 disabled:opacity-35"
                                    style={{ color: "var(--text-muted)" }}
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveProgressionStage(index, 1)}
                                    disabled={index === progression.length - 1}
                                    className="rounded px-1 disabled:opacity-35"
                                    style={{ color: "var(--text-muted)" }}
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                  <button type="button" onClick={() => setProgression((prev) => prev.filter((item, itemIndex) => itemIndex !== index))} style={{ color: "var(--danger)" }}>
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={progressionDraft}
                                onChange={(event) => setProgressionDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter") return;
                                  event.preventDefault();
                                  const added = addDraftLabels(progressionDraft, progression, setProgression);
                                  if (added) setProgressionDraft("");
                                }}
                                placeholder="e.g. Assisted, Bodyweight, Weighted"
                                className={`${inputCls} !py-1.5`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const added = addDraftLabels(progressionDraft, progression, setProgression);
                                  if (added) setProgressionDraft("");
                                }}
                                className="theme-action-btn rounded-md border px-3 py-1.5 text-xs"
                              >
                                Add
                              </button>
                            </div>
                            <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">Add one or paste multiple stages separated by commas.</p>
                          </div>

                          <div id="editor-field-variation" className="rounded-lg border px-3 py-3" style={getEditorFieldStyle("variation")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Variants</label>
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {variations.length === 0 ? (
                                <span className="text-[11px] text-[color:var(--text-secondary)]">No variants yet.</span>
                              ) : variations.map((value) => (
                                <span key={value} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", color: "var(--text-primary)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
                                  {value}
                                  <button type="button" onClick={() => setVariations((prev) => prev.filter((item) => item !== value))} style={{ color: "var(--danger)" }}>
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={variationDraft}
                                onChange={(event) => setVariationDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter") return;
                                  event.preventDefault();
                                  const added = addDraftLabels(variationDraft, variations, setVariations);
                                  if (added) setVariationDraft("");
                                }}
                                placeholder="e.g. Wide grip, Neutral grip, Rings"
                                className={`${inputCls} !py-1.5`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const added = addDraftLabels(variationDraft, variations, setVariations);
                                  if (added) setVariationDraft("");
                                }}
                                className="theme-action-btn rounded-md border px-3 py-1.5 text-xs"
                              >
                                Add
                              </button>
                            </div>
                            <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">Paste multiple variants separated by commas for bulk add.</p>
                          </div>
                        </div>
                      </div>

                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "review" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="flex-1 overflow-y-auto pr-0.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Review changes</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Check the full setup before saving back to the exercise library.</p>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-lg border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Identity</p>
                            <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{name.trim() || "—"}</p>
                            <p className="mt-3 text-[11px] text-[color:var(--text-secondary)]">{category} • {exerciseType}</p>
                          </div>

                          <div className="rounded-lg border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Muscle groups</p>
                            <p className="mt-2 text-[11px] text-[color:var(--text-primary)]">{muscleGroups.length > 0 ? muscleGroups.join(", ") : "None selected"}</p>
                          </div>

                          <div className="rounded-lg border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Progression</p>
                            <p className="mt-2 text-[11px] text-[color:var(--text-primary)]">{progression.length > 0 ? progression.join(" → ") : "No progression stages"}</p>
                          </div>

                          <div className="rounded-lg border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Variants</p>
                            <p className="mt-2 text-[11px] text-[color:var(--text-primary)]">{variations.length > 0 ? variations.join(", ") : "No variants"}</p>
                          </div>
                        </div>

                        <div
                          className="mt-3 rounded-lg border px-3 py-2 text-[11px]"
                          style={{
                            borderColor: saveReady
                              ? "color-mix(in srgb, var(--forest) 35%, transparent)"
                              : "color-mix(in srgb, var(--warning) 35%, transparent)",
                            backgroundColor: saveReady
                              ? "color-mix(in srgb, var(--forest) 10%, transparent)"
                              : "color-mix(in srgb, var(--warning) 10%, transparent)",
                            color: saveReady
                              ? "color-mix(in srgb, var(--forest) 82%, white)"
                              : "color-mix(in srgb, var(--warning) 78%, white)",
                          }}
                        >
                          {saveReady
                            ? hasUnsavedChanges
                              ? "Everything is ready to save."
                              : "No pending changes right now."
                            : "Complete the required exercise details before saving."}
                        </div>
                      </div>

                      {renderPanelActions("save")}
                    </section>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </PageLayout>
  );
}
