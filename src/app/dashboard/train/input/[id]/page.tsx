"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import {
  buildIsoAtUserDateTime,
  getTodayInTimeZone,
  parseDayAssignmentDetailsList,
  parseDayAssignments,
  serializeDayAssignmentPayload,
} from "@/lib/constants";
import { PROGRESSION_EXERCISES_UPDATED_EVENT } from "@/lib/progression-events";
import { api, ApiRequestError } from "@/lib/api-client";
import { translateEnglishToLanguage } from "@/lib/language";
import { kgToLbs, lbsToKg, type TimedUnitPref } from "@/lib/unit-conversion";
import type { ProgressionExercise, ProgressionLog } from "@/app/dashboard/workout/types";

type InputMode = "existing" | "custom";
type ValueMode = "weight" | "timed";
type TimedUnit = TimedUnitPref;
type WeightUnit = "kg" | "lbs";
type SessionPanelId = "exercise" | "details" | "format" | "session" | "notes" | "review";
type SetRow = { id: string; value: string; reps: string };
type ValidationState = {
  exercise?: string;
  customExerciseName?: string;
  setMessage?: string;
  invalidSetIds: string[];
};
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
  setupOption: string | null;
  notes: string | null;
  createdAt: string;
};

const SESSION_PANEL_IDS: SessionPanelId[] = ["exercise", "details", "format", "session", "notes", "review"];

function createSetRow(seed: number): SetRow {
  return { id: `set-${Date.now()}-${seed}`, value: "", reps: "" };
}

function createInitialSets(): SetRow[] {
  return [createSetRow(1)];
}

function getTodayInputValue(timeZone?: string): string {
  return getTodayInTimeZone(timeZone);
}

function buildCreatedAtFromDateInput(dateInput: string, timeZone?: string): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : getTodayInputValue(timeZone);
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

function formatTimedInputSeconds(seconds: number | null, unit: "seconds" | "minutes"): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const value = unit === "minutes" ? seconds / 60 : seconds;
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
  timedUnit: TimedUnit;
  selectedExerciseId: string;
  customExerciseName: string;
  selectedLevel: string;
  selectedVariant: string;
  selectedSetupOption: string;
  modifierKg: number;
  trainingDate: string;
  notes: string;
  sets: SetRow[];
}): string {
  return JSON.stringify({
    inputMode: input.inputMode,
    valueMode: input.valueMode,
    weightUnit: input.weightUnit,
    timedUnit: input.timedUnit,
    selectedExerciseId: input.selectedExerciseId,
    customExerciseName: input.customExerciseName.trim(),
    selectedLevel: input.selectedLevel || "",
    selectedVariant: input.selectedVariant || "",
    selectedSetupOption: input.selectedSetupOption || "",
    modifierKg: Math.round(input.modifierKg * 10) / 10,
    trainingDate: input.trainingDate,
    notes: input.notes.trim(),
    sets: normalizeEditableSetRows(input.sets),
  });
}

function parseExistingNotesAndExtraSets(input: {
  notes: string | null | undefined;
  isTimedMode: boolean;
  timedUnit: TimedUnit;
  weightUnit: WeightUnit;
  logId: string;
}): { baseNotes: string; extraSets: SetRow[] } {
  const rawNotes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (!rawNotes) {
    return { baseNotes: "", extraSets: [] };
  }

  const marker = "\n\nExtra sets:";
  const markerIndex = rawNotes.indexOf(marker);
  const startsWithMarker = rawNotes.startsWith("Extra sets:");
  const baseNotes = markerIndex >= 0
    ? rawNotes.slice(0, markerIndex).trim()
    : startsWithMarker
      ? ""
      : rawNotes;

  const summarySource = markerIndex >= 0
    ? rawNotes.slice(markerIndex + marker.length).trim()
    : startsWithMarker
      ? rawNotes.slice("Extra sets:".length).trim()
      : "";

  if (!summarySource) {
    return { baseNotes, extraSets: [] };
  }

  const extraSets = summarySource
    .split(" | ")
    .map((entry, index) => {
      const match = entry.match(/^Set\s+\d+:\s*(.*?)\s*\/\s*(.*?)$/i);
      if (!match) return null;

      const rawValueLabel = match[1]?.trim() ?? "";
      const rawRepsLabel = match[2]?.trim() ?? "";

      let nextValue = "";
      if (rawValueLabel && rawValueLabel !== "-") {
        if (input.isTimedMode) {
          const secondsMatch = rawValueLabel.match(/^([+-]?[\d.]+)\s*s$/i);
          const parsedSeconds = secondsMatch ? Number.parseFloat(secondsMatch[1]) : Number.parseFloat(rawValueLabel);
          if (Number.isFinite(parsedSeconds)) {
            nextValue = formatTimedInputSeconds(parsedSeconds, input.timedUnit);
          }
        } else {
          const kgMatch = rawValueLabel.match(/^([+-]?[\d.]+)\s*kg$/i);
          const parsedKg = kgMatch ? Number.parseFloat(kgMatch[1]) : Number.parseFloat(rawValueLabel);
          if (Number.isFinite(parsedKg)) {
            const displayValue = input.weightUnit === "lbs" ? kgToLbs(parsedKg) : parsedKg;
            nextValue = formatInputNumber(displayValue);
          }
        }
      }

      const repsMatch = rawRepsLabel.match(/^([+-]?\d+)/);
      const parsedReps = repsMatch ? Number.parseInt(repsMatch[1], 10) : Number.NaN;
      const nextReps = Number.isFinite(parsedReps) ? String(Math.max(0, parsedReps)) : "";

      return {
        id: `${input.logId}-set-extra-${index + 4}`,
        value: nextValue,
        reps: nextReps,
      } satisfies SetRow;
    })
    .filter((entry): entry is SetRow => Boolean(entry));

  return { baseNotes, extraSets };
}

export default function TrainInputCanvasPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);
  const sessionPanels: Array<{ id: SessionPanelId; label: string; description: string }> = [
    { id: "exercise", label: lt("Exercise"), description: lt("Pick what you trained") },
    { id: "details", label: lt("Details"), description: lt("Level and variation") },
    { id: "format", label: lt("Format"), description: lt("Weight or time") },
    { id: "session", label: lt("Session"), description: lt("Date and sets") },
    { id: "notes", label: lt("Notes"), description: lt("Optional notes") },
    { id: "review", label: lt("Review"), description: lt("Check and save") },
  ];
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
  const assignedDayParam = searchParams.get("assignedDay");
  const assignedDayIndex = assignedDayParam !== null && assignedDayParam !== "" ? Number(assignedDayParam) : null;
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
  const assignedDayName = assignedDayIndex != null && assignedDayIndex >= 0 && assignedDayIndex <= 6 ? DAY_NAMES[assignedDayIndex] : null;
  // True only when opened from day assignment flow (explicit assignedDay in query)
  const hasAssignedDay = assignedDayName !== null;
  const isDayAssignment = hasAssignedDay && Boolean(prefillExerciseId || prefillExerciseName);

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingFromDay, setRemovingFromDay] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editLogHydrated, setEditLogHydrated] = useState(!editLogId);
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>(prefillCustomExercise ? "custom" : "existing");
  const [valueMode, setValueMode] = useState<ValueMode>("weight");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(settings.defaultWeightUnit === "lbs" ? "lbs" : "kg");
  const [timedUnit, setTimedUnit] = useState<TimedUnit>(settings.defaultTimedUnit === "minutes" ? "minutes" : "seconds");
  const [searchTerm, setSearchTerm] = useState(prefillExerciseName);
  const [selectedExerciseId, setSelectedExerciseId] = useState(prefillExerciseId);
  const [customExerciseName, setCustomExerciseName] = useState(prefillExerciseName);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(prefillVariant);
  const [selectedSetupOption, setSelectedSetupOption] = useState("");
  const [modifierKg, setModifierKg] = useState(0);
  const [isModifierPanelOpen, setIsModifierPanelOpen] = useState(false);
  const [trainingDate, setTrainingDate] = useState(getTodayInputValue(settings.timeZone));
  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState<SetRow[]>(createInitialSets);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SessionPanelId>("exercise");
  const [highlightedSetId, setHighlightedSetId] = useState<string | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [confirmedPanels, setConfirmedPanels] = useState<SessionPanelId[]>([]);
  const [validation, setValidation] = useState<ValidationState>({ invalidSetIds: [] });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const previousTimedUnitRef = useRef<TimedUnit>(timedUnit);
  const prefillStepperInitializedRef = useRef(false);
  const stepParam = searchParams.get("step");
  const fieldParam = searchParams.get("field");

  useEffect(() => {
    setWeightUnit(settings.defaultWeightUnit === "lbs" ? "lbs" : "kg");
  }, [settings.defaultWeightUnit]);

  useEffect(() => {
    setTimedUnit(settings.defaultTimedUnit === "minutes" ? "minutes" : "seconds");
  }, [settings.defaultTimedUnit]);

  useEffect(() => {
    const previousUnit = previousTimedUnitRef.current;
    if (previousUnit === timedUnit) return;

    if (valueMode === "timed") {
      setSets((current) => current.map((set) => {
        const parsed = parseNumber(set.value);
        if (parsed == null) return set;
        const seconds = previousUnit === "minutes" ? parsed * 60 : parsed;
        const converted = timedUnit === "minutes" ? seconds / 60 : seconds;
        return { ...set, value: formatInputNumber(converted) };
      }));
    }

    previousTimedUnitRef.current = timedUnit;
  }, [timedUnit, valueMode]);

  // Persist in-progress new logs to localStorage so a refresh doesn't wipe them.
  // Edit mode is intentionally skipped — server fetch already restores data there.
  // Key intentionally omits userId (which loads asynchronously); this is a per-device
  // draft for the new-log flow only and is cleared on save/delete.
  const draftKey = useMemo(() => {
    if (editLogId) return null;
    return `train.input.draft.v1.${routeExerciseId || "blank"}`;
  }, [editLogId, routeExerciseId]);

  const [draftHydrated, setDraftHydrated] = useState(false);

  const clearDraft = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) {
      setDraftHydrated(true);
      return;
    }
    if (typeof window === "undefined") {
      setDraftHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) {
        setDraftHydrated(true);
        return;
      }
      const draft = JSON.parse(raw) as Partial<{
        inputMode: InputMode;
        valueMode: ValueMode;
        weightUnit: WeightUnit;
        timedUnit: TimedUnit;
        searchTerm: string;
        selectedExerciseId: string;
        customExerciseName: string;
        selectedLevel: string;
        selectedVariant: string;
        modifierKg: number;
        trainingDate: string;
        notes: string;
        sets: SetRow[];
        activePanel: SessionPanelId;
        confirmedPanels: SessionPanelId[];
      }>;
      if (draft.inputMode === "existing" || draft.inputMode === "custom") setInputMode(draft.inputMode);
      if (draft.valueMode === "weight" || draft.valueMode === "timed") setValueMode(draft.valueMode);
      if (draft.weightUnit === "kg" || draft.weightUnit === "lbs") setWeightUnit(draft.weightUnit);
        if (draft.timedUnit === "seconds" || draft.timedUnit === "minutes") setTimedUnit(draft.timedUnit);
      if (typeof draft.searchTerm === "string") setSearchTerm(draft.searchTerm);
      if (typeof draft.selectedExerciseId === "string") setSelectedExerciseId(draft.selectedExerciseId);
      if (typeof draft.customExerciseName === "string") setCustomExerciseName(draft.customExerciseName);
      // When the user just picked a fresh exercise via the + flow (URL carries prefill params),
      // ignore any persisted sets/activePanel/confirmedPanels — always restart the stepper at
      // "exercise" with empty inputs so prior values render only as placeholder hints.
      // Also skip restoring selectedLevel/selectedVariant so the prefill params always win.
      const arrivedFromPicker = Boolean(prefillExerciseId || prefillExerciseName || prefillCustomExercise);
      if (arrivedFromPicker) {
        // Freshly picked workout logs should always default to today's local date.
        setTrainingDate(getTodayInputValue(settings.timeZone));
      }
      if (!arrivedFromPicker) {
        if (typeof draft.selectedLevel === "string") setSelectedLevel(draft.selectedLevel);
        if (typeof draft.selectedVariant === "string") setSelectedVariant(draft.selectedVariant);
      }
      if (typeof draft.modifierKg === "number" && Number.isFinite(draft.modifierKg)) {
        setModifierKg(draft.modifierKg);
        setIsModifierPanelOpen(draft.modifierKg !== 0);
      }
      if (!arrivedFromPicker && typeof draft.trainingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(draft.trainingDate)) {
        setTrainingDate(draft.trainingDate);
      }
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (!arrivedFromPicker) {
        if (Array.isArray(draft.sets) && draft.sets.length) {
          const restored = draft.sets
            .filter((set): set is SetRow => Boolean(set) && typeof set.id === "string" && typeof set.value === "string" && typeof set.reps === "string")
            .map((set) => ({ id: set.id, value: set.value, reps: set.reps }));
          if (restored.length) setSets(restored);
        }
        if (draft.activePanel && SESSION_PANEL_IDS.some((panelId) => panelId === draft.activePanel)) {
          setActivePanel(draft.activePanel);
        }
        if (Array.isArray(draft.confirmedPanels)) {
          setConfirmedPanels(draft.confirmedPanels.filter((id): id is SessionPanelId => SESSION_PANEL_IDS.some((panelId) => panelId === id)));
        }
      }
    } catch (err) {
      console.warn("Failed to restore log draft:", err);
    } finally {
      setDraftHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    if (!draftHydrated) return;
    if (typeof window === "undefined") return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            inputMode,
            valueMode,
            weightUnit,
            timedUnit,
            searchTerm,
            selectedExerciseId,
            customExerciseName,
            selectedLevel,
            selectedVariant,
            modifierKg,
            trainingDate,
            notes,
            sets,
            activePanel,
            confirmedPanels,
          }),
        );
      } catch {
        /* ignore quota / private mode */
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [
    draftKey,
    draftHydrated,
    inputMode,
    valueMode,
    weightUnit,
    timedUnit,
    searchTerm,
    selectedExerciseId,
    customExerciseName,
    selectedLevel,
    selectedVariant,
    modifierKg,
    trainingDate,
    notes,
    sets,
    activePanel,
    confirmedPanels,
  ]);

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
    if (!stepParam) return;
    if (SESSION_PANEL_IDS.some((panelId) => panelId === stepParam)) {
      setActivePanel(stepParam as SessionPanelId);
    }
  }, [stepParam]);

  useEffect(() => {
    const field = fieldParam;
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
  }, [fieldParam, sets.length]);

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
        const nextSelectedSetupOption = log.setupOption || "";
        const nextModifierKg = parseSignedModifierKg(log.modifier) ?? 0;
        const nextTrainingDate = new Date(log.createdAt).toISOString().slice(0, 10);
        const nextValueMode: ValueMode = usesTimedMetrics ? "timed" : "weight";
        const primarySets = [
          {
            id: `${log.id}-set-1`,
            value: usesTimedMetrics ? formatTimedInputSeconds(log.holdTime, timedUnit) : displayWeight(log.weight1),
            reps: log.reps1 != null ? String(log.reps1) : "",
          },
          {
            id: `${log.id}-set-2`,
            value: usesTimedMetrics ? formatTimedInputSeconds(log.holdTime2, timedUnit) : displayWeight(log.weight2),
            reps: log.reps2 != null ? String(log.reps2) : "",
          },
          {
            id: `${log.id}-set-3`,
            value: usesTimedMetrics ? formatTimedInputSeconds(log.holdTime3, timedUnit) : displayWeight(log.weight3),
            reps: log.reps3 != null ? String(log.reps3) : "",
          },
        ];
        const parsedExtra = parseExistingNotesAndExtraSets({
          notes: log.notes,
          isTimedMode: usesTimedMetrics,
          timedUnit,
          weightUnit,
          logId: log.id,
        });
        const nextNotes = parsedExtra.baseNotes;
        const nextSets = [...primarySets, ...parsedExtra.extraSets];

        setInputMode(nextInputMode);
        setSelectedExerciseId(nextSelectedExerciseId);
        setSearchTerm(nextSearchTerm);
        setCustomExerciseName(nextCustomExerciseName);
        setSelectedLevel(nextSelectedLevel);
        setSelectedVariant(nextSelectedVariant);
        setSelectedSetupOption(nextSelectedSetupOption);
        setModifierKg(nextModifierKg);
        setIsModifierPanelOpen(nextModifierKg !== 0);
        setTrainingDate(nextTrainingDate);
        setNotes(nextNotes);
        setValueMode(nextValueMode);
        setSets(nextSets);
        setValidation({ invalidSetIds: [] });
        setInitialEditSnapshot(buildEditSnapshot({
          inputMode: nextInputMode,
          valueMode: nextValueMode,
          weightUnit,
          timedUnit,
          selectedExerciseId: nextSelectedExerciseId,
          customExerciseName: nextCustomExerciseName,
          selectedLevel: nextSelectedLevel,
          selectedVariant: nextSelectedVariant,
          selectedSetupOption: nextSelectedSetupOption,
          modifierKg: nextModifierKg,
          trainingDate: nextTrainingDate,
          notes: nextNotes,
          sets: nextSets,
        }));
      } catch (error) {
        console.error("Failed to load existing training log:", error);
        if (!cancelled) {
          setMessage({ type: "error", text: lt("Failed to load this logged session.") });
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
  }, [editLogId, timedUnit, weightUnit]);

  const fetchExercises = useCallback(async () => {
    if (!userId) {
      setExercises([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions/history?logLimit=200&exerciseLimit=5000");
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

  const canQuickRemoveFromAssignedDay = Boolean(
    !isEditingExistingLog
      && isDayAssignment
      && assignedDayIndex != null
      && assignedDayIndex >= 0
      && assignedDayIndex <= 6
      && selectedExercise,
  );

  const handleQuickRemoveFromAssignedDay = useCallback(async () => {
    if (!canQuickRemoveFromAssignedDay || !selectedExercise || assignedDayIndex == null) return;
    if (saving || deleting || removingFromDay) return;

    const existingAssignedDays = parseDayAssignments(selectedExercise.assignedDays || "");
    if (!existingAssignedDays.includes(assignedDayIndex)) {
      setMessage({ type: "success", text: `${selectedExercise.name} ${lt("is not assigned to")} ${assignedDayName || lt("this day")}.` });
      return;
    }

    const confirmed = window.confirm(`${lt("Remove")} ${selectedExercise.name} ${lt("from")} ${assignedDayName || lt("this day")}?`);
    if (!confirmed) return;

    const days = new Set(existingAssignedDays);
    const details = parseDayAssignmentDetailsList(selectedExercise.assignedDays || "");
    days.delete(assignedDayIndex);
    delete details[assignedDayIndex];

    const payload = serializeDayAssignmentPayload(Array.from(days), details);

    setRemovingFromDay(true);
    setMessage(null);
    try {
      const response = await api.patch<{ exercise?: ProgressionExercise }>(
        `/api/progressions/${selectedExercise.id}`,
        { assignedDays: payload },
      );

      const returnedExercise = response.exercise;
      if (returnedExercise) {
        setExercises((prev) => {
          const index = prev.findIndex((exercise) => exercise.id === selectedExercise.id);
          if (index === -1) return prev;

          const next = [...prev];
          const duplicateIndex = next.findIndex((exercise) => exercise.id === returnedExercise.id);
          if (duplicateIndex !== -1 && duplicateIndex !== index) {
            next.splice(duplicateIndex, 1);
          }
          next[index] = returnedExercise;
          return next;
        });
        setSelectedExerciseId(returnedExercise.id);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(PROGRESSION_EXERCISES_UPDATED_EVENT));
      }

      setMessage({ type: "success", text: `${lt("Removed from")} ${assignedDayName || lt("day")}.` });
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push(returnHref);
      }
    } catch (error) {
      console.error("Failed to remove day assignment:", error);
      setMessage({ type: "error", text: lt("Failed to remove from day. Please try again.") });
    } finally {
      setRemovingFromDay(false);
    }
  }, [assignedDayIndex, assignedDayName, canQuickRemoveFromAssignedDay, deleting, removingFromDay, returnHref, router, saving, selectedExercise]);

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

    setSelectedSetupOption((prev) => {
      const options = (selectedExercise.modifiers ?? [])
        .map((modifier) => String(modifier.type || "").trim())
        .filter(Boolean);
      if (prev && options.includes(prev)) return prev;
      return "";
    });
  }, [exercises, prefillCustomExercise, prefillExerciseId, prefillExerciseName, prefillProgression, prefillVariant, selectedExercise]);

  useEffect(() => {
    if (prefillStepperInitializedRef.current) return;
    if (editLogId) return;
    if (prefillCustomExercise) return;
    if (!isDayAssignment) return;
    if (!prefillExerciseId && !prefillExerciseName) return;
    if (!selectedExerciseId) return;
    if (!selectedLevel) return;

    setConfirmedPanels((prev) => {
      const next = new Set<SessionPanelId>(prev);
      next.add("exercise");
      next.add("details");
      return Array.from(next);
    });

    setActivePanel((prev) => (prev === "exercise" ? "format" : prev));
    prefillStepperInitializedRef.current = true;
  }, [editLogId, isDayAssignment, prefillCustomExercise, prefillExerciseId, prefillExerciseName, selectedExerciseId, selectedLevel]);

  const addSetRow = () => {
    setSets((prev) => {
      const nextSet = createSetRow(prev.length + 1);
      setExpandedSetId(nextSet.id);
      setHighlightedSetId(nextSet.id);
      return [...prev, nextSet];
    });
    setValidation((prev) => ({ ...prev, setMessage: undefined, invalidSetIds: [] }));
  };

  const updateSetRow = (id: string, field: "value" | "reps", value: string) => {
    setHighlightedSetId(null);
    setExpandedSetId(id);
    setSets((prev) => prev.map((set) => (set.id === id ? { ...set, [field]: value } : set)));
    setValidation((prev) => ({ ...prev, setMessage: undefined, invalidSetIds: prev.invalidSetIds.filter((setId) => setId !== id) }));
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
    setValidation((prev) => ({ ...prev, setMessage: undefined, invalidSetIds: prev.invalidSetIds.filter((setId) => setId !== id) }));
  };

  const resetForm = () => {
    setMessage(null);
    setValidation({ invalidSetIds: [] });
    setInputMode("existing");
    setValueMode("weight");
    setSearchTerm("");
    setSelectedExerciseId("");
    setCustomExerciseName("");
    setSelectedLevel("");
    setSelectedVariant("");
    setSelectedSetupOption("");
    setModifierKg(0);
    setIsModifierPanelOpen(false);
    setTrainingDate(getTodayInputValue(settings.timeZone));
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
    setValidation((prev) => ({ ...prev, exercise: undefined, customExerciseName: undefined }));
  };

  const handleStartCustomExercise = (prefillName = "") => {
    setInputMode("custom");
    setSelectedExerciseId("");
    setSearchTerm("");
    setCustomExerciseName(prefillName.trim());
    setSelectedLevel("1");
    setSelectedVariant("");
    setSelectedSetupOption("");
    setMessage(null);
    setValidation((prev) => ({ ...prev, exercise: undefined, customExerciseName: undefined }));
  };

  const handleSave = useCallback(async () => {
    if (saving || deleting) return;

    const normalizedExerciseId = selectedExerciseId.trim();
    const normalizedCustomExerciseName = customExerciseName.trim();

    if (inputMode === "existing" && !normalizedExerciseId) {
      setActivePanel("exercise");
      setValidation({
        exercise: lt("Select an exercise before saving."),
        invalidSetIds: [],
      });
      setMessage({ type: "error", text: lt("Select an exercise before saving.") });
      return;
    }

    if (inputMode === "custom" && normalizedCustomExerciseName.length < 2) {
      setActivePanel("exercise");
      setValidation({
        customExerciseName: lt("Enter a custom exercise name first."),
        invalidSetIds: [],
      });
      setMessage({ type: "error", text: lt("Enter a custom exercise name first.") });
      return;
    }

    const parsedSets = sets.map((set) => ({
      id: set.id,
      value: parseNumber(set.value, false),
      reps: parseNumber(set.reps, true),
    }));

    const partialSetIds = parsedSets
      .filter((set) => (set.value == null) !== (set.reps == null))
      .map((set) => set.id);
    if (partialSetIds.length > 0) {
      setActivePanel("session");
      setExpandedSetId(partialSetIds[0] ?? null);
      setHighlightedSetId(partialSetIds[0] ?? null);
      setValidation({
        setMessage: lt("Complete both value and reps for highlighted sets."),
        invalidSetIds: partialSetIds,
      });
      setMessage({ type: "error", text: lt("Complete both value and reps for highlighted sets.") });
      return;
    }

    const completeSets = parsedSets.filter((set) => set.value != null && set.reps != null);
    if (completeSets.length === 0) {
      const firstSetId = sets[0]?.id ?? null;
      setActivePanel("session");
      setExpandedSetId(firstSetId);
      setHighlightedSetId(firstSetId);
      setValidation({
        setMessage: lt("Enter at least one full set before saving."),
        invalidSetIds: firstSetId ? [firstSetId] : [],
      });
      setMessage({ type: "error", text: lt("Enter at least one full set before saving.") });
      return;
    }

    setValidation({ invalidSetIds: [] });

    const primarySets = [completeSets[0] ?? null, completeSets[1] ?? null, completeSets[2] ?? null];
    const mergedNotes = notes.trim();

    const toStoredWeightKg = (value: number | null): number | null => {
      if (value == null || valueMode === "timed") return null;
      return weightUnit === "lbs" ? lbsToKg(value) : value;
    };

    const toStoredSeconds = (value: number | null): number | null => {
      if (value == null || valueMode !== "timed") return null;
      const seconds = timedUnit === "minutes" ? value * 60 : value;
      return Math.max(0, Math.round(seconds));
    };

    const createdAt = buildCreatedAtFromDateInput(trainingDate, settings.timeZone);

    setSaving(true);
    setMessage(null);

    try {
      let targetExerciseId = selectedExerciseId;
      let targetLevel = Number.parseInt(selectedLevel || "", 10) || 1;
      let targetVariant = selectedVariant || null;

      if (inputMode === "custom") {
        const nextExerciseName = normalizedCustomExerciseName;
        if (nextExerciseName.length < 2) {
          setMessage({ type: "error", text: lt("Enter a custom exercise name first.") });
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
        setMessage({ type: "error", text: lt("Select an exercise before saving.") });
        setSaving(false);
        return;
      }

      const serializedSets = completeSets.map((set) => ({
        value: valueMode === "timed" ? toStoredSeconds(set.value) : toStoredWeightKg(set.value),
        reps: set.reps,
        metric: valueMode === "timed" ? "time" : "weight",
      }));

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
              setupOption: selectedSetupOption.trim() || null,
              notes: mergedNotes || null,
              sets: serializedSets,
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
          sets: serializedSets,
          variant: targetVariant,
          modifier: valueMode === "weight" && modifierKg !== 0 ? formatSignedModifierKg(modifierKg) : null,
          setupOption: selectedSetupOption.trim() || null,
          notes: mergedNotes || null,
          completed: false,
          createdAt,
        });
      }

      clearDraft();

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
        text: error instanceof ApiRequestError ? error.message : `${lt("Failed to")} ${isEditingExistingLog ? lt("update") : lt("save")} ${lt("training log")}.`,
      });
    } finally {
      setSaving(false);
    }
  }, [clearDraft, customExerciseName, deleting, editLogId, inputMode, isEditingExistingLog, lt, modifierKg, notes, returnHref, router, saving, selectedExerciseId, selectedLevel, selectedSetupOption, selectedVariant, sets, settings.timeZone, timedUnit, trainingDate, valueMode, weightUnit]);

  const handleDeleteLoggedSession = useCallback(async () => {
    if (!isEditingExistingLog || !editLogId || saving || deleting) return;

    setDeleting(true);
    setMessage(null);

    try {
      await api.post("/api/progressions/logs/delete", { logId: editLogId });

      clearDraft();

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
        text: error instanceof ApiRequestError ? error.message : lt("Failed to delete this logged session."),
      });
    } finally {
      setDeleting(false);
    }
  }, [clearDraft, deleting, editLogId, isEditingExistingLog, returnHref, router, saving]);

  const openDeleteConfirm = useCallback(() => {
    if (!isEditingExistingLog || saving || deleting) return;
    setDeleteConfirmOpen(true);
  }, [deleting, isEditingExistingLog, saving]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleting) return;
    setDeleteConfirmOpen(false);
  }, [deleting]);

  const confirmDeleteLoggedSession = useCallback(async () => {
    setDeleteConfirmOpen(false);
    await handleDeleteLoggedSession();
  }, [handleDeleteLoggedSession]);

  const shellMinHeight = "calc(100dvh - 0.5rem)";
  const selectedExerciseMeta = inputMode === "custom"
    ? lt("We'll save this as a custom exercise so you can keep using it.")
    : selectedExercise
      ? `${selectedExercise.category || lt("Training")} • ${selectedExercise.tiers.length} ${lt("progression tiers")}`
      : lt("Choose an exercise from the previous screen.");
  const setValuePlaceholder = valueMode === "timed" ? lt("time") : weightUnit;

  const recentLogPlaceholders = useMemo<Array<{ value: string; reps: string }>>(() => {
    if (!selectedExercise) return [];
    const logs = (selectedExercise.userProgress ?? []).flatMap((progress) => progress.logs ?? []);
    if (logs.length === 0) return [];
    const numericLevel = Number.parseInt(selectedLevel, 10);
    const variantName = selectedVariant.trim();
    const matchesScope = (log: ProgressionLog) => {
      if (Number.isFinite(numericLevel) && log.level !== numericLevel) return false;
      if (variantName && (log.variant?.trim() || "") !== variantName) return false;
      return true;
    };
    const sorted = [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const recent = sorted.find(matchesScope) ?? sorted[0];
    if (!recent) return [];
    const usesTimedMetrics = recent.holdTime != null || recent.holdTime2 != null || recent.holdTime3 != null;
    if ((valueMode === "timed") !== usesTimedMetrics) return [];
    const formatValue = (weight: number | null, hold: number | null) => {
      if (valueMode === "timed") {
        return hold != null ? formatTimedInputSeconds(hold, timedUnit) : "";
      }
      if (weight == null) return "";
      return formatInputNumber(weightUnit === "lbs" ? kgToLbs(weight) : weight);
    };
    const formatReps = (reps: number | null) => (reps != null ? String(reps) : "");
    return [
      { value: formatValue(recent.weight1, recent.holdTime), reps: formatReps(recent.reps1) },
      { value: formatValue(recent.weight2, recent.holdTime2), reps: formatReps(recent.reps2) },
      { value: formatValue(recent.weight3, recent.holdTime3), reps: formatReps(recent.reps3) },
    ];
  }, [selectedExercise, selectedLevel, selectedVariant, timedUnit, valueMode, weightUnit]);

  const placeholderForSetIndex = (index: number, field: "value" | "reps", fallback: string): string => {
    const recent = recentLogPlaceholders[index];
    if (!recent) return fallback;
    const value = field === "value" ? recent.value : recent.reps;
    return value || fallback;
  };

  const panelShellStyle = {
    minHeight: 0,
    height: "100%",
    flex: 1,
    border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)",
    borderRadius: "1rem",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
    boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
  };
  const hasExerciseChoice = inputMode === "custom"
    ? customExerciseName.trim().length >= 2
    : Boolean(selectedExerciseId);
  const hasDetailSelection = Boolean(selectedExercise || customExerciseName.trim() || selectedLevel);
  const hasFormatChoice = valueMode === "weight" || valueMode === "timed";
  const selectedExerciseUsesEquipmentLabel = String(selectedExercise?.category ?? "").trim().toLowerCase() === "gym";
  const hasVariationOptions = (selectedExercise?.variations?.length ?? 0) > 0;
  const hasGripOptions = (selectedExercise?.modifiers?.length ?? 0) > 0;
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
  const activePanelIndex = sessionPanels.findIndex((panel) => panel.id === activePanel);
  const completedPanelCount = sessionPanels.filter((panel) => completionByPanel[panel.id]).length;
  const selectedExerciseLabel = inputMode === "custom"
    ? customExerciseName.trim() || lt("Custom exercise")
    : selectedExercise?.name || lt("No exercise selected");
  const selectedProgressionLabel = inputMode === "custom"
    ? `${lt("Progression")} 1`
    : selectedExercise?.tiers.find((tier) => String(tier.level) === selectedLevel)?.name || `${lt("Progression")} ${selectedLevel || "1"}`;
  const selectedVariantLabel = selectedVariant.trim();
  const confirmedExerciseSetupSummary = `${selectedVariantLabel ? `${selectedVariantLabel} ` : ""}${selectedProgressionLabel} ${selectedExerciseLabel}`;
  const reviewSetPreview = sets.flatMap((set, index) => {
    const value = set.value.trim();
    const reps = set.reps.trim();

    if (!value && !reps) return [];

    const summary = valueMode === "timed"
      ? `${value || "0"} ${timedUnit === "minutes" ? lt("min") : lt("sec")} • ${reps || "0"} ${lt("reps")}`
      : `${value || "0"} ${weightUnit} • ${reps || "0"} ${lt("reps")}`;

    return [{ label: `${lt("Set")} ${index + 1}`, summary }];
  });
  const currentEditSnapshot = useMemo(() => {
    if (!isEditingExistingLog) return null;
    return buildEditSnapshot({
      inputMode,
      valueMode,
      weightUnit,
      timedUnit,
      selectedExerciseId,
      customExerciseName,
      selectedLevel,
      selectedVariant,
      selectedSetupOption,
      modifierKg,
      trainingDate,
      notes,
      sets,
    });
  }, [customExerciseName, inputMode, isEditingExistingLog, modifierKg, notes, selectedExerciseId, selectedLevel, selectedSetupOption, selectedVariant, sets, timedUnit, trainingDate, valueMode, weightUnit]);
  const hasPendingEditChanges = Boolean(
    isEditingExistingLog
      && editLogHydrated
      && initialEditSnapshot
      && currentEditSnapshot
      && currentEditSnapshot !== initialEditSnapshot,
  );
  const editorPageTitle = isEditingExistingLog ? lt("Edit Workout") : isDayAssignment ? `${lt("Log a Workout")} (${assignedDayName ?? lt("Day")})` : lt("Log a Workout");
  const editorPageDescription = isEditingExistingLog
    ? lt("Update or delete this workout.")
    : isDayAssignment
      ? `${lt("Assigned")}: ${prefillVariant ? `${prefillVariant} ` : ""}${selectedExercise?.tiers.find((t) => String(t.level) === selectedLevel)?.name || prefillProgression} ${prefillExerciseName}`
      : confirmedPanels.includes("details")
        ? confirmedExerciseSetupSummary
        : lt("Track your sets and reps.");
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
    if (activePanelIndex >= sessionPanels.length - 1) return;

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
    setActivePanel(sessionPanels[activePanelIndex + 1]?.id ?? "review");
  };

  const canAdvanceFromCurrentPanel =
    (activePanel === "exercise" && hasExerciseChoice)
    || (activePanel === "details" && hasDetailSelection)
    || (activePanel === "format" && hasFormatChoice)
    || ((activePanel === "session" || activePanel === "notes") && hasConfirmedSetEntry)
    || activePanel === "review";

  const currentPanelRequirement = !canAdvanceFromCurrentPanel
    ? activePanel === "exercise"
      ? lt("Select an exercise to continue.")
      : activePanel === "details"
        ? lt("Confirm your workout details to continue.")
        : activePanel === "format"
          ? lt("Choose weight or timed format to continue.")
          : lt("Enter at least one complete set to continue.")
    : null;

  const goToPreviousPanel = () => {
    if (activePanelIndex <= 0) return;
    setHighlightedSetId(null);
    setActivePanel(sessionPanels[activePanelIndex - 1]?.id ?? "exercise");
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
          className={`h-10 min-w-[92px] justify-center rounded-lg px-3.5 ${activePanelIndex <= 0 ? "pointer-events-none opacity-45" : ""}`}
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
            backgroundColor: "transparent",
            color: "var(--mist-light)",
          }}
        >
          ← {lt("Back")}
        </GlowButton>

        {mode === "save" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isEditingExistingLog ? (
              <GlowButton
                variant="ghost"
                size="sm"
                disabled={saving || deleting}
                onClick={openDeleteConfirm}
                className="h-10 min-w-[92px] justify-center rounded-lg px-3.5"
                style={{
                  borderColor: "color-mix(in srgb, var(--danger) 42%, transparent)",
                  backgroundColor: "transparent",
                  color: "var(--danger-hover)",
                }}
              >
                {deleting ? lt("Deleting...") : lt("Delete")}
              </GlowButton>
            ) : null}
            <GlowButton
              variant="jade"
              size="sm"
              disabled={saving || deleting}
              onClick={() => void handleSave()}
              className="h-10 min-w-[92px] justify-center rounded-lg px-3.5"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-dark))",
                color: "var(--text-primary)",
              }}
            >
              {saving ? lt("Saving...") : isEditingExistingLog ? lt("Update") : lt("Save")}
            </GlowButton>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            {currentPanelRequirement ? (
              <p className="text-[11px] text-[color:var(--text-secondary)]" aria-live="polite">{currentPanelRequirement}</p>
            ) : null}
            <GlowButton
              variant="jade"
              size="sm"
              onClick={goToNextPanel}
              disabled={!canAdvanceFromCurrentPanel}
              className={`h-10 min-w-[92px] justify-center rounded-lg px-3.5 ${!canAdvanceFromCurrentPanel ? "opacity-55" : ""}`}
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-dark))",
                color: "var(--text-primary)",
              }}
            >
              {lt("Next")} →
            </GlowButton>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PageLayout
      title={editorPageTitle}
      mobileContentPaddingClass="p-0 pb-0"
    >
      {loading || !editLogHydrated ? (
        <GlowCard glow="jade" hoverable={false}>
          <p className="py-4 text-center text-sm text-mist-dark">{lt("Loading...")}</p>
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
                    aria-label={isEditingExistingLog ? lt("Back to workout history") : lt("Back to train")}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                  <div className="min-w-0">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-primary)]">{editorPageTitle}</h2>
                    <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]" aria-live="polite">{editorPageDescription}</p>
                  </div>
                </div>

                {isEditingExistingLog || canQuickRemoveFromAssignedDay ? (
                  <div className="flex items-center gap-2">
                    {canQuickRemoveFromAssignedDay ? (
                      <button
                        type="button"
                        onClick={() => void handleQuickRemoveFromAssignedDay()}
                        disabled={saving || deleting || removingFromDay}
                        className="inline-flex h-10 items-center rounded-md border px-3 text-[12px] font-semibold transition-colors"
                        style={{
                          borderColor: "color-mix(in srgb, var(--danger) 46%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
                          color: "var(--danger-hover)",
                          opacity: saving || deleting || removingFromDay ? 0.7 : 1,
                        }}
                      >
                        {removingFromDay ? lt("Removing...") : lt("Remove from day")}
                      </button>
                    ) : null}
                    {isEditingExistingLog ? (
                      <button
                        type="button"
                        onClick={openDeleteConfirm}
                        disabled={saving || deleting}
                        className="inline-flex h-10 items-center rounded-md border px-3 text-[12px] font-semibold transition-colors"
                        style={{
                          borderColor: "color-mix(in srgb, var(--danger) 46%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--danger) 7%, transparent)",
                          color: "var(--danger-hover)",
                          opacity: saving || deleting ? 0.7 : 1,
                        }}
                      >
                        {deleting ? lt("Deleting...") : lt("Delete")}
                      </button>
                    ) : null}
                    {isEditingExistingLog ? (
                      <button
                        type="button"
                        onClick={() => void handleCloseOrApply()}
                        disabled={saving || deleting}
                        className="inline-flex h-10 items-center rounded-md border px-3 text-[12px] font-semibold transition-colors"
                        style={{
                          borderColor: hasPendingEditChanges ? "color-mix(in srgb, var(--forest) 48%, transparent)" : "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                          backgroundColor: hasPendingEditChanges ? "color-mix(in srgb, var(--forest) 12%, transparent)" : "color-mix(in srgb, var(--surface-hover) 36%, transparent)",
                          color: hasPendingEditChanges ? "var(--cloud-white)" : "var(--text-primary)",
                          opacity: saving || deleting ? 0.7 : 1,
                        }}
                      >
                        {saving ? lt("Applying...") : hasPendingEditChanges ? lt("Apply Changes") : lt("Close")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              {message ? (
                <div
                  className="rounded-lg border px-3 py-2 text-[11px]"
                  role={message.type === "error" ? "alert" : "status"}
                  aria-live={message.type === "error" ? "assertive" : "polite"}
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
                    <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{lt("Steps")}</p>
                    <div
                      className="mb-2 w-full rounded-md border px-1.5 py-1 text-center"
                      style={{
                        borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                      }}
                    >
                      <p className="text-[9px] font-semibold leading-tight text-[color:var(--text-primary)]">{sessionPanels[activePanelIndex]?.label ?? lt("Step")}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{activePanelIndex + 1}/{sessionPanels.length}</p>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
                      {sessionPanels.map((panel, index) => {
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
                            aria-label={panel.label}
                            aria-current={isActive ? "step" : undefined}
                            title={`${index + 1}. ${panel.label}`}
                          >
                            <span className="text-[11px] font-semibold">{index + 1}</span>
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
                      aria-label={lt("Reset session")}
                      title={lt("Reset session")}
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
                          <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Session date")}</label>
                          <input
                            type="date"
                            value={trainingDate}
                            onChange={(event) => setTrainingDate(event.target.value)}
                            className="h-10 w-full rounded-md border px-3 text-sm font-semibold outline-none"
                            style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)" }}
                          />
                        </div>

                        {inputMode !== "custom" ? (
                          <>
                            <div className="mt-3 min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Selected exercise")}</p>
                            </div>

                            <div
                              className="mt-2 flex min-w-0 flex-col rounded-lg px-3 py-2.5"
                              style={{
                                backgroundColor: "color-mix(in srgb, var(--surface) 88%, black)",
                                border: "1px solid color-mix(in srgb, var(--ink-light) 42%, transparent)",
                              }}
                            >
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
                                  <option value="" disabled>{lt("Select a parent exercise")}</option>
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
                                <p
                                  className="mt-1 text-base font-semibold"
                                  style={{ color: selectedExercise?.name || customExerciseName ? "var(--accent)" : "var(--text-muted)" }}
                                >
                                  {selectedExercise?.name || customExerciseName || lt("No exercise selected")}
                                </p>
                              )}
                              <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">{selectedExerciseMeta}</p>
                            </div>
                            {validation.exercise ? (
                              <p className="mt-1.5 text-xs text-[color:var(--danger-hover)]" role="alert">{validation.exercise}</p>
                            ) : null}
                          </>
                        ) : null}

                        {inputMode === "custom" ? (
                          <div className="mt-3">
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Custom exercise name")}</label>
                            <div className="rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--forest) 46%, transparent)", backgroundColor: "color-mix(in srgb, var(--forest) 10%, transparent)" }}>
                              <input
                                type="text"
                                value={customExerciseName}
                                onChange={(event) => setCustomExerciseName(event.target.value)}
                                placeholder={lt("Type the exercise name you want")}
                                aria-invalid={validation.customExerciseName ? true : undefined}
                                aria-describedby={validation.customExerciseName ? "custom-exercise-error" : undefined}
                                className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                                style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--text-primary)" }}
                              />
                              {validation.customExerciseName ? (
                                <p id="custom-exercise-error" className="mt-1.5 text-xs text-[color:var(--danger-hover)]" role="alert">{validation.customExerciseName}</p>
                              ) : null}

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
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Exercise setup")}{isDayAssignment ? <span className="normal-case tracking-normal"> {lt("— locked to assignment")}</span> : null}</p>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div id="editor-field-progression" className="rounded-lg px-1 py-1" style={getFieldHighlightStyle("progression")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{selectedExerciseUsesEquipmentLabel ? lt("Equipment") : lt("Progression")}</label>
                            <select
                              value={selectedLevel}
                              onChange={(event) => setSelectedLevel(event.target.value)}
                              disabled={isDayAssignment || inputMode !== "existing" || !selectedExercise}
                              className="h-10 w-full rounded-md border px-3 text-sm font-semibold outline-none"
                              style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--label-progression)", opacity: isDayAssignment || inputMode !== "existing" || !selectedExercise ? 0.6 : 1, cursor: isDayAssignment ? "not-allowed" : undefined }}
                            >
                              {(selectedExercise?.tiers.length ? selectedExercise.tiers : [{ level: 1, name: `${selectedExerciseUsesEquipmentLabel ? lt("Equipment") : lt("Progression")} 1` }]).map((tier) => (
                                <option key={`${tier.level}-${tier.name}`} value={String(tier.level)}>
                                  {tier.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {hasVariationOptions ? (
                          <div id="editor-field-variation" className="rounded-lg px-1 py-1" style={getFieldHighlightStyle("variation")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Variant")}</label>
                            <select
                              value={selectedVariant}
                              onChange={(event) => setSelectedVariant(event.target.value)}
                              disabled={isDayAssignment || inputMode !== "existing" || !selectedExercise}
                              className="h-10 w-full rounded-md border px-3 text-sm font-semibold outline-none"
                              style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--label-variant)", opacity: isDayAssignment || inputMode !== "existing" || !selectedExercise ? 0.6 : 1, cursor: isDayAssignment ? "not-allowed" : undefined }}
                            >
                              <option value="">{lt("Default")}</option>
                              {(selectedExercise?.variations || []).map((variation) => (
                                <option key={variation.id} value={variation.name}>
                                  {variation.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          ) : null}

                          {hasGripOptions ? (
                          <div id="editor-field-setup" className="rounded-lg px-1 py-1" style={getFieldHighlightStyle("setup")}>
                            <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Grip")}</label>
                            <select
                              value={selectedSetupOption}
                              onChange={(event) => setSelectedSetupOption(event.target.value)}
                              disabled={isDayAssignment || inputMode !== "existing" || !selectedExercise}
                              className="h-10 w-full rounded-md border px-3 text-sm font-semibold outline-none"
                              style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--gold-glow)", opacity: isDayAssignment || inputMode !== "existing" || !selectedExercise ? 0.6 : 1, cursor: isDayAssignment ? "not-allowed" : undefined }}
                            >
                              <option value="">{lt("Default")}</option>
                              {(selectedExercise?.modifiers || []).map((modifier) => (
                                <option key={modifier.id} value={modifier.type}>
                                  {modifier.type}
                                </option>
                              ))}
                            </select>
                          </div>
                          ) : null}
                        </div>
                      </div>
                      {renderPanelActions()}
                    </section>
                  ) : null}

                  {activePanel === "format" ? (
                    <section className="flex flex-col overflow-hidden px-1 py-1" style={panelShellStyle}>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Session format")}</p>
                          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">{lt("Choose how you want to log this workout.")}</p>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setValueMode("weight")}
                            className="rounded-xl border px-3 py-3 text-left transition-colors"
                            style={{
                              borderColor: valueMode === "weight" ? "color-mix(in srgb, var(--accent) 52%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                              backgroundColor: valueMode === "weight" ? "color-mix(in srgb, var(--accent) 12%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                              color: valueMode === "weight" ? "var(--text-primary)" : "var(--text-secondary)",
                              boxShadow: valueMode === "weight"
                                ? "0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent) inset"
                                : "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{lt("Weight")}</span>
                                <span className="mt-1 block text-[10px] text-[color:var(--text-muted)]">{lt("Use load and reps.")}</span>
                              </span>
                              <span className="text-[10px] font-semibold" style={{ color: valueMode === "weight" ? "var(--accent)" : "var(--text-muted)" }}>
                                {valueMode === "weight" ? lt("Selected") : ""}
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setValueMode("timed")}
                            className="rounded-xl border px-3 py-3 text-left transition-colors"
                            style={{
                              borderColor: valueMode === "timed" ? "color-mix(in srgb, var(--accent) 52%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                              backgroundColor: valueMode === "timed" ? "color-mix(in srgb, var(--accent) 12%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                              color: valueMode === "timed" ? "var(--text-primary)" : "var(--text-secondary)",
                              boxShadow: valueMode === "timed"
                                ? "0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent) inset"
                                : "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{lt("Timed")}</span>
                                <span className="mt-1 block text-[10px] text-[color:var(--text-muted)]">{lt("Use time and reps.")}</span>
                              </span>
                              <span className="text-[10px] font-semibold" style={{ color: valueMode === "timed" ? "var(--accent)" : "var(--text-muted)" }}>
                                {valueMode === "timed" ? lt("Selected") : ""}
                              </span>
                            </div>
                          </button>
                        </div>

                        <div
                          className="mt-4 rounded-xl border px-3 py-3"
                          style={{
                            borderColor: "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                            boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Input unit")}</p>
                              <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
                                {valueMode === "timed" ? lt("Pick whether you want to enter seconds or minutes.") : lt("Pick the weight unit you normally use.")}
                              </p>
                            </div>
                            <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold" style={{ borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)", backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--text-primary)" }}>
                              {valueMode === "timed" ? (timedUnit === "minutes" ? lt("Minutes") : lt("Seconds")) : weightUnit.toUpperCase()}
                            </span>
                          </div>

                          {valueMode === "timed" ? (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setTimedUnit("seconds")}
                                className="rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all"
                                style={{
                                  borderColor: timedUnit === "seconds" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                  backgroundColor: timedUnit === "seconds" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                  color: timedUnit === "seconds" ? "var(--text-primary)" : "var(--text-secondary)",
                                  boxShadow: timedUnit === "seconds" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                                }}
                              >
                                {lt("Seconds")} (s)
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimedUnit("minutes")}
                                className="rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all"
                                style={{
                                  borderColor: timedUnit === "minutes" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                  backgroundColor: timedUnit === "minutes" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                  color: timedUnit === "minutes" ? "var(--text-primary)" : "var(--text-secondary)",
                                  boxShadow: timedUnit === "minutes" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                                }}
                              >
                                {lt("Minutes")} (m)
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setWeightUnit("kg")}
                                className="rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all"
                                style={{
                                  borderColor: weightUnit === "kg" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                  backgroundColor: weightUnit === "kg" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                  color: weightUnit === "kg" ? "var(--text-primary)" : "var(--text-secondary)",
                                  boxShadow: weightUnit === "kg" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                                }}
                              >
                                {lt("Kilograms")} (kg)
                              </button>
                              <button
                                type="button"
                                onClick={() => setWeightUnit("lbs")}
                                className="rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all"
                                style={{
                                  borderColor: weightUnit === "lbs" ? "color-mix(in srgb, var(--accent) 54%, transparent)" : "color-mix(in srgb, var(--ink-light) 36%, transparent)",
                                  backgroundColor: weightUnit === "lbs" ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "color-mix(in srgb, var(--ink-mid) 85%, black)",
                                  color: weightUnit === "lbs" ? "var(--text-primary)" : "var(--text-secondary)",
                                  boxShadow: weightUnit === "lbs" ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent) inset" : "none",
                                }}
                              >
                                {lt("Pounds")} (lbs)
                              </button>
                            </div>
                          )}
                        </div>
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
                                borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
                                boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setIsModifierPanelOpen((prev) => !prev)}
                                aria-expanded={isModifierPanelOpen}
                                aria-controls="modifier-slider-panel"
                                className="flex w-full items-start justify-between gap-2 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{lt("Modifier")}</p>
                                  <p className="mt-1 text-[10px] text-[color:var(--text-secondary)]">
                                    {lt("Using weighted reps or a resistance band?")} {lt("Expand to set the modifier value.")}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <span
                                    className="min-w-[84px] rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold"
                                    style={{
                                      borderColor: modifierKg === 0 ? "color-mix(in srgb, var(--accent) 36%, transparent)" : "color-mix(in srgb, var(--danger) 56%, transparent)",
                                      backgroundColor: modifierKg === 0 ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "color-mix(in srgb, var(--danger) 14%, transparent)",
                                      color: modifierKg === 0 ? "var(--text-muted)" : "var(--danger-hover)",
                                    }}
                                  >
                                    {modifierKg === 0 ? lt("None") : formatSignedModifierKg(modifierKg)}
                                  </span>
                                  <span
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px]"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                                      color: "var(--text-muted)",
                                      backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                                    }}
                                    aria-hidden="true"
                                  >
                                    {isModifierPanelOpen ? "−" : "+"}
                                  </span>
                                </div>
                              </button>

                              {isModifierPanelOpen ? (
                                <div id="modifier-slider-panel" className="mt-3 rounded-xl px-2.5 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                                  <input
                                    type="range"
                                    min="-50"
                                    max="50"
                                    step="0.5"
                                    value={modifierKg}
                                    onChange={(event) => setModifierKg(Number(event.target.value))}
                                    className="h-1.5 w-full cursor-pointer accent-[var(--jade-glow)]"
                                    aria-label={lt("Weight modifier slider")}
                                  />
                                  <div className="mt-2 flex items-center justify-between text-[9px] text-[color:var(--text-muted)]">
                                    <span>-50kg</span>
                                    <span>0</span>
                                    <span>+50kg</span>
                                  </div>
                                  {modifierKg !== 0 ? (
                                    <div className="mt-2 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => setModifierKg(0)}
                                        className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                                        style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))", color: "var(--text-secondary)" }}
                                      >
                                        {lt("Reset")}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))", boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)" }}>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Sets")}</p>
                              {validation.setMessage ? (
                                <p className="mt-1 text-xs text-[color:var(--danger-hover)]" role="alert">{validation.setMessage}</p>
                              ) : null}
                            </div>

                            <div className="mt-3 space-y-2.5">
                              {sets.map((set, index) => {
                                const isExpanded = expandedSetId === set.id;
                                const isInvalidSet = validation.invalidSetIds.includes(set.id);
                                const hasSummaryValues = Boolean(set.value || set.reps);
                                const summaryValueLabel = set.value || "—";
                                const summaryValueUnit = valueMode === "timed" ? (timedUnit === "minutes" ? "min" : "sec") : weightUnit;
                                const summaryRepsLabel = set.reps || "—";

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
                                        ? "linear-gradient(180deg, color-mix(in srgb, var(--forest) 8%, var(--ink-mid)), color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid)))"
                                        : "linear-gradient(180deg, color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid)), color-mix(in srgb, var(--ink-mid) 92%, black))",
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
                                          {lt("Set")} {index + 1}
                                        </span>
                                        {hasSummaryValues ? (
                                          <span className="truncate text-[10px]">
                                            <span style={{ color: "var(--col-weight)" }}>{summaryValueLabel}</span>
                                            <span style={{ color: "var(--text-muted)" }}> {summaryValueUnit} · </span>
                                            <span style={{ color: "var(--col-reps)" }}>{summaryRepsLabel}</span>
                                            <span style={{ color: "var(--text-muted)" }}> {lt("reps")}</span>
                                          </span>
                                        ) : (
                                          <span className="truncate text-[10px] text-[color:var(--text-muted)]">{lt("Tap to continue this set")}</span>
                                        )}
                                      </button>

                                      <div className="flex items-center gap-2">
                                        {index === sets.length - 1 ? (
                                          (() => {
                                            const ready = Boolean(set.value.trim() && set.reps.trim());
                                            return (
                                              <>
                                                {sets.length > 1 ? (
                                                  <button
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      removeSetRow(set.id);
                                                    }}
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
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    addSetRow();
                                                  }}
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
                                            );
                                          })()
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              removeSetRow(set.id);
                                            }}
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

                                    {isExpanded ? (
                                      <div className="mt-3 grid grid-cols-2 gap-2">
                                        <label className="block">
                                          <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                                            {valueMode === "timed" ? (timedUnit === "minutes" ? lt("Minutes") : lt("Seconds")) : lt("Weight")}
                                          </span>
                                          <input
                                            type="number"
                                            inputMode={valueMode === "timed" ? "numeric" : "decimal"}
                                            min="0"
                                            step={valueMode === "timed" ? "1" : "0.5"}
                                            value={set.value}
                                            onChange={(event) => updateSetRow(set.id, "value", event.target.value)}
                                            placeholder={placeholderForSetIndex(index, "value", setValuePlaceholder)}
                                            aria-invalid={isInvalidSet ? true : undefined}
                                            aria-describedby={isInvalidSet ? `set-error-${set.id}` : undefined}
                                            className="h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none placeholder:font-normal placeholder:italic placeholder:opacity-40"
                                            style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--col-weight)" }}
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{lt("Reps")}</span>
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            min="0"
                                            step="1"
                                            value={set.reps}
                                            onChange={(event) => updateSetRow(set.id, "reps", event.target.value)}
                                            placeholder={placeholderForSetIndex(index, "reps", lt("reps"))}
                                            aria-invalid={isInvalidSet ? true : undefined}
                                            aria-describedby={isInvalidSet ? `set-error-${set.id}` : undefined}
                                            className="h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none placeholder:font-normal placeholder:italic placeholder:opacity-40"
                                            style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)", color: "var(--col-reps)" }}
                                          />
                                        </label>
                                        {isInvalidSet ? (
                                          <p id={`set-error-${set.id}`} className="col-span-2 text-xs text-[color:var(--danger-hover)]" role="alert">
                                            {lt("Enter both value and reps for this set.")}
                                          </p>
                                        ) : null}
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
                          <p className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Notes")}</p>
                        </div>

                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={8}
                          placeholder={lt("Anything important from this session...")}
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
                          className="rounded-xl border px-3 py-3"
                          style={{
                            borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
                            backgroundColor: "var(--surface)",
                          }}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{lt("Review")}</p>

                          </div>

                          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                            <div>
                              <dt className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Exercise")}</dt>
                              <dd className="text-[12px] font-semibold truncate" style={{ color: "var(--accent)" }}>{selectedExerciseLabel}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Progression")}</dt>
                              <dd className="text-[12px] font-semibold truncate" style={{ color: "var(--label-progression)" }}>{selectedProgressionLabel}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Variation")}</dt>
                              <dd className="text-[12px] font-semibold truncate" style={{ color: "var(--label-variant)" }}>{selectedVariant || lt("Default")}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Grip")}</dt>
                              <dd className="text-[12px] font-semibold truncate" style={{ color: "var(--gold-glow)" }}>{selectedSetupOption || lt("Default")}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Date")}</dt>
                              <dd className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{trainingDate}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Format")}</dt>
                              <dd className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                                {valueMode === "timed" ? lt("Timed") : `${lt("Weight")} · ${weightUnit}`}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Modifier")}</dt>
                              <dd
                                className="text-[12px] font-semibold"
                                style={{ color: valueMode === "weight" && modifierKg !== 0 ? "var(--danger-hover)" : "var(--text-muted)" }}
                              >
                                {valueMode === "weight" && modifierKg !== 0 ? formatSignedModifierKg(modifierKg) : lt("—")}
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-3 border-t pt-2" style={{ borderColor: "color-mix(in srgb, var(--border) 56%, transparent)" }}>
                            <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Working sets")}</p>
                            <ul className="mt-1">
                              {reviewSetPreview.length ? reviewSetPreview.map((set) => (
                                <li key={set.label} className="flex items-baseline justify-between gap-2 py-1 text-[11px]">
                                  <span className="font-semibold" style={{ color: "var(--accent)" }}>{set.label}</span>
                                  <span className="truncate" style={{ color: "var(--col-weight)" }}>{set.summary}</span>
                                </li>
                              )) : (
                                <li className="py-1 text-[11px] text-[color:var(--text-secondary)]">{lt("No sets added yet.")}</li>
                              )}
                            </ul>
                          </div>

                          <div className="mt-3 border-t pt-2" style={{ borderColor: "color-mix(in srgb, var(--border) 56%, transparent)" }}>
                            <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Session notes")}</p>
                            <p
                              className="mt-1 text-[11px] leading-5"
                              style={{ color: notes.trim() ? "var(--text-primary)" : "var(--text-muted)" }}
                            >
                              {notes.trim() || lt("No notes added for this session.")}
                            </p>
                          </div>
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

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center p-3 sm:items-center"
          style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 72%, transparent)" }}
          role="dialog"
          aria-modal="true"
          aria-label={lt("Confirm delete logged session")}
        >
          <div className="w-full max-w-sm rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--danger) 42%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lt("Delete this logged session?")}</h3>
            <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>{lt("This action cannot be undone.")}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deleting}
                className="inline-flex h-10 items-center rounded-md border px-3 text-xs font-semibold"
                style={{ borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)", backgroundColor: "transparent", color: "var(--text-primary)" }}
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteLoggedSession()}
                disabled={deleting}
                className="inline-flex h-10 items-center rounded-md border px-3 text-xs font-semibold"
                style={{ borderColor: "color-mix(in srgb, var(--danger) 46%, transparent)", backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)", color: "var(--danger-hover)" }}
              >
                {deleting ? lt("Deleting...") : lt("Delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageLayout>
  );
}
