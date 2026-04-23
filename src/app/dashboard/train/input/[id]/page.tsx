"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { buildIsoAtUserDateTime } from "@/lib/constants";
import { PROGRESSION_EXERCISES_UPDATED_EVENT } from "@/lib/progression-events";
import { api, ApiRequestError } from "@/lib/api-client";
import { kgToLbs, lbsToKg } from "@/lib/unit-conversion";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";

type InputMode = "existing" | "custom";
type ValueMode = "weight" | "timed";
type WeightUnit = "kg" | "lbs";
type SessionPanelId = "exercise" | "details" | "format" | "session" | "notes" | "review";
type SetRow = { id: string; value: string; reps: string };
type ExistingLogPayload = {
  id: string;
  exerciseId: string;
  exerciseName?: string;
  level: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
  createdAt: string;
};

const SESSION_PANELS: Array<{ id: SessionPanelId; label: string; description: string }> = [
  { id: "exercise", label: "Exercise", description: "Selected movement" },
  { id: "details", label: "Details", description: "Progression and variant" },
  { id: "format", label: "Format", description: "Choose the log style" },
  { id: "session", label: "Session", description: "Date and working sets" },
  { id: "notes", label: "Notes", description: "Add context" },
  { id: "review", label: "Review", description: "Save to Train" },
];

function createSetRow(seed: number): SetRow {
  return { id: `set-${Date.now()}-${seed}`, value: "", reps: "" };
}

function createInitialSets(): SetRow[] {
  return [createSetRow(1)];
}

function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildCreatedAtFromDateInput(dateInput: string, timeZone?: string): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : getTodayInputValue();
  return buildIsoAtUserDateTime(safeDate, timeZone) ?? new Date().toISOString();
}

function parseNumber(value: string, integerOnly = false): number | null {
  if (!value || value.trim() === "") return null;
  const parsed = integerOnly ? Number.parseInt(value, 10) : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSignedModifierKg(value: number): string {
  const normalized = Math.round(value * 10) / 10;
  const absValue = Math.abs(normalized);
  const display = Number.isInteger(absValue) ? String(absValue) : absValue.toFixed(1).replace(/\.0$/, "");
  return `${normalized >= 0 ? "+" : "-"}${display}kg`;
}

function parseSignedModifierKg(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([+-]?[\d.]+)\s*kg/i);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatInputNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  const normalized = Math.round(value * 10) / 10;
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1).replace(/\.0$/, "");
}

function normalizeEditableSetRows(rows: SetRow[]): Array<{ value: string; reps: string }> {
  const normalized = rows.map((set) => ({
    value: set.value.trim(),
    reps: set.reps.trim(),
  }));

  let lastFilledIndex = -1;
  normalized.forEach((set, index) => {
    if (set.value || set.reps) lastFilledIndex = index;
  });

  return normalized.slice(0, Math.max(lastFilledIndex + 1, 1));
}

function buildEditSnapshot(input: {
  inputMode: InputMode;
  valueMode: ValueMode;
  weightUnit: WeightUnit;
  selectedExerciseId: string;
  customExerciseName: string;
  selectedLevel: string;
  selectedVariant: string;
  modifierKg: number;
  trainingDate: string;
  notes: string;
  sets: SetRow[];
}): string {
  return JSON.stringify({
    inputMode: input.inputMode,
    valueMode: input.valueMode,
    weightUnit: input.weightUnit,
    selectedExerciseId: input.selectedExerciseId,
    customExerciseName: input.customExerciseName.trim(),
    selectedLevel: input.selectedLevel || "",
    selectedVariant: input.selectedVariant || "",
    modifierKg: Math.round(input.modifierKg * 10) / 10,
    trainingDate: input.trainingDate,
    notes: input.notes.trim(),
    sets: normalizeEditableSetRows(input.sets),
  });
}

export default function TrainInputCanvasPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ id?: string | string[] }>();
  const userId = user?.id ?? "";

  const routeExerciseId = Array.isArray(params?.id) ? params.id[0] ?? "" : params?.id ?? "";
  const isEditingExistingLog = pathname.includes("/workout-history/input/");
  const editLogId = isEditingExistingLog ? routeExerciseId : searchParams.get("editLogId") || "";
  const returnHref = isEditingExistingLog ? "/dashboard/history" : "/dashboard/train";
  const prefillExerciseId = searchParams.get("prefillExerciseId") || (!editLogId && routeExerciseId !== "new" ? routeExerciseId : "");
  const prefillExerciseName = searchParams.get("prefillExercise") || "";
  const prefillProgression = searchParams.get("prefillProgression") || "";
  const prefillVariant = searchParams.get("prefillVariant") || "";
  const prefillCustomExercise = searchParams.get("custom") === "1";

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editLogHydrated, setEditLogHydrated] = useState(!editLogId);
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>(prefillCustomExercise ? "custom" : "existing");
  const [valueMode, setValueMode] = useState<ValueMode>("weight");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(settings.defaultWeightUnit === "lbs" ? "lbs" : "kg");
  const [searchTerm, setSearchTerm] = useState(prefillExerciseName);
  const [selectedExerciseId, setSelectedExerciseId] = useState(prefillExerciseId);
  const [customExerciseName, setCustomExerciseName] = useState(prefillExerciseName);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(prefillVariant);
  const [modifierKg, setModifierKg] = useState(0);
  const [trainingDate, setTrainingDate] = useState(getTodayInputValue());
  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState<SetRow[]>(createInitialSets);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SessionPanelId>("exercise");
  const [highlightedSetId, setHighlightedSetId] = useState<string | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [confirmedPanels, setConfirmedPanels] = useState<SessionPanelId[]>([]);

  useEffect(() => {
    setWeightUnit(settings.defaultWeightUnit === "lbs" ? "lbs" : "kg");
  }, [settings.defaultWeightUnit]);

  useEffect(() => {
    if (!highlightedSetId) return;
    const timeout = window.setTimeout(() => setHighlightedSetId(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [highlightedSetId]);

  useEffect(() => {
    if (!sets.length) {
      setExpandedSetId(null);
      return;
    }

    if (!expandedSetId || !sets.some((set) => set.id === expandedSetId)) {
      setExpandedSetId(sets[sets.length - 1]?.id ?? null);
    }
  }, [expandedSetId, sets]);

  useEffect(() => {
    const step = searchParams.get("step");
    if (!step) return;
    if (SESSION_PANELS.some((panel) => panel.id === step)) {
      setActivePanel(step as SessionPanelId);
    }
  }, [searchParams]);

  useEffect(() => {
    const field = searchParams.get("field");
    if (!field) {
      setHighlightedField(null);
      return;
    }

    setHighlightedField(field);

    if (field === "progression" || field === "variation") {
      setActivePanel("details");
    } else if (field === "modifier" || field === "session-date" || field.startsWith("set-")) {
      setActivePanel("session");
    } else if (field === "notes") {
      setActivePanel("notes");
    }

    if (field.startsWith("set-")) {
      const setIndex = Math.max(0, Number.parseInt(field.replace("set-", ""), 10) - 1);
      const targetSet = sets[setIndex];
      if (targetSet) {
        setHighlightedSetId(targetSet.id);
        setExpandedSetId(targetSet.id);
      }
    }

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
  }, [searchParams, sets]);

  useEffect(() => {
    if (!editLogId) {
      setInitialEditSnapshot(null);
      setEditLogHydrated(true);
      return;
    }

    let cancelled = false;

    const loadExistingLog = async () => {
      setEditLogHydrated(false);
      try {
        const data = await api.get<{ log: ExistingLogPayload }>(`/api/progressions/logs/${encodeURIComponent(editLogId)}`);
        if (cancelled || !data.log) return;

        const log = data.log;
        const usesTimedMetrics = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
        const displayWeight = (value: number | null) => {
          if (value == null) return "";
          return formatInputNumber(weightUnit === "lbs" ? kgToLbs(value) : value);
        };

        const nextInputMode: InputMode = "existing";
        const nextSelectedExerciseId = log.exerciseId;
        const nextSearchTerm = log.exerciseName || "";
        const nextCustomExerciseName = "";
        const nextSelectedLevel = String(log.level || 1);
        const nextSelectedVariant = log.variant || "";
        const nextModifierKg = parseSignedModifierKg(log.modifier) ?? 0;
        const nextTrainingDate = new Date(log.createdAt).toISOString().slice(0, 10);
        const nextNotes = log.notes || "";
        const nextValueMode: ValueMode = usesTimedMetrics ? "timed" : "weight";
        const nextSets = [
          {
            id: `${log.id}-set-1`,
            value: usesTimedMetrics ? formatInputNumber(log.holdTime) : displayWeight(log.weight1),
            reps: log.reps1 != null ? String(log.reps1) : "",
          },
          {
            id: `${log.id}-set-2`,
            value: usesTimedMetrics ? formatInputNumber(log.holdTime2) : displayWeight(log.weight2),
            reps: log.reps2 != null ? String(log.reps2) : "",
          },
          {
            id: `${log.id}-set-3`,
            value: usesTimedMetrics ? formatInputNumber(log.holdTime3) : displayWeight(log.weight3),
            reps: log.reps3 != null ? String(log.reps3) : "",
          },
        ];

        setInputMode(nextInputMode);
        setSelectedExerciseId(nextSelectedExerciseId);
        setSearchTerm(nextSearchTerm);
        setCustomExerciseName(nextCustomExerciseName);
        setSelectedLevel(nextSelectedLevel);
        setSelectedVariant(nextSelectedVariant);
        setModifierKg(nextModifierKg);
        setTrainingDate(nextTrainingDate);
        setNotes(nextNotes);
        setValueMode(nextValueMode);
        setSets(nextSets);
        setInitialEditSnapshot(buildEditSnapshot({
          inputMode: nextInputMode,
          valueMode: nextValueMode,
          weightUnit,
          selectedExerciseId: nextSelectedExerciseId,
          customExerciseName: nextCustomExerciseName,
          selectedLevel: nextSelectedLevel,
          selectedVariant: nextSelectedVariant,
          modifierKg: nextModifierKg,
          trainingDate: nextTrainingDate,
          notes: nextNotes,
          sets: nextSets,
        }));
      } catch (error) {
        console.error("Failed to load existing training log:", error);
        if (!cancelled) {
          setMessage({ type: "error", text: "Failed to load this logged session." });
        }
      } finally {
        if (!cancelled) {
          setEditLogHydrated(true);
        }
      }
    };

    void loadExistingLog();

    return () => {
      cancelled = true;
    };
  }, [editLogId, weightUnit]);

  const fetchExercises = useCallback(async () => {
    if (!userId) {
      setExercises([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions/history?logLimit=200");
      setExercises(data.exercises || []);
    } catch (error) {
      console.error("Failed to load train input exercises:", error);
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    const handleProgressionUpdate = () => {
      void fetchExercises();
    };

    window.addEventListener(PROGRESSION_EXERCISES_UPDATED_EVENT, handleProgressionUpdate);
    return () => {
      window.removeEventListener(PROGRESSION_EXERCISES_UPDATED_EVENT, handleProgressionUpdate);
    };
  }, [fetchExercises]);

  const selectedExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === selectedExerciseId) || null,
    [exercises, selectedExerciseId],
  );

  const filteredExercises = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return exercises.slice(0, 8);
    return exercises
      .filter((exercise) => {
        const haystack = [exercise.name, exercise.englishName, exercise.vietnameseName, exercise.category]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 10);
  }, [exercises, searchTerm]);

  useEffect(() => {
    if (prefillCustomExercise) {
      setInputMode("custom");
      setSelectedExerciseId("");
      if (prefillExerciseName) {
        setCustomExerciseName(prefillExerciseName);
      }
      return;
    }

    if (!selectedExercise && !prefillExerciseId && !prefillExerciseName) return;
    if (!selectedExercise && exercises.length > 0) {
      const matched = exercises.find((exercise) => exercise.id === prefillExerciseId)
        || exercises.find((exercise) => exercise.name.toLowerCase() === prefillExerciseName.toLowerCase())
        || exercises.find((exercise) => exercise.name.toLowerCase().includes(prefillExerciseName.toLowerCase()));

      if (matched) {
        setSelectedExerciseId(matched.id);
        setSearchTerm(matched.name);
      }
      return;
    }

    if (!selectedExercise) return;

    setSelectedLevel((prev) => {
      if (prev && selectedExercise.tiers.some((tier) => String(tier.level) === prev)) return prev;
      const matchedPrefill = selectedExercise.tiers.find(
        (tier) => tier.name === prefillProgression || tier.wuxiaName === prefillProgression || String(tier.level) === prefillProgression,
      );
      const fallback = matchedPrefill?.level ?? selectedExercise.userProgress?.[0]?.currentLevel ?? selectedExercise.tiers[0]?.level ?? 1;
      return String(fallback);
    });

    setSelectedVariant((prev) => {
      if (prev && selectedExercise.variations.some((variation) => variation.name === prev)) return prev;
      if (prefillVariant && selectedExercise.variations.some((variation) => variation.name === prefillVariant)) return prefillVariant;
      return "";
    });
  }, [exercises, prefillCustomExercise, prefillExerciseId, prefillExerciseName, prefillProgression, prefillVariant, selectedExercise]);

  const addSetRow = () => {
    setSets((prev) => {
      const nextSet = createSetRow(prev.length + 1);
      setExpandedSetId(nextSet.id);
      setHighlightedSetId(nextSet.id);
      return [...prev, nextSet];
    });
  };

  const updateSetRow = (id: string, field: "value" | "reps", value: string) => {
    setHighlightedSetId(null);
    setExpandedSetId(id);
    setSets((prev) => prev.map((set) => (set.id === id ? { ...set, [field]: value } : set)));
  };

  const removeSetRow = (id: string) => {
    setHighlightedSetId(null);
    setSets((prev) => {
      if (prev.length <= 1) return prev;
      const nextSets = prev.filter((set) => set.id !== id);
      if (expandedSetId === id) {
        const removedIndex = prev.findIndex((set) => set.id === id);
        const fallbackSet = nextSets[Math.max(0, Math.min(removedIndex, nextSets.length - 1))];
        setExpandedSetId(fallbackSet?.id ?? null);
      }
      return nextSets;
    });
  };

  const resetForm = () => {
    setMessage(null);
    setInputMode("existing");
    setValueMode("weight");
    setSearchTerm("");
    setSelectedExerciseId("");
    setCustomExerciseName("");
    setSelectedLevel("");
    setSelectedVariant("");
    setModifierKg(0);
    setTrainingDate(getTodayInputValue());
    setNotes("");
    setSets(createInitialSets());
    setExpandedSetId(null);
    setActivePanel("exercise");
    setHighlightedSetId(null);
    setConfirmedPanels([]);
  };

  const handleSelectExercise = (exercise: ProgressionExercise) => {
    setInputMode("existing");
    setSelectedExerciseId(exercise.id);
    setSearchTerm(exercise.name);
    setCustomExerciseName("");
    setMessage(null);
  };

  const handleStartCustomExercise = (prefillName = "") => {
    setInputMode("custom");
    setSelectedExerciseId("");
    setSearchTerm("");
    setCustomExerciseName(prefillName.trim());
    setSelectedLevel("1");
    setSelectedVariant("");
    setMessage(null);
  };

  const handleSave = useCallback(async () => {
    if (saving || deleting) return;

    const parsedSets = sets
      .map((set) => ({
        value: parseNumber(set.value, false),
        reps: parseNumber(set.reps, true),
      }))
      .filter((set) => set.value != null || set.reps != null);

    if (parsedSets.length === 0) {
      setActivePanel("session");
      setHighlightedSetId(sets[0]?.id ?? null);
      setMessage({ type: "error", text: "Enter at least one set before saving." });
      return;
    }

    const primarySets = [parsedSets[0] ?? null, parsedSets[1] ?? null, parsedSets[2] ?? null];
    const mergedNotes = notes.trim();

    const toStoredWeightKg = (value: number | null): number | null => {
      if (value == null || valueMode === "timed") return null;
      return weightUnit === "lbs" ? lbsToKg(value) : value;
    };

    const toStoredSeconds = (value: number | null): number | null => {
      if (value == null || valueMode !== "timed") return null;
      return Math.max(0, Math.round(value));
    };

    const createdAt = buildCreatedAtFromDateInput(trainingDate, settings.timeZone);

    setSaving(true);
    setMessage(null);

    try {
      let targetExerciseId = selectedExerciseId;
      let targetLevel = Number.parseInt(selectedLevel || "", 10) || 1;
      let targetVariant = selectedVariant || null;

      if (inputMode === "custom") {
        const nextExerciseName = customExerciseName.trim();
        if (nextExerciseName.length < 2) {
          setMessage({ type: "error", text: "Enter a custom exercise name first." });
          setSaving(false);
          return;
        }

        const created = await api.post<{ exercise?: { id: string } }>("/api/exercise-library", {
          name: nextExerciseName,
          category: "Other",
          exerciseType: "bodyweight",
          muscleGroups: ["Other"],
          progression: [nextExerciseName],
          variations: [],
          pendingReview: true,
        });

        if (!created.exercise?.id) {
          throw new Error("Unable to create a pending exercise.");
        }

        targetExerciseId = created.exercise.id;
        targetLevel = 1;
        targetVariant = null;
      } else if (!targetExerciseId) {
        setMessage({ type: "error", text: "Select an exercise before saving." });
        setSaving(false);
        return;
      }

      if (isEditingExistingLog && editLogId) {
        await api.post("/api/progressions/logs/update", {
          updates: [
            {
              id: editLogId,
              exerciseId: targetExerciseId,
              level: targetLevel,
              weight1: toStoredWeightKg(primarySets[0]?.value ?? null),
              reps1: primarySets[0]?.reps ?? null,
              weight2: toStoredWeightKg(primarySets[1]?.value ?? null),
              reps2: primarySets[1]?.reps ?? null,
              weight3: toStoredWeightKg(primarySets[2]?.value ?? null),
              reps3: primarySets[2]?.reps ?? null,
              holdTime: toStoredSeconds(primarySets[0]?.value ?? null),
              holdTime2: toStoredSeconds(primarySets[1]?.value ?? null),
              holdTime3: toStoredSeconds(primarySets[2]?.value ?? null),
              modifier: valueMode === "weight" && modifierKg !== 0 ? formatSignedModifierKg(modifierKg) : null,
              variant: targetVariant,
              notes: mergedNotes || null,
            },
          ],
        });
      } else {
        await api.post(`/api/progressions/${targetExerciseId}/log`, {
          level: targetLevel,
          trainingDate,
          weight1: toStoredWeightKg(primarySets[0]?.value ?? null),
          reps1: primarySets[0]?.reps ?? null,
          weight2: toStoredWeightKg(primarySets[1]?.value ?? null),
          reps2: primarySets[1]?.reps ?? null,
          weight3: toStoredWeightKg(primarySets[2]?.value ?? null),
          reps3: primarySets[2]?.reps ?? null,
          holdTime: toStoredSeconds(primarySets[0]?.value ?? null),
          holdTime2: toStoredSeconds(primarySets[1]?.value ?? null),
          holdTime3: toStoredSeconds(primarySets[2]?.value ?? null),
          sets: parsedSets.map((set) => ({
            value: valueMode === "timed" ? toStoredSeconds(set.value) : toStoredWeightKg(set.value),
            reps: set.reps,
            metric: valueMode === "timed" ? "time" : "weight",
          })),
          variant: targetVariant,
          modifier: valueMode === "weight" && modifierKg !== 0 ? formatSignedModifierKg(modifierKg) : null,
          notes: mergedNotes || null,
          completed: false,
          createdAt,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("progression-exercises-updated"));
      }

      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push(returnHref);
      }
      return;
    } catch (error) {
      console.error("Failed to save training log:", error);
      setMessage({
        type: "error",
        text: error instanceof ApiRequestError ? error.message : `Failed to ${isEditingExistingLog ? "update" : "save"} training log.`,
      });
    } finally {
      setSaving(false);
    }
  }, [customExerciseName, deleting, editLogId, inputMode, isEditingExistingLog, notes, returnHref, router, saving, selectedExerciseId, selectedLevel, selectedVariant, sets, settings.timeZone, trainingDate, valueMode, weightUnit]);

  const handleDeleteLoggedSession = useCallback(async () => {
    if (!isEditingExistingLog || !editLogId || saving || deleting) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this logged session? This action cannot be undone.")) return;

    setDeleting(true);
    setMessage(null);

    try {
      await api.post("/api/progressions/logs/delete", { logId: editLogId });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("progression-exercises-updated"));
      }

      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push(returnHref);
      }
    } catch (error) {
      console.error("Failed to delete training log:", error);
      setMessage({
        type: "error",
        text: error instanceof ApiRequestError ? error.message : "Failed to delete this logged session.",
      });
    } finally {
      setDeleting(false);
    }
  }, [deleting, editLogId, isEditingExistingLog, returnHref, router, saving]);

  const shellMinHeight = "calc(var(--app-viewport-height) - 0.5rem)";
  const selectedExerciseMeta = inputMode === "custom"
    ? "This custom exercise will be saved to the pending section in Exercise DB for review."
    : selectedExercise
      ? `${selectedExercise.category || "Training"} • ${selectedExercise.tiers.length} progression tiers`
      : "Choose an exercise from the previous screen.";
  const setValuePlaceholder = valueMode === "timed" ? "time" : weightUnit;
  const panelShellStyle = {
    minHeight: 0,
    height: "100%",
    flex: 1,
    border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)",
    borderRadius: "1rem",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  };
  const hasExerciseChoice = inputMode === "custom"
    ? customExerciseName.trim().length >= 2
    : Boolean(selectedExerciseId);
  const hasDetailSelection = Boolean(selectedExercise || customExerciseName.trim() || selectedLevel);
  const hasFormatChoice = valueMode === "weight" || valueMode === "timed";
  const filledSetCount = sets.filter((set) => set.value.trim() !== "" || set.reps.trim() !== "").length;
  const hasNotes = notes.trim().length > 0;
  const hasConfirmedSetEntry = sets.some((set) => set.value.trim() !== "" && set.reps.trim() !== "");
  const completionByPanel: Record<SessionPanelId, boolean> = {
    exercise: confirmedPanels.includes("exercise") && hasExerciseChoice,
    details: confirmedPanels.includes("details") && hasDetailSelection,
    format: confirmedPanels.includes("format") && hasFormatChoice,
    session: confirmedPanels.includes("session") && Boolean(trainingDate) && hasConfirmedSetEntry,
    notes: confirmedPanels.includes("notes") && hasConfirmedSetEntry,
    review: confirmedPanels.includes("review") && hasConfirmedSetEntry,
  };
  const activePanelIndex = SESSION_PANELS.findIndex((panel) => panel.id === activePanel);
  const completedPanelCount = SESSION_PANELS.filter((panel) => completionByPanel[panel.id]).length;
  const selectedExerciseLabel = inputMode === "custom"
    ? customExerciseName.trim() || "Custom exercise"
    : selectedExercise?.name || "No exercise selected";
  const selectedProgressionLabel = inputMode === "custom"
    ? "Progression 1"
    : selectedExercise?.tiers.find((tier) => String(tier.level) === selectedLevel)?.name || `Progression ${selectedLevel || "1"}`;
  const reviewSetPreview = sets.flatMap((set, index) => {
    const value = set.value.trim();
    const reps = set.reps.trim();

    if (!value && !reps) return [];

    const summary = valueMode === "timed"
      ? `${value || "0"} sec • ${reps || "0"} reps`
      : `${value || "0"} ${weightUnit} • ${reps || "0"} reps`;

    return [{ label: `Set ${index + 1}`, summary }];
  });
  const currentEditSnapshot = useMemo(() => {
    if (!isEditingExistingLog) return null;
    return buildEditSnapshot({
      inputMode,
      valueMode,
      weightUnit,
      selectedExerciseId,
      customExerciseName,
      selectedLevel,
      selectedVariant,
      modifierKg,
      trainingDate,
      notes,
      sets,
    });
  }, [customExerciseName, inputMode, isEditingExistingLog, modifierKg, notes, selectedExerciseId, selectedLevel, selectedVariant, sets, trainingDate, valueMode, weightUnit]);
  const hasPendingEditChanges = Boolean(
    isEditingExistingLog
      && editLogHydrated
      && initialEditSnapshot
      && currentEditSnapshot
      && currentEditSnapshot !== initialEditSnapshot,
  );
  const editorPageTitle = isEditingExistingLog ? "Edit Logged Session" : "Log a Session";
  const editorPageDescription = isEditingExistingLog
    ? "Update or delete this saved workout entry."
    : "A cleaner train-aligned input page with dynamic sets.";
  const isFocusedField = (field: string) => highlightedField === field;
  const getFieldHighlightStyle = (field: string) => (isFocusedField(field)
    ? {
        scrollMarginTop: "5.5rem",
        borderColor: "color-mix(in srgb, var(--forest) 52%, transparent)",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--forest) 18%, transparent) inset, 0 0 22px color-mix(in srgb, var(--forest) 12%, transparent)",
        transition: "border-color 320ms ease, box-shadow 320ms ease, opacity 320ms ease",
      }
    : {
        scrollMarginTop: "5.5rem",
        transition: "border-color 320ms ease, box-shadow 320ms ease, opacity 320ms ease",
      });

  const goToNextPanel = () => {
    if (activePanelIndex >= SESSION_PANELS.length - 1) return;

    setConfirmedPanels((prev) => {
      const canConfirmCurrent =
        (activePanel === "exercise" && hasExerciseChoice)
        || (activePanel === "details" && hasDetailSelection)
        || (activePanel === "format" && hasFormatChoice)
        || ((activePanel === "session" || activePanel === "notes") && hasConfirmedSetEntry);

      if (!canConfirmCurrent || prev.includes(activePanel)) return prev;
      return [...prev, activePanel];
    });

    setHighlightedSetId(null);
    setActivePanel(SESSION_PANELS[activePanelIndex + 1]?.id ?? "review");
  };

  const goToPreviousPanel = () => {
    if (activePanelIndex <= 0) return;
    setHighlightedSetId(null);
    setActivePanel(SESSION_PANELS[activePanelIndex - 1]?.id ?? "exercise");
  };

  const handleCloseOrApply = useCallback(async () => {
    if (saving || deleting) return;

    if (hasPendingEditChanges) {
      await handleSave();
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(returnHref);
    }
  }, [deleting, handleSave, hasPendingEditChanges, returnHref, router, saving]);

  const renderPanelActions = (mode: "next" | "save" = "next") => (
    <div
      className="mt-auto shrink-0 -mx-1 border-t px-2 py-2"
      style={{
        borderTopColor: "color-mix(in srgb, var(--ink-light) 36%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, transparent)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
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
          ← Back
        </GlowButton>

        {mode === "save" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isEditingExistingLog ? (
              <GlowButton
                variant="ghost"
                size="sm"
                disabled={saving || deleting}
                onClick={() => void handleDeleteLoggedSession()}
                className="h-9 min-w-[78px] justify-center rounded-lg px-3"
                style={{
                  borderColor: "color-mix(in srgb, var(--danger) 42%, transparent)",
                  backgroundColor: "transparent",
                  color: "var(--danger-hover)",
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </GlowButton>
            ) : null}
            <GlowButton
              variant="jade"
              size="sm"
              disabled={saving || deleting}
              onClick={() => void handleSave()}
              className="h-9 min-w-[78px] justify-center rounded-lg px-3"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-dark))",
                color: "var(--text-primary)",
              }}
            >
              {saving ? "Saving..." : isEditingExistingLog ? "Update" : "Save"}
            </GlowButton>
          </div>
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
            Next →
          </GlowButton>
        )}
      </div>
    </div>
  );

  return (
    <PageLayout
      title={isEditingExistingLog ? "Edit Session" : "Train Input"}
      subtitle={isEditingExistingLog ? "Edit or delete a saved workout log" : "Fresh training canvas with dynamic sets"}
      mobileContentPaddingClass="p-0 pb-0"
    >
      {loading || !editLogHydrated ? (
        <GlowCard glow="jade" hoverable={false}>
          <p className="py-4 text-center text-sm text-mist-dark">Loading input canvas...</p>
        </GlowCard>
      ) : (
        <div className="flex flex-col px-0" style={{ minHeight: shellMinHeight }}>
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border"
            style={{
              minHeight: shellMinHeight,
              borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
            }}
          >
            <div
              className="sticky top-0 z-10 shrink-0 border-b px-3 py-2.5"
              style={{
                borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={returnHref}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors"
                    style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                    aria-label={isEditingExistingLog ? "Back to workout history" : "Back to train"}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Training Canvas</p>
                    <h2 className="mt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-primary)]">{editorPageTitle}</h2>
                    <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">{editorPageDescription}</p>
                  </div>
                </div>

                {isEditingExistingLog ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDeleteLoggedSession()}
                      disabled={saving || deleting}
                      className="rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                      style={{
                        borderColor: "color-mix(in srgb, var(--danger) 46%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
                        color: "var(--danger-hover)",
                        opacity: saving || deleting ? 0.7 : 1,
                      }}
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCloseOrApply()}
                      disabled={saving || deleting}
                      className="rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                      style={{
                        borderColor: hasPendingEditChanges ? "color-mix(in srgb, var(--forest) 48%, transparent)" : "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                        backgroundColor: hasPendingEditChanges ? "color-mix(in srgb, var(--forest) 12%, transparent)" : "color-mix(in srgb, var(--surface-hover) 36%, transparent)",
                        color: hasPendingEditChanges ? "var(--cloud-white)" : "var(--text-primary)",
                        opacity: saving || deleting ? 0.7 : 1,
                      }}
                    >
                      {saving ? "Applying..." : hasPendingEditChanges ? "Apply Changes" : "Close"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              {message ? (
                <div
                  className="rounded-lg border px-3 py-2 text-[11px]"
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

              <div className="flex min-h-0 flex-1 flex-row gap-2 sm:gap-3 overflow-hidden">
                <aside className="w-[56px] shrink-0 sm:w-[60px]">
                  <div className="flex h-full min-h-0 flex-col items-center py-1">
                    <p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Steps</p>

                    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
                      {SESSION_PANELS.map((panel, index) => {
                        const isActive = activePanel === panel.id;
                        const isComplete = completionByPanel[panel.id];
                        return (
                          <button
                            key={panel.id}
                            type="button"
                            onClick={() => {
                              setHighlightedSetId(null);
                              setActivePanel(panel.id);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-full border text-center transition-all"
                            style={{
                              borderColor: isComplete
                                ? "color-mix(in srgb, var(--forest) 46%, transparent)"
                                : isActive
                                  ? "color-mix(in srgb, var(--accent) 56%, transparent)"
                                  : "color-mix(in srgb, var(--border) 72%, transparent)",
                              backgroundColor: isComplete
                                ? "color-mix(in srgb, var(--forest) 12%, transparent)"
                                : isActive
                                  ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                                  : "transparent",
                              color: isComplete
                                ? "var(--cloud-white)"
                                : isActive
                                  ? "var(--text-primary)"
                                  : "var(--text-muted)",
                              boxShadow: isActive || isComplete ? "0 0 14px color-mix(in srgb, var(--accent) 12%, transparent)" : "none",
                            }}
                            aria-label={panel.label}
                            title={`${index + 1}. ${panel.label}`}
                          >
                            <span className="text-[10px] font-semibold">{index + 1}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
                      style={{
                        border: "1px solid color-mix(in srgb, var(--border) 72%, transparent)",
                        backgroundColor: "transparent",
                        color: "var(--text-muted)",
                      }}
                      aria-label="Reset session"
                      title="Reset session"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-5h-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 9a8 8 0 0 0-13.66-3.66L4 9m16 6-2.34 3.66A8 8 0 0 1 4 15" />
                      </svg>
                    </button>
                  </div>
                </aside>

                <div className="min-w-0 flex min-h-0 flex-1 flex-col pr-0.5">
                  {activePanel === "exercise" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                        <div id="editor-field-session-date" className="rounded-lg px-1 py-1" style={getFieldHighlightStyle("session-date")}>
                          <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Session date</label>
                          <input
                            type="date"
                            value={trainingDate}
                            onChange={(event) => setTrainingDate(event.target.value)}
                            className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                            style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)" }}
                          />
                        </div>

                        {inputMode !== "custom" ? (
                          <>
                            <div className="mt-3 min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Selected exercise</p>
                            </div>

                            <div
                              className="mt-2 flex min-w-0 flex-col rounded-lg px-3 py-2.5"
                              style={{
                                backgroundColor: "color-mix(in srgb, var(--surface) 88%, black)",
                                border: "1px solid color-mix(in srgb, var(--ink-light) 42%, transparent)",
                              }}
                            >
                              <p className="text-[11px] text-[color:var(--text-secondary)]">Selected movement</p>
                              {isEditingExistingLog ? (
                                <select
                                  value={selectedExerciseId}
                                  onChange={(event) => {
                                    const nextExercise = exercises.find((exercise) => exercise.id === event.target.value);
                                    if (nextExercise) {
                                      handleSelectExercise(nextExercise);
                                    }
                                  }}
                                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none"
                                  style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)" }}
                                >
                                  <option value="" disabled>Select a parent exercise</option>
                                  {exercises
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((exercise) => (
                                      <option key={exercise.id} value={exercise.id}>
                                        {exercise.name}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <p className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">{selectedExercise?.name || customExerciseName || "No exercise selected"}</p>
                              )}
                              <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">{selectedExerciseMeta}</p>
                            </div>
                          </>
                        ) : null}

                        {inputMode === "custom" ? (
                          <div className="mt-3">
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Custom exercise name</label>
                            <div className="rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--forest) 46%, transparent)", backgroundColor: "color-mix(in srgb, var(--forest) 10%, transparent)" }}>
                              <input
                                type="text"
                                value={customExerciseName}
                                onChange={(event) => setCustomExerciseName(event.target.value)}
                                placeholder="Type the exercise name you want"
                                className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                                style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)" }}
                              />
                              <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                                When you save this workout, the exercise will appear in the pending section of Exercise DB where admins can review, edit, and approve it.
                              </p>
                            </div>
                          </div>
                        ) : null}

                      </div>

                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "details" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Exercise setup</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Choose progression and variant</p>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div id="editor-field-progression" className="rounded-lg px-1 py-1" style={getFieldHighlightStyle("progression")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Progression</label>
                            <select
                              value={selectedLevel}
                              onChange={(event) => setSelectedLevel(event.target.value)}
                              disabled={inputMode !== "existing" || !selectedExercise}
                              className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                              style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)", opacity: inputMode !== "existing" || !selectedExercise ? 0.6 : 1 }}
                            >
                              {(selectedExercise?.tiers.length ? selectedExercise.tiers : [{ level: 1, name: "Progression 1" }]).map((tier) => (
                                <option key={`${tier.level}-${tier.name}`} value={String(tier.level)}>
                                  {tier.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div id="editor-field-variation" className="rounded-lg px-1 py-1" style={getFieldHighlightStyle("variation")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Variant</label>
                            <select
                              value={selectedVariant}
                              onChange={(event) => setSelectedVariant(event.target.value)}
                              disabled={inputMode !== "existing" || !selectedExercise}
                              className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                              style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)", opacity: inputMode !== "existing" || !selectedExercise ? 0.6 : 1 }}
                            >
                              <option value="">Default</option>
                              {(selectedExercise?.variations || []).map((variation) => (
                                <option key={variation.id} value={variation.name}>
                                  {variation.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "format" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Session format</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Select log style</p>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setValueMode("weight")}
                            className="rounded-xl border px-3 py-3 text-left transition-colors"
                            style={{
                              borderColor: valueMode === "weight" ? "color-mix(in srgb, var(--accent) 60%, transparent)" : "color-mix(in srgb, var(--border) 80%, transparent)",
                              backgroundColor: valueMode === "weight" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-dark))" : "color-mix(in srgb, var(--surface-hover) 60%, var(--surface))",
                              color: valueMode === "weight" ? "var(--text-primary)" : "var(--text-secondary)",
                              boxShadow: valueMode === "weight" ? "0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent) inset" : "none",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                style={{ backgroundColor: valueMode === "weight" ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "color-mix(in srgb, var(--cloud-white) 5%, transparent)" }}
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 9h11" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 9.5V14a2 2 0 0 0 2 2h1.5V8H6a2 2 0 0 0-2 1.5Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 9.5V14a2 2 0 0 1-2 2h-1.5V8H18a2 2 0 0 1 2 1.5Z" />
                                </svg>
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">Weight</span>
                                <span className="mt-0.5 block text-[10px] text-[color:var(--text-muted)]">Load and reps</span>
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setValueMode("timed")}
                            className="rounded-xl border px-3 py-3 text-left transition-colors"
                            style={{
                              borderColor: valueMode === "timed" ? "color-mix(in srgb, var(--accent) 60%, transparent)" : "color-mix(in srgb, var(--border) 80%, transparent)",
                              backgroundColor: valueMode === "timed" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-dark))" : "color-mix(in srgb, var(--surface-hover) 60%, var(--surface))",
                              color: valueMode === "timed" ? "var(--text-primary)" : "var(--text-secondary)",
                              boxShadow: valueMode === "timed" ? "0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent) inset" : "none",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                style={{ backgroundColor: valueMode === "timed" ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "color-mix(in srgb, var(--cloud-white) 5%, transparent)" }}
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <circle cx="12" cy="13" r="7" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4l2.5 1.5" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6" />
                                </svg>
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">Timed</span>
                                <span className="mt-0.5 block text-[10px] text-[color:var(--text-muted)]">Seconds and holds</span>
                              </span>
                            </div>
                          </button>
                        </div>

                        {valueMode === "timed" ? (
                          <div
                            className="mt-3 rounded-lg border px-3 py-2 text-[11px]"
                            style={{
                              borderColor: "color-mix(in srgb, var(--jade-glow) 36%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--jade-glow) 8%, var(--ink-dark))",
                              color: "var(--text-secondary)",
                            }}
                          >
                            Timed entries will be saved in seconds.
                          </div>
                        ) : (
                          <div className="mt-3 max-w-[320px]">
                            <p className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Input unit</p>
                            <p className="mb-2 text-[11px] text-[color:var(--text-secondary)]">Machine values logged in lbs or kg will be converted to your preferred unit from settings.</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setWeightUnit("kg")}
                                className="rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all"
                                style={{
                                  borderColor: weightUnit === "kg" ? "color-mix(in srgb, var(--accent) 64%, transparent)" : "color-mix(in srgb, var(--border) 78%, transparent)",
                                  backgroundColor: weightUnit === "kg" ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                                  color: weightUnit === "kg" ? "var(--text-primary)" : "var(--text-secondary)",
                                  boxShadow: weightUnit === "kg" ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), inset 0 0 12px color-mix(in srgb, var(--accent) 16%, transparent)" : "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                                }}
                              >
                                Kilograms (kg)
                              </button>
                              <button
                                type="button"
                                onClick={() => setWeightUnit("lbs")}
                                className="rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all"
                                style={{
                                  borderColor: weightUnit === "lbs" ? "color-mix(in srgb, var(--accent) 64%, transparent)" : "color-mix(in srgb, var(--border) 78%, transparent)",
                                  backgroundColor: weightUnit === "lbs" ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                                  color: weightUnit === "lbs" ? "var(--text-primary)" : "var(--text-secondary)",
                                  boxShadow: weightUnit === "lbs" ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), inset 0 0 12px color-mix(in srgb, var(--accent) 16%, transparent)" : "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                                }}
                              >
                                Pounds (lbs)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "session" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                        <div className="space-y-3">
                          {valueMode === "weight" ? (
                            <div
                              id="editor-field-modifier"
                              className="rounded-xl border px-3 py-3"
                              style={{
                                ...getFieldHighlightStyle("modifier"),
                                borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--surface-hover) 68%, var(--surface))",
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Weight modifier</p>
                                  <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Assist or add load</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <span
                                    className="min-w-[84px] rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold text-[color:var(--text-primary)]"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--accent) 36%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                                    }}
                                  >
                                    {modifierKg === 0 ? "None" : formatSignedModifierKg(modifierKg)}
                                  </span>
                                  {modifierKg !== 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setModifierKg(0)}
                                      className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                                      style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))", color: "var(--text-secondary)" }}
                                    >
                                      Reset
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-3 rounded-xl px-2.5 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                                <input
                                  type="range"
                                  min="-50"
                                  max="50"
                                  step="0.5"
                                  value={modifierKg}
                                  onChange={(event) => setModifierKg(Number(event.target.value))}
                                  className="h-1.5 w-full cursor-pointer accent-[var(--jade-glow)]"
                                  aria-label="Weight modifier slider"
                                />
                                <div className="mt-2 flex items-center justify-between text-[9px] text-[color:var(--text-muted)]">
                                  <span>-50kg</span>
                                  <span>0</span>
                                  <span>+50kg</span>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))" }}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Sets</p>
                                <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Start with one set and add more as you go</p>
                              </div>
                              <GlowButton
                                variant="jade"
                                size="sm"
                                onClick={addSetRow}
                                className="h-9 rounded-xl px-3 transition-all"
                                style={(() => {
                                  const currentSet = sets.find((set) => set.id === expandedSetId) ?? sets[sets.length - 1];
                                  const ready = Boolean(currentSet && currentSet.value.trim() && currentSet.reps.trim());
                                  return ready
                                    ? {
                                        boxShadow:
                                          "0 0 0 1px color-mix(in srgb, var(--jade-glow) 72%, transparent) inset, 0 0 14px color-mix(in srgb, var(--jade-glow) 55%, transparent), 0 0 26px color-mix(in srgb, var(--jade-glow) 32%, transparent)",
                                      }
                                    : { boxShadow: "0 0 0 1px rgba(88,101,242,0.14) inset" };
                                })()}
                              >
                                + Add Set
                              </GlowButton>
                            </div>

                            <div className="mt-3 space-y-2.5">
                              {sets.map((set, index) => {
                                const isExpanded = expandedSetId === set.id;
                                const setSummary = set.value || set.reps
                                  ? `${set.value || "—"} ${valueMode === "timed" ? "sec" : weightUnit} · ${set.reps || "—"} reps`
                                  : "Tap to continue this set";

                                return (
                                  <div
                                    key={set.id}
                                    id={`editor-field-set-${index + 1}`}
                                    className="rounded-xl border px-3 py-3 transition-all duration-700"
                                    style={{
                                      scrollMarginTop: "5.5rem",
                                      borderColor: set.id === highlightedSetId || isFocusedField(`set-${index + 1}`) || isExpanded
                                        ? "color-mix(in srgb, var(--forest) 46%, transparent)"
                                        : "color-mix(in srgb, var(--border) 76%, transparent)",
                                      background: set.id === highlightedSetId || isExpanded
                                        ? "linear-gradient(180deg, color-mix(in srgb, var(--forest) 6%, transparent), color-mix(in srgb, var(--surface) 96%, var(--surface-hover)))"
                                        : "linear-gradient(180deg, color-mix(in srgb, var(--surface-hover) 82%, var(--surface)), color-mix(in srgb, var(--surface) 96%, black))",
                                      boxShadow: set.id === highlightedSetId || isFocusedField(`set-${index + 1}`) || isExpanded
                                        ? "0 0 0 1px color-mix(in srgb, var(--forest) 12%, transparent), 0 0 16px color-mix(in srgb, var(--forest) 6%, transparent)"
                                        : "none",
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedSetId(set.id)}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                      >
                                        <span
                                          className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-[color:var(--text-primary)]"
                                          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 24%, transparent)" }}
                                        >
                                          Set {index + 1}
                                        </span>
                                        <span className="truncate text-[10px] text-[color:var(--text-muted)]">{setSummary}</span>
                                      </button>

                                      <div className="flex items-center gap-2">
                                        {!isExpanded ? (
                                          <button
                                            type="button"
                                            onClick={() => setExpandedSetId(set.id)}
                                            className="rounded-full border px-2.5 py-1 text-[10px] font-medium"
                                            style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))", color: "var(--text-secondary)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent)" }}
                                          >
                                            Edit
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => removeSetRow(set.id)}
                                          disabled={sets.length <= 1}
                                          className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all"
                                          style={{
                                            borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                                            backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                                            color: sets.length <= 1 ? "color-mix(in srgb, var(--text-muted) 72%, transparent)" : "var(--text-secondary)",
                                            opacity: sets.length <= 1 ? 0.45 : 0.96,
                                            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                                          }}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>

                                    {isExpanded ? (
                                      <div className="mt-3 grid grid-cols-2 gap-2">
                                        <label className="block">
                                          <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                                            {valueMode === "timed" ? "Seconds" : "Weight"}
                                          </span>
                                          <input
                                            type="number"
                                            min="0"
                                            step={valueMode === "timed" ? "1" : "0.5"}
                                            value={set.value}
                                            onChange={(event) => updateSetRow(set.id, "value", event.target.value)}
                                            placeholder={setValuePlaceholder}
                                            className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                            style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)" }}
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Reps</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={set.reps}
                                            onChange={(event) => updateSetRow(set.id, "reps", event.target.value)}
                                            placeholder="reps"
                                            className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                            style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)" }}
                                          />
                                        </label>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                          </div>
                        </div>
                      </div>

                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "notes" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div
                        id="editor-field-notes"
                        className="flex min-h-0 flex-1 flex-col rounded-xl p-1"
                        style={getFieldHighlightStyle("notes")}
                      >
                        <div className="shrink-0">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Notes</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Session notes</p>
                        </div>

                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={8}
                          placeholder="Anything important from this session..."
                          className="mt-3 min-h-[220px] flex-1 w-full resize-none rounded-lg border px-3 py-2.5 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                          style={{
                            borderColor: "color-mix(in srgb, var(--ink-light) 52%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--surface) 88%, black)",
                          }}
                        />

                      </div>

                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "review" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                        <div
                          className="rounded-2xl border px-3 py-3"
                          style={{
                            borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border))",
                            background: "linear-gradient(180deg, color-mix(in srgb, var(--surface-hover) 78%, var(--surface)) 0%, color-mix(in srgb, var(--surface) 96%, black) 100%)",
                          }}
                        >
                          <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Review</p>
                          <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">Ready for final save</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Everything is filled out and prepared for submission.</p>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Exercise</p>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{selectedExerciseLabel}</p>
                          </div>
                          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Progression</p>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{selectedProgressionLabel}</p>
                          </div>
                          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Variation</p>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{selectedVariant || "Default"}</p>
                          </div>
                          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Date</p>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{trainingDate}</p>
                          </div>
                          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Format</p>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                              {valueMode === "timed" ? "Timed session" : `Weight · ${weightUnit === "kg" ? "Kilograms (kg)" : "Pounds (lbs)"}`}
                            </p>
                          </div>
                          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))" }}>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Modifier</p>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                              {valueMode === "weight" && modifierKg !== 0 ? formatSignedModifierKg(modifierKg) : "No modifier"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 58%, var(--surface))" }}>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Working sets</p>
                          <div className="mt-2 space-y-2">
                            {reviewSetPreview.length ? reviewSetPreview.map((set) => (
                              <div key={set.label} className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                                <p className="text-[11px] text-[color:var(--text-secondary)]">
                                  <span className="font-semibold text-[color:var(--text-primary)]">{set.label}</span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">{set.summary}</p>
                              </div>
                            )) : (
                              <p className="text-[11px] text-[color:var(--text-secondary)]">No sets added yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 58%, var(--surface))" }}>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Session notes</p>
                          <p className="mt-2 text-[11px] leading-5 text-[color:var(--text-secondary)]">{notes.trim() || "No notes added for this session."}</p>
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
