"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import GlowButton from "@/components/ui/GlowButton";
import { api } from "@/lib/api-client";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { getDefaultExerciseDbOptions, type ExerciseDbOptions } from "@/lib/exercise-db-settings";
import type {
  SimpleExercise,
  TrainingCategory,
  SimpleExerciseType,
  MuscleGroup,
  Difficulty,
} from "@/lib/exercise-types";
import {
  getExerciseTypeIcon,
  getCategoryIcon,
} from "@/lib/exercise-types";
import GlowCard, { GlowModal } from "@/components/ui/GlowCard";
import MobileFocusOverlay, { MobileFocusTrigger } from "@/components/ui/MobileFocusOverlay";
import ExerciseImageBox from "@/components/exercise/ExerciseImageBox";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExerciseFormData {
  name: string;
  category: TrainingCategory;
  exerciseType: SimpleExerciseType;
  muscleGroups: MuscleGroup[];
  progression: string[];
  variations: string[];
}

const ITEMS_PER_PAGE = 25;

type ExerciseLibrarySortState = {
  columnId: "exercise" | "category" | "type" | "muscles" | "progression" | "variants" | "dateAdded";
  direction: "asc" | "desc";
};

type ExerciseLibraryViewPrefs = {
  search: string;
  catFilter: TrainingCategory | "";
  muscleFilter: MuscleGroup | "";
  typeFilter: SimpleExerciseType | "";
  customOnly: boolean;
  showFilters: boolean;
  sortState: ExerciseLibrarySortState | null;
  fitToScreenMode: boolean;
};

interface ExerciseEditHistoryEntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  userName: string;
  field: string;
  beforeValue: string;
  afterValue: string;
  editedAt: string;
}

const HISTORY_FIELD_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  Name: {
    text: "var(--state-info)",
    bg: "color-mix(in srgb, var(--state-info) 16%, transparent)",
    border: "color-mix(in srgb, var(--state-info) 45%, transparent)",
  },
  Category: {
    text: "var(--state-success)",
    bg: "color-mix(in srgb, var(--state-success) 14%, transparent)",
    border: "color-mix(in srgb, var(--state-success) 40%, transparent)",
  },
  Type: {
    text: "var(--state-warning)",
    bg: "color-mix(in srgb, var(--state-warning) 14%, transparent)",
    border: "color-mix(in srgb, var(--state-warning) 40%, transparent)",
  },
  Muscles: {
    text: "var(--state-danger)",
    bg: "color-mix(in srgb, var(--state-danger) 14%, transparent)",
    border: "color-mix(in srgb, var(--state-danger) 40%, transparent)",
  },
  Difficulty: {
    text: "var(--text-primary)",
    bg: "color-mix(in srgb, var(--gold) 18%, transparent)",
    border: "color-mix(in srgb, var(--gold) 45%, transparent)",
  },
  Equipment: {
    text: "var(--text-primary)",
    bg: "color-mix(in srgb, var(--ink-light) 35%, transparent)",
    border: "color-mix(in srgb, var(--ink-light) 60%, transparent)",
  },
  Description: {
    text: "var(--text-primary)",
    bg: "color-mix(in srgb, var(--muted) 25%, transparent)",
    border: "color-mix(in srgb, var(--muted) 55%, transparent)",
  },
  Instructions: {
    text: "var(--text-primary)",
    bg: "color-mix(in srgb, var(--accent) 22%, transparent)",
    border: "color-mix(in srgb, var(--accent) 48%, transparent)",
  },
  Variants: {
    text: "var(--text-primary)",
    bg: "color-mix(in srgb, var(--jade-glow) 20%, transparent)",
    border: "color-mix(in srgb, var(--jade-glow) 48%, transparent)",
  },
  Duplicated: {
    text: "var(--state-info)",
    bg: "color-mix(in srgb, var(--state-info) 16%, transparent)",
    border: "color-mix(in srgb, var(--state-info) 45%, transparent)",
  },
  Deleted: {
    text: "var(--state-danger)",
    bg: "color-mix(in srgb, var(--state-danger) 16%, transparent)",
    border: "color-mix(in srgb, var(--state-danger) 45%, transparent)",
  },
  Created: {
    text: "var(--state-success)",
    bg: "color-mix(in srgb, var(--state-success) 14%, transparent)",
    border: "color-mix(in srgb, var(--state-success) 40%, transparent)",
  },
};

function getHistoryFieldStyle(field: string) {
  return (
    HISTORY_FIELD_STYLES[field] ?? {
      text: "var(--text-primary)",
      bg: "color-mix(in srgb, var(--surface) 65%, transparent)",
      border: "color-mix(in srgb, var(--border) 65%, transparent)",
    }
  );
}

function getDefaultExerciseLibraryViewPrefs(): ExerciseLibraryViewPrefs {
  return {
    search: "",
    catFilter: "",
    muscleFilter: "",
    typeFilter: "",
    customOnly: false,
    showFilters: true,
    sortState: null,
    fitToScreenMode: true,
  };
}

function readExerciseLibraryViewPrefs(storageKey: string): ExerciseLibraryViewPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExerciseLibraryViewPrefs>;
    const fallback = getDefaultExerciseLibraryViewPrefs();
    const validSort = parsed.sortState
      && typeof parsed.sortState === "object"
      && ["exercise", "category", "type", "muscles", "progression", "variants", "dateAdded"].includes(String(parsed.sortState.columnId))
      && ["asc", "desc"].includes(String(parsed.sortState.direction))
      ? parsed.sortState as ExerciseLibrarySortState
      : null;

    return {
      search: typeof parsed.search === "string" ? parsed.search : fallback.search,
      catFilter: typeof parsed.catFilter === "string" ? parsed.catFilter : fallback.catFilter,
      muscleFilter: typeof parsed.muscleFilter === "string" ? parsed.muscleFilter : fallback.muscleFilter,
      typeFilter: typeof parsed.typeFilter === "string" ? parsed.typeFilter : fallback.typeFilter,
      customOnly: typeof parsed.customOnly === "boolean" ? parsed.customOnly : fallback.customOnly,
      showFilters: true,
      sortState: validSort,
      fitToScreenMode: typeof parsed.fitToScreenMode === "boolean" ? parsed.fitToScreenMode : fallback.fitToScreenMode,
    };
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty?: Difficulty | string }) {
  if (!difficulty) return null;
  const map: Record<string, string> = {
    Beginner: "text-difficulty-green border-difficulty-green/30 bg-difficulty-green/10",
    Intermediate: "text-difficulty-amber border-difficulty-amber/30 bg-difficulty-amber/10",
    Advanced: "text-difficulty-red border-difficulty-red/30 bg-difficulty-red/10",
  };
  const cls = map[difficulty] ?? "text-mist-light border-ink-light/30 bg-ink-mid/20";
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${cls}`}>
      {difficulty}
    </span>
  );
}

function ActionsDropdown({
  exercise,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  exercise: SimpleExercise;
  onEdit: (ex: SimpleExercise) => void;
  onDelete: (ex: SimpleExercise) => void;
  onDuplicate: (ex: SimpleExercise) => void;
}) {
  const [open, setOpen] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    const syncMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 144;
      const menuHeight = 112;
      const margin = 8;
      const defaultTop = rect.bottom + 4;
      const top = defaultTop + menuHeight > window.innerHeight - margin
        ? Math.max(margin, rect.top - menuHeight - 4)
        : defaultTop;
      const left = Math.min(
        window.innerWidth - menuWidth - margin,
        Math.max(margin, rect.right - menuWidth),
      );

      setMenuPosition({ top, left });
    };

    syncMenuPosition();
    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    return () => {
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        className="px-2 py-1 text-base transition-colors cursor-pointer"
        style={{
          borderRadius: "2px",
          color: btnHover ? "var(--text-primary)" : "var(--text-muted)",
          backgroundColor: btnHover ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "transparent",
        }}
      >
        ⋮
      </button>
      {open && typeof document !== "undefined" && menuPosition && createPortal(
        <>
          <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[140] w-36 rounded-lg border border-ink-light/40 bg-ink-deep shadow-xl"
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          >
            <button onClick={() => { setOpen(false); onEdit(exercise); }} className="w-full text-left px-3 py-2 text-xs text-mist-light hover:bg-accent/25 hover:text-cloud-white transition-colors rounded-t-lg">✏️ Edit</button>
            <button onClick={() => { setOpen(false); onDuplicate(exercise); }} className="w-full text-left px-3 py-2 text-xs text-mist-light hover:bg-accent/25 hover:text-cloud-white transition-colors">📋 Duplicate</button>
            <button onClick={() => { setOpen(false); onDelete(exercise); }} className="w-full text-left px-3 py-2 text-xs text-crimson-light hover:bg-crimson/35 hover:text-cloud-white transition-colors rounded-b-lg">🗑️ Delete</button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// ─── Exercise Modal ───────────────────────────────────────────────────────────

function ExerciseModal({
  isOpen,
  onClose,
  onSave,
  exercise,
  mode,
  dbOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ExerciseFormData) => Promise<void>;
  exercise?: SimpleExercise | null;
  mode: "add" | "edit";
  dbOptions: ExerciseDbOptions;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TrainingCategory>("GYM");
  const [exerciseType, setExerciseType] = useState<SimpleExerciseType>("weighted");
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [progression, setProgression] = useState<string[]>([]);
  const [progressionDraft, setProgressionDraft] = useState("");
  const [variations, setVariations] = useState<string[]>([]);
  const [variationDraft, setVariationDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (exercise && mode === "edit") {
      setName(exercise.name);
      setCategory(exercise.category);
      setExerciseType(exercise.exerciseType);
      setMuscleGroups(exercise.muscleGroups);
      setProgression((exercise.progression ?? []).filter(Boolean));
      setVariations((exercise.variations ?? []).map((variation) => variation.name).filter(Boolean));
    } else {
      setName("");
      setCategory((dbOptions.categories[0] as TrainingCategory) || "Other");
      setExerciseType((dbOptions.types[0] as SimpleExerciseType) || "bodyweight");
      setMuscleGroups([]);
      setProgression([]);
      setVariations([]);
      setProgressionDraft("");
      setVariationDraft("");
    }
    setError("");
  }, [isOpen, exercise, mode, dbOptions.categories, dbOptions.types]);

  const toggle = <T extends string>(arr: T[], item: T, set: (v: T[]) => void) =>
    set(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);

  const addUniqueLabel = (value: string, current: string[], set: (next: string[]) => void) => {
    const next = value.trim().slice(0, 200);
    if (!next) return false;
    if (current.some((item) => item.toLowerCase() === next.toLowerCase())) return false;
    set([...current, next]);
    return true;
  };

  const handleSubmit = async () => {
    setError("");
    if (name.trim().length < 2) { setError("Name must be at least 2 characters"); return; }
    if (muscleGroups.length === 0) { setError("Select at least one muscle group"); return; }
    if (progression.length === 0) { setError("Add at least one progression stage"); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), category, exerciseType,
        muscleGroups, progression, variations,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save exercise");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-ink-dark border border-ink-light/40 rounded-lg px-3 py-2 text-sm text-cloud-white placeholder:text-mist-dark/50 outline-none transition-colors focus:border-jade-glow/60";
  const chipBase = "text-[11px] px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all duration-150 select-none";
  const chipOn = "bg-jade-deep/40 border-jade-glow/50 text-jade-light";
  const chipOff = "bg-ink-dark/60 border-ink-light/40 text-mist-light hover:border-accent/55 hover:bg-accent/18 hover:text-cloud-white";

  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title={mode === "add" ? "Add Exercise" : "Edit Exercise"} panelClassName="!max-w-2xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && <div className="rounded-lg border border-crimson/40 bg-crimson-deep/20 px-3 py-2 text-xs text-crimson-light">{error}</div>}

        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Parent Exercise *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add parent exercise (e.g., Pull up)" className={inputCls} maxLength={200} />
        </label>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Progression Stages *</span>
          <div className="flex flex-wrap gap-1.5">
            {progression.map((value) => (
              <span key={value} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border" style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)" }}>
                {value}
                <button
                  type="button"
                  className="text-[11px] leading-none"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setProgression((prev) => prev.filter((item) => item !== value))}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={progressionDraft}
              onChange={(e) => setProgressionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const added = addUniqueLabel(progressionDraft, progression, setProgression);
                if (added) setProgressionDraft("");
              }}
              placeholder="Add progression stage"
              className={`${inputCls} !py-1.5`}
            />
            <button
              type="button"
              onClick={() => {
                const added = addUniqueLabel(progressionDraft, progression, setProgression);
                if (added) setProgressionDraft("");
              }}
              className="px-3 py-1.5 text-xs border rounded-md"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Variants (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            {variations.map((value) => (
              <span key={value} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border" style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)" }}>
                {value}
                <button
                  type="button"
                  className="text-[11px] leading-none"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setVariations((prev) => prev.filter((item) => item !== value))}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={variationDraft}
              onChange={(e) => setVariationDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const added = addUniqueLabel(variationDraft, variations, setVariations);
                if (added) setVariationDraft("");
              }}
              placeholder="Add variant"
              className={`${inputCls} !py-1.5`}
            />
            <button
              type="button"
              onClick={() => {
                const added = addUniqueLabel(variationDraft, variations, setVariations);
                if (added) setVariationDraft("");
              }}
              className="px-3 py-1.5 text-xs border rounded-md"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Category *</span>
          <div className="flex flex-wrap gap-1.5">
            {dbOptions.categories.map((cat) => (
              <button key={cat} type="button" onClick={() => setCategory(cat as TrainingCategory)} className={`${chipBase} ${category === cat ? chipOn : chipOff}`}>
                {getCategoryIcon(cat as TrainingCategory)} {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Type *</span>
          <div className="flex flex-wrap gap-2">
            {dbOptions.types.map((type) => (
              <button key={type} type="button" onClick={() => setExerciseType(type as SimpleExerciseType)} className={`flex-1 min-w-[90px] ${chipBase} text-center ${exerciseType === type ? chipOn : chipOff}`}>
                {getExerciseTypeIcon(type as SimpleExerciseType)} {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Muscle Groups * (select all that apply)</span>
          <div className="flex flex-wrap gap-1.5">
            {dbOptions.muscles.map((mg) => (
              <button key={mg} type="button" onClick={() => toggle(muscleGroups, mg as MuscleGroup, setMuscleGroups)} className={`${chipBase} ${muscleGroups.includes(mg as MuscleGroup) ? chipOn : chipOff}`}>
                {mg}
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-ink-light/30">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-ink-light/35 text-mist-light hover:text-cloud-white hover:border-accent/55 hover:bg-accent/20 transition-colors rounded-md">Cancel</button>
        <GlowButton onClick={handleSubmit} variant="jade" size="sm" glow disabled={saving} className="!px-6">
          {saving ? "Saving…" : mode === "add" ? "Add Exercise" : "Save Changes"}
        </GlowButton>
      </div>
    </GlowModal>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ isOpen, onClose, onConfirm, name }: { isOpen: boolean; onClose: () => void; onConfirm: () => Promise<void>; name: string }) {
  const [deleting, setDeleting] = useState(false);
  const handle = async () => { setDeleting(true); try { await onConfirm(); onClose(); } finally { setDeleting(false); } };
  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Delete Exercise" panelClassName="!max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-mist-light">Are you sure you want to delete <strong className="text-crimson-light">{name}</strong>? This will also delete all associated training logs.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-ink-light/35 text-mist-light hover:text-cloud-white hover:border-accent/55 hover:bg-accent/20 transition-colors rounded-md">Cancel</button>
          <button onClick={handle} disabled={deleting} className="px-4 py-2 text-sm font-semibold rounded-lg bg-crimson-deep/40 text-crimson-light border border-crimson/40 hover:bg-crimson/45 hover:text-cloud-white transition-colors disabled:opacity-50">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </GlowModal>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  exercises,
  onEdit,
  onAppend,
  onDeletePending,
  pendingActionId,
  resolveExerciseName,
}: {
  exercises: SimpleExercise[];
  onEdit: (exercise: SimpleExercise) => void;
  onAppend: (exercise: SimpleExercise) => Promise<void>;
  onDeletePending: (exercise: SimpleExercise) => Promise<void>;
  pendingActionId: string | null;
  resolveExerciseName: (exercise: SimpleExercise) => string;
}) {
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ex of exercises) m[ex.category] = (m[ex.category] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [exercises]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ex of exercises) m[ex.exerciseType] = (m[ex.exerciseType] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [exercises]);

  const byMuscle = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ex of exercises) for (const mg of ex.muscleGroups) m[mg] = (m[mg] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [exercises]);

  const customCount = exercises.filter((e) => e.isCustom).length;
  const pendingExercises = useMemo(
    () => exercises.filter((exercise) => exercise.isPendingAddition),
    [exercises],
  );
  const topCategory = byCat[0] ?? null;
  const topType = byType[0] ?? null;
  const topMuscle = byMuscle[0] ?? null;

  return (
    <GlowCard glow="jade" hoverable={false}>
      <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">Database Overview</h3>
      <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse" style={{ minWidth: "620px", backgroundColor: "var(--surface)" }}>
        <tbody>
          <tr>
            <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "22%" }}>Total Exercises:</td>
            <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>{exercises.length}</td>
            <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "22%" }}>Custom Entries:</td>
            <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--gold)" }}>{customCount}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Categories:</td>
            <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{byCat.length}</td>
            <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Types:</td>
            <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{byType.length}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Top Category:</td>
            <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {topCategory ? `${topCategory[0]} (${topCategory[1]})` : "—"}
            </td>
            <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Top Type:</td>
            <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {topType ? `${topType[0]} (${topType[1]})` : "—"}
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Top Muscle Group:</td>
            <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {topMuscle ? `${topMuscle[0]} (${topMuscle[1]})` : "—"}
            </td>
            <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Coverage:</td>
            <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>{byMuscle.length} muscle groups</td>
          </tr>
        </tbody>
      </table>
      </div>

      <div className="border-t border-ink-light px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-jade-glow uppercase tracking-wider">
            Pending exercise to be added
          </span>
          <span className="text-[11px] text-gold">
            {pendingExercises.length}
          </span>
        </div>

        {pendingExercises.length === 0 ? (
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>No pending exercises.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pendingExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: "color-mix(in srgb, var(--gold) 45%, var(--border))",
                  color: "var(--text-primary)",
                  backgroundColor: "color-mix(in srgb, var(--gold) 8%, transparent)",
                }}
              >
                <span className="font-medium" title={exercise.isPendingEdited ? "Edited after submission" : undefined}>
                  {exercise.isPendingEdited ? `* ${resolveExerciseName(exercise)}` : resolveExerciseName(exercise)}
                </span>
                <button
                  type="button"
                  onClick={() => onEdit(exercise)}
                  className="rounded border px-2 py-0.5"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { void onAppend(exercise); }}
                  disabled={pendingActionId === exercise.id}
                  className="rounded border px-2 py-0.5 disabled:opacity-60"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
                >
                  {pendingActionId === exercise.id ? "Working..." : "Append to Database"}
                </button>
                <button
                  type="button"
                  onClick={() => { void onDeletePending(exercise); }}
                  disabled={pendingActionId === exercise.id}
                  className="rounded border px-2 py-0.5 disabled:opacity-60"
                  style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)" }}
                >
                  Delete Pending
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlowCard>
  );
}

// ─── Exercise Variants Modal ─────────────────────────────────────────────────

function ExerciseVariantsModal({
  isOpen,
  onClose,
  exercise,
  variants,
  onSave,
  resolveExerciseName,
}: {
  isOpen: boolean;
  onClose: () => void;
  exercise: SimpleExercise | null;
  variants: string[];
  onSave: (exerciseId: string, variants: string[]) => Promise<void>;
  resolveExerciseName: (exercise: SimpleExercise) => string;
}) {
  const [draft, setDraft] = useState<string[]>([]);
  const [newVariant, setNewVariant] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(variants);
    setNewVariant("");
  }, [isOpen, variants]);

  const addVariant = () => {
    const value = newVariant.trim();
    if (!value) return;
    if (draft.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setDraft((prev) => [...prev, value]);
    setNewVariant("");
  };

  const removeVariant = (value: string) => {
    setDraft((prev) => prev.filter((item) => item !== value));
  };

  const handleSave = async () => {
    if (!exercise) return;
    setSaving(true);
    try {
      await onSave(exercise.id, draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Exercise Variants" panelClassName="!max-w-lg">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-cloud-white font-medium">{exercise ? resolveExerciseName(exercise) : ""}</p>
          <p className="text-[11px] text-mist-dark">Variants are managed per exercise and saved to the exercise library.</p>
        </div>

        <div className="rounded-lg border border-ink-light/30 bg-ink-dark/60 p-3 min-h-20">
          {draft.length === 0 ? (
            <p className="text-[11px] text-mist-dark italic">No variants added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {draft.map((value) => (
                <span key={value} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-jade-deep/30 border border-jade-glow/30 text-jade-light">
                  {value}
                  <button onClick={() => removeVariant(value)} className="text-jade-light/60 hover:text-crimson-light hover:bg-crimson/20 transition-colors ml-0.5 rounded-sm px-1">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newVariant}
            onChange={(e) => setNewVariant(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addVariant();
              }
            }}
            placeholder="Add variant"
            className="flex-1 bg-ink-dark border border-ink-light/40 rounded-lg px-3 py-2 text-sm text-cloud-white placeholder:text-mist-dark/50 outline-none focus:border-jade-glow/60"
          />
          <GlowButton onClick={addVariant} variant="jade" size="sm">Add</GlowButton>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-light/20">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-ink-light/35 text-mist-light hover:text-cloud-white hover:border-accent/55 hover:bg-accent/20 transition-colors rounded-md">Cancel</button>
          <GlowButton onClick={handleSave} variant="jade" size="sm" glow disabled={saving}>{saving ? "Saving..." : "Save Variants"}</GlowButton>
        </div>
      </div>
    </GlowModal>
  );
}

// ─── Exercises Tab ────────────────────────────────────────────────────────────

function ExercisesTab({
  exercises,
  loading,
  exerciseVariants,
  dbOptions,
  lastEditedById,
  editHistory,
  userId,
  onAdd,
  onEdit,
  onQuickUpdate,
  onEditVariants,
  onDelete,
  onDuplicate,
  resolveExerciseName,
}: {
  exercises: SimpleExercise[];
  loading: boolean;
  exerciseVariants: Record<string, string[]>;
  dbOptions: ExerciseDbOptions;
  lastEditedById: Record<string, string>;
  editHistory: ExerciseEditHistoryEntry[];
  userId?: string;
  onAdd: () => void;
  onEdit: (ex: SimpleExercise) => void;
  onQuickUpdate: (exerciseId: string, data: Partial<ExerciseFormData>, field: "category" | "type" | "muscles") => Promise<void>;
  onEditVariants: (ex: SimpleExercise) => void;
  onDelete: (ex: SimpleExercise) => void;
  onDuplicate: (ex: SimpleExercise) => void;
  resolveExerciseName: (exercise: SimpleExercise) => string;
}) {
  const isMobile = useIsMobile();
  type ExerciseSortColumn = "exercise" | "category" | "type" | "muscles" | "progression" | "variants" | "dateAdded";
  type ExerciseSortState = { columnId: ExerciseSortColumn; direction: "asc" | "desc" };
  const resolvedUserId = userId && userId.trim().length > 0 ? userId : "anonymous";
  const viewPrefsStorageKey = `exercise-library-view-prefs:${resolvedUserId}`;
  const initialViewPrefs = useMemo(
    () => readExerciseLibraryViewPrefs(viewPrefsStorageKey) ?? getDefaultExerciseLibraryViewPrefs(),
    [viewPrefsStorageKey],
  );

  const [search, setSearch] = useState(initialViewPrefs.search);
  const [catFilter, setCatFilter] = useState<TrainingCategory | "">(initialViewPrefs.catFilter);
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "">(initialViewPrefs.muscleFilter);
  const [typeFilter, setTypeFilter] = useState<SimpleExerciseType | "">(initialViewPrefs.typeFilter);
  const [customOnly, setCustomOnly] = useState(initialViewPrefs.customOnly);
  const [page, setPage] = useState(1);
  const showFilters = true;
  const [sortState, setSortState] = useState<ExerciseSortState | null>(initialViewPrefs.sortState);
  const [quickEditExercise, setQuickEditExercise] = useState<SimpleExercise | null>(null);
  const [quickEditField, setQuickEditField] = useState<"category" | "type" | "muscles" | null>(null);
  const [quickCategory, setQuickCategory] = useState<TrainingCategory>((dbOptions.categories[0] as TrainingCategory) || "Other");
  const [quickType, setQuickType] = useState<SimpleExerciseType>((dbOptions.types[0] as SimpleExerciseType) || "bodyweight");
  const [quickMuscles, setQuickMuscles] = useState<MuscleGroup[]>([]);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [historyDockOpen, setHistoryDockOpen] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const historyDockRef = useRef<HTMLDivElement | null>(null);
  const [fitToScreenMode, setFitToScreenMode] = useState(initialViewPrefs.fitToScreenMode);
  const [tableViewportHeight, setTableViewportHeight] = useState(560);
  const [loadedViewPrefsKey, setLoadedViewPrefsKey] = useState(viewPrefsStorageKey);
  const [exerciseFocusMode, setExerciseFocusMode] = useState(false);

  const filtered = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (normalizedQuery) {
        const haystacks = [
          ex.name,
          resolveExerciseName(ex),
          ex.englishName || "",
          ex.vietnameseName || "",
          ...(ex.progression ?? []),
          ...((ex.variations ?? []).map((variation) => variation.name)),
        ].map((value) => String(value || "").toLowerCase());

        const hasMatch = haystacks.some((value) => value.includes(normalizedQuery));
        if (!hasMatch) return false;
      }
      if (catFilter && ex.category !== catFilter) return false;
      if (muscleFilter && !ex.muscleGroups.includes(muscleFilter)) return false;
      if (typeFilter && ex.exerciseType !== typeFilter) return false;
      if (customOnly && !ex.isCustom) return false;
      return true;
    });
  }, [exercises, search, catFilter, muscleFilter, typeFilter, customOnly, resolveExerciseName]);

  useEffect(() => {
    if (exercises.length === 0) return;

    const categories = new Set(exercises.map((ex) => ex.category));
    const types = new Set(exercises.map((ex) => ex.exerciseType));
    const muscles = new Set(exercises.flatMap((ex) => ex.muscleGroups));

    if (catFilter && !categories.has(catFilter)) {
      setCatFilter("");
    }
    if (typeFilter && !types.has(typeFilter)) {
      setTypeFilter("");
    }
    if (muscleFilter && !muscles.has(muscleFilter)) {
      setMuscleFilter("");
    }
  }, [exercises, catFilter, typeFilter, muscleFilter]);

  const sorted = useMemo(() => {
    if (!sortState) return filtered;

    const directionFactor = sortState.direction === "asc" ? 1 : -1;

    const getSortValue = (ex: SimpleExercise): string | number => {
      if (sortState.columnId === "exercise") return resolveExerciseName(ex).toLowerCase();
      if (sortState.columnId === "category") return ex.category.toLowerCase();
      if (sortState.columnId === "type") return ex.exerciseType.toLowerCase();
      if (sortState.columnId === "muscles") return ex.muscleGroups.join(", ").toLowerCase();
      if (sortState.columnId === "progression") return (ex.progression ?? []).join(", ").toLowerCase();
      if (sortState.columnId === "dateAdded") return ex.createdAt ? new Date(ex.createdAt).getTime() : 0;
      return (exerciseVariants[ex.id] ?? []).length;
    };

    return filtered
      .map((ex, index) => ({ ex, index }))
      .sort((a, b) => {
        const aVal = getSortValue(a.ex);
        const bVal = getSortValue(b.ex);

        if (typeof aVal === "number" && typeof bVal === "number") {
          if (aVal === bVal) return a.index - b.index;
          return (aVal - bVal) * directionFactor;
        }

        const cmp = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (cmp === 0) return a.index - b.index;
        return cmp * directionFactor;
      })
      .map((item) => item.ex);
  }, [exerciseVariants, filtered, sortState, resolveExerciseName]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const isOpenedTableMode = !fitToScreenMode;

  useEffect(() => { setPage(1); }, [search, catFilter, muscleFilter, typeFilter, customOnly, sortState]);

  useEffect(() => {
    if (loadedViewPrefsKey === viewPrefsStorageKey) return;
    const persisted = readExerciseLibraryViewPrefs(viewPrefsStorageKey) ?? getDefaultExerciseLibraryViewPrefs();
    setSearch(persisted.search);
    setCatFilter(persisted.catFilter);
    setMuscleFilter(persisted.muscleFilter);
    setTypeFilter(persisted.typeFilter);
    setCustomOnly(persisted.customOnly);
    setSortState(persisted.sortState);
    setFitToScreenMode(persisted.fitToScreenMode);
    setPage(1);
    setLoadedViewPrefsKey(viewPrefsStorageKey);
  }, [loadedViewPrefsKey, viewPrefsStorageKey]);

  useEffect(() => {
    if (loadedViewPrefsKey !== viewPrefsStorageKey) return;
    if (typeof window === "undefined") return;
    try {
      const prefs: ExerciseLibraryViewPrefs = {
        search,
        catFilter,
        muscleFilter,
        typeFilter,
        customOnly,
        showFilters: true,
        sortState,
        fitToScreenMode,
      };
      window.localStorage.setItem(viewPrefsStorageKey, JSON.stringify(prefs));
    } catch {
      // Ignore storage write errors.
    }
  }, [loadedViewPrefsKey, viewPrefsStorageKey, search, catFilter, muscleFilter, typeFilter, customOnly, sortState, fitToScreenMode]);

  useEffect(() => {
    if (isMobile) return;

    const syncViewportHeight = () => {
      const el = tableScrollRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const bottomGap = 14;
      const minHeight = 260;
      const available = Math.floor(window.innerHeight - rect.top - bottomGap);
      setTableViewportHeight(Math.max(minHeight, available));
    };

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    window.addEventListener("scroll", syncViewportHeight, { passive: true });
    return () => {
      window.removeEventListener("resize", syncViewportHeight);
      window.removeEventListener("scroll", syncViewportHeight);
    };
  }, [isMobile, loading, filtered.length, showFilters]);

  useEffect(() => {
    if (!historyDockOpen || isMobile) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !historyDockRef.current) return;
      if (historyDockRef.current.contains(target)) return;
      setHistoryDockOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [historyDockOpen, isMobile]);

  const chipBase = "text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-all duration-150 select-none";
  const chipOn = "bg-jade-deep/40 border-jade-glow/50 text-jade-light";
  const chipOff = "bg-ink-dark/60 border-ink-light/40 text-mist-light hover:border-jade/30";

  const sortFilterValue = useMemo(() => {
    if (!sortState) return "none";
    if (sortState.columnId === "dateAdded" && sortState.direction === "desc") return "recently-added";
    if (sortState.columnId === "dateAdded" && sortState.direction === "asc") return "oldest-added";
    return "custom";
  }, [sortState]);

  const activeFilterCount = [catFilter, muscleFilter, typeFilter, customOnly ? "1" : ""].filter(Boolean).length;

  const handleHeaderSort = (columnId: ExerciseSortColumn) => {
    setSortState((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: "asc" };
      return { columnId, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const renderSortableHeader = (label: string, columnId: ExerciseSortColumn) => {
    const isSorted = sortState?.columnId === columnId;
    const arrow = isSorted ? (sortState?.direction === "asc" ? "↑" : "↓") : null;
    return (
      <span className="inline-flex items-center gap-1 font-semibold">
        <span>{label}</span>
        {arrow && (
          <span className="text-[10px]" style={{ color: "var(--accent)" }}>
            {arrow}
          </span>
        )}
      </span>
    );
  };

  const openQuickEdit = (field: "category" | "type" | "muscles", ex: SimpleExercise) => {
    setQuickError("");
    setQuickEditExercise(ex);
    setQuickEditField(field);
    setQuickCategory(ex.category);
    setQuickType(ex.exerciseType);
    setQuickMuscles(ex.muscleGroups);
  };

  const closeQuickEdit = () => {
    if (quickSaving) return;
    setQuickEditExercise(null);
    setQuickEditField(null);
    setQuickError("");
  };

  const toggleQuickMuscle = (mg: MuscleGroup) => {
    setQuickMuscles((prev) => (prev.includes(mg) ? prev.filter((x) => x !== mg) : [...prev, mg]));
  };

  const saveQuickEdit = async () => {
    if (!quickEditExercise || !quickEditField) return;
    setQuickError("");
    setQuickSaving(true);
    try {
      if (quickEditField === "category") {
        await onQuickUpdate(quickEditExercise.id, { category: quickCategory }, "category");
      } else if (quickEditField === "type") {
        await onQuickUpdate(quickEditExercise.id, { exerciseType: quickType }, "type");
      } else {
        if (quickMuscles.length === 0) {
          setQuickError("Select at least one muscle group");
          setQuickSaving(false);
          return;
        }
        await onQuickUpdate(quickEditExercise.id, { muscleGroups: quickMuscles }, "muscles");
      }
      closeQuickEdit();
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setQuickSaving(false);
    }
  };

  const formatDateValue = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getLastEditedDisplay = (ex: SimpleExercise) => {
    const source = lastEditedById[ex.id] || ex.updatedAt || ex.createdAt;
    return formatDateValue(source);
  };

  const getDateAddedDisplay = (ex: SimpleExercise) => formatDateValue(ex.createdAt);

  const renderToolbar = () => (
    <div className="space-y-2 mb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-jade-glow uppercase tracking-wider">Exercise Library</h3>
        {isMobile && filtered.length > 0 && (
          <MobileFocusTrigger onClick={() => setExerciseFocusMode(true)} />
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ink-light bg-ink-dark pl-9 pr-8 py-2 text-xs text-cloud-white outline-none"
          />
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M16.5 16.5l4 4" />
          </svg>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold leading-none"
              style={{ color: "var(--text-muted)" }}
              aria-label="Clear search"
            >
              x
            </button>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap gap-2 shrink-0 sm:w-auto sm:flex-nowrap">
          {!isMobile && filtered.length > 0 && (
            <button
              type="button"
              role="switch"
              aria-checked={isOpenedTableMode}
              onClick={() => setFitToScreenMode((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition-all duration-100 hover:scale-105 active:scale-95"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}
              title={isOpenedTableMode ? "Full-page table" : "Fit-to-screen table"}
            >
              <span>Open</span>
              <span
                className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: isOpenedTableMode
                    ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                    : "color-mix(in srgb, var(--border) 55%, transparent)",
                }}
              >
                <span
                  className="absolute h-3 w-3 rounded-full transition-all"
                  style={{
                    left: isOpenedTableMode ? "16px" : "2px",
                    backgroundColor: isOpenedTableMode ? "var(--accent)" : "var(--text-muted)",
                  }}
                />
              </span>
            </button>
          )}
          <Link
            href="/dashboard/exercises/db-settings"
            className="inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-300 flex-1 sm:flex-none"
            style={{
              borderColor: "color-mix(in srgb, var(--jade) 50%, var(--border))",
              color: "var(--jade-light)",
              backgroundColor: "color-mix(in srgb, var(--jade-deep) 80%, transparent)",
            }}
          >
            DB Settings
          </Link>
          <div className="flex-1 sm:flex-none">
            <GlowButton onClick={onAdd} variant="jade" size="sm" className="w-full sm:w-auto">+ Add Exercise</GlowButton>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center px-0.5 py-1">
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as TrainingCategory | "")} className="w-full sm:w-auto px-2 py-1.5 text-[11px] outline-none border border-ink-light bg-ink-dark text-cloud-white rounded-lg transition-colors cursor-pointer">
                <option value="">All Categories</option>
                {dbOptions.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value as MuscleGroup | "")} className="w-full sm:w-auto px-2 py-1.5 text-[11px] outline-none border border-ink-light bg-ink-dark text-cloud-white rounded-lg transition-colors cursor-pointer">
                <option value="">All Muscles</option>
                {dbOptions.muscles.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as SimpleExerciseType | "")} className="w-full sm:w-auto px-2 py-1.5 text-[11px] outline-none border border-ink-light bg-ink-dark text-cloud-white rounded-lg transition-colors cursor-pointer">
                <option value="">All Types</option>
                {dbOptions.types.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <select
                value={sortFilterValue}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "none") {
                    setSortState(null);
                    return;
                  }
                  if (value === "recently-added") {
                    setSortState({ columnId: "dateAdded", direction: "desc" });
                    return;
                  }
                  if (value === "oldest-added") {
                    setSortState({ columnId: "dateAdded", direction: "asc" });
                  }
                }}
                className="w-full sm:w-auto px-2 py-1.5 text-[11px] outline-none border transition-colors cursor-pointer hover:border-accent/60 hover:bg-surface-hover focus:border-accent/70"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--surface)", borderRadius: "2px" }}
              >
                <option value="none">Sort: None</option>
                <option value="recently-added">Sort: Recently added</option>
                <option value="oldest-added">Sort: Oldest added</option>
                {sortFilterValue === "custom" && <option value="custom">Sort: Custom (table header)</option>}
              </select>
              <button onClick={() => setCustomOnly((v) => !v)} className={`${chipBase} ${customOnly ? chipOn : chipOff}`} style={{ borderRadius: "2px" }}>Custom Only</button>
              {activeFilterCount > 0 && (
                <button onClick={() => { setCatFilter(""); setMuscleFilter(""); setTypeFilter(""); setCustomOnly(false); }} className="text-[10px] transition-colors" style={{ color: "var(--danger)" }}>Clear all</button>
              )}
      </div>
    </div>
  );

  return (
    <div className="nyaa-history-table-shell">
      <GlowCard glow="jade" hoverable={false}>
        {renderToolbar()}
      {loading ? (
        <div className="px-3 py-10 text-center text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
          Loading exercises...
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-3 py-10 text-center space-y-3" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
          <p className="text-sm">{exercises.length === 0 ? "No exercises yet" : "No matching exercises"}</p>
          {exercises.length === 0 && <GlowButton onClick={onAdd} variant="jade" size="sm">+ Add Your First Exercise</GlowButton>}
        </div>
      ) : (
        <>
          <div
            ref={tableScrollRef}
            className={fitToScreenMode && !isMobile ? "overflow-auto" : "overflow-x-auto"}
            style={{
              backgroundColor: "var(--surface)",
              height: fitToScreenMode && !isMobile ? `${tableViewportHeight}px` : "auto",
              maxHeight: fitToScreenMode && !isMobile ? `${tableViewportHeight}px` : "none",
            }}
          >
            <table className="w-full text-[10px] border-collapse" style={{ minWidth: "1080px", backgroundColor: "var(--surface)" }}>
              <thead className="sticky top-0 z-10" style={{ backgroundColor: "var(--surface)", boxShadow: "0 1px 0 var(--border)" }}>
                <tr>
                  <th className="px-1.5 py-1.5 text-center whitespace-nowrap">Image</th>
                  <th
                    className="px-1.5 py-1.5 text-left whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleHeaderSort("exercise")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleHeaderSort("exercise");
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    {renderSortableHeader("Exercise", "exercise")}
                  </th>
                  <th
                    className="px-1.5 py-1.5 text-left whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleHeaderSort("category")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleHeaderSort("category");
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    {renderSortableHeader("Category", "category")}
                  </th>
                  <th
                    className="px-1.5 py-1.5 text-left whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleHeaderSort("type")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleHeaderSort("type");
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    {renderSortableHeader("Type", "type")}
                  </th>
                  <th
                    className="px-1.5 py-1.5 text-left whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleHeaderSort("muscles")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleHeaderSort("muscles");
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    {renderSortableHeader("Muscles", "muscles")}
                  </th>
                  <th
                    className="px-1.5 py-1.5 text-center whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleHeaderSort("progression")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleHeaderSort("progression");
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    {renderSortableHeader("Progression", "progression")}
                  </th>
                  <th
                    className="px-1.5 py-1.5 text-center whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleHeaderSort("variants")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleHeaderSort("variants");
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    {renderSortableHeader("Variants", "variants")}
                  </th>
                  <th className="px-1.5 py-1.5 text-center whitespace-nowrap">Date Added</th>
                  <th className="px-1.5 py-1.5 text-center whitespace-nowrap">Last Edited</th>
                  <th className="px-1.5 py-1.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {paginated.map((ex) => {
                    return (
                      <motion.tr
                        key={ex.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                      >
                        <td className="px-1.5 py-1.5 text-center align-middle">
                          <div className="flex justify-center">
                            <ExerciseImageBox className="h-8 w-8 shrink-0" compact />
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <div className="min-w-0">
                            <div className="truncate font-medium" style={{ color: "var(--text-primary)" }}>{resolveExerciseName(ex)}</div>
                            <div className="flex items-center gap-1 pt-0.5">
                              <DifficultyBadge difficulty={ex.difficulty} />
                            </div>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => openQuickEdit("category", ex)}
                            className="inline-flex items-center gap-1 border px-1.5 py-1 text-[11px] transition-colors cursor-pointer text-text-primary bg-surface border-border-custom hover:text-accent hover:border-accent/40 hover:bg-accent/8"
                            style={{ borderRadius: "2px" }}
                            title="Edit category"
                          >
                            <span>{getCategoryIcon(ex.category)}</span>
                            <span>{ex.category}</span>
                          </button>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => openQuickEdit("type", ex)}
                            className="inline-flex items-center gap-1 border px-1.5 py-1 text-[11px] transition-colors cursor-pointer text-text-primary bg-surface border-border-custom hover:text-accent hover:border-accent/40 hover:bg-accent/8"
                            style={{ borderRadius: "2px" }}
                            title="Edit type"
                          >
                            <span>{getExerciseTypeIcon(ex.exerciseType)}</span>
                            <span className="capitalize">{ex.exerciseType}</span>
                          </button>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => openQuickEdit("muscles", ex)}
                            className="px-2 py-1 text-[10px] border transition-colors cursor-pointer text-text-secondary bg-surface border-border-custom hover:text-accent hover:border-accent/40 hover:bg-accent/8"
                            style={{ borderRadius: "2px" }}
                            title="Edit muscle groups"
                          >
                            Manage ({ex.muscleGroups.length})
                          </button>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <span
                            className="inline-block max-w-[10rem] truncate px-1.5 py-0.5 text-[9px] border"
                            style={{ borderRadius: "2px", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                            title={(ex.progression ?? []).join(", ") || "-"}
                          >
                            {(ex.progression ?? []).length > 0
                              ? `${(ex.progression ?? []).length} stage${(ex.progression ?? []).length === 1 ? "" : "s"}: ${(ex.progression ?? []).join(", ")}`
                              : "-"}
                          </span>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <button
                            onClick={() => onEditVariants(ex)}
                            className="px-2 py-1 text-[10px] border transition-colors cursor-pointer text-text-secondary bg-surface border-border-custom hover:text-accent hover:border-accent/40 hover:bg-accent/8"
                            style={{ borderRadius: "2px" }}
                          >
                            Manage ({(exerciseVariants[ex.id] ?? []).length})
                          </button>
                        </td>
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {getDateAddedDisplay(ex)}
                        </td>
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {getLastEditedDisplay(ex)}
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <ActionsDropdown exercise={ex} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, sorted.length)} of {sorted.length}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[11px] border disabled:opacity-30 transition-colors" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)", borderRadius: "2px" }}>Prev</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((n) => (
                  <button key={n} onClick={() => setPage(n)} className="px-2 py-1 text-[11px] border transition-colors" style={{ borderColor: page === n ? "var(--accent)" : "var(--border)", color: page === n ? "var(--accent)" : "var(--text-secondary)", backgroundColor: page === n ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--surface)", borderRadius: "2px" }}>{n}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-[11px] border disabled:opacity-30 transition-colors" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)", borderRadius: "2px" }}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
      </GlowCard>

      {isMobile && (
        <MobileFocusOverlay
          isOpen={exerciseFocusMode}
          onDismiss={() => setExerciseFocusMode(false)}
          label="Exercise Library"
        >
          <div className="space-y-1.5">
            {sorted.length === 0 ? (
              <div className="rounded-lg border px-3 py-4 text-center text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
                No matching exercises
              </div>
            ) : (
              sorted.map((ex) => (
                <div
                  key={`focus-${ex.id}`}
                  className="border rounded-lg px-3 py-2.5 flex flex-col gap-1.5"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{resolveExerciseName(ex)}</span>
                    <DifficultyBadge difficulty={ex.difficulty} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="inline-flex items-center gap-1 border px-1.5 py-0.5" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                      {getCategoryIcon(ex.category)} {ex.category}
                    </span>
                    <span className="inline-flex items-center gap-1 border px-1.5 py-0.5" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                      {getExerciseTypeIcon(ex.exerciseType)} <span className="capitalize">{ex.exerciseType}</span>
                    </span>
                    {ex.muscleGroups.length > 0 && (
                      <span className="border px-1.5 py-0.5" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                        {ex.muscleGroups.join(", ")}
                      </span>
                    )}
                  </div>
                  {(ex.progression ?? []).length > 0 && (
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Progressions: {(ex.progression ?? []).join(" → ")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </MobileFocusOverlay>
      )}

      <GlowModal
        isOpen={quickEditExercise !== null && quickEditField !== null}
        onClose={closeQuickEdit}
        title={quickEditField === "category" ? "Edit Category" : quickEditField === "type" ? "Edit Type" : "Edit Muscle Groups"}
        panelClassName="!max-w-lg"
      >
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {quickEditExercise ? resolveExerciseName(quickEditExercise) : ""}
          </p>
          {quickError && (
            <div className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)" }}>
              {quickError}
            </div>
          )}

          {quickEditField === "category" && (
            <div className="flex flex-wrap gap-2">
              {dbOptions.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setQuickCategory(cat)}
                  className={`px-2.5 py-1.5 text-xs border transition-colors ${quickCategory === cat ? "text-accent border-accent bg-accent/10" : "text-text-primary border-border-custom bg-surface hover:text-cloud-white hover:border-accent/55 hover:bg-accent/18"}`}
                  style={{
                    borderRadius: "2px",
                  }}
                >
                  {getCategoryIcon(cat)} {cat}
                </button>
              ))}
            </div>
          )}

          {quickEditField === "type" && (
            <div className="flex flex-wrap gap-2">
              {dbOptions.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setQuickType(type)}
                  className={`px-2.5 py-1.5 text-xs border transition-colors ${quickType === type ? "text-accent border-accent bg-accent/10" : "text-text-primary border-border-custom bg-surface hover:text-cloud-white hover:border-accent/55 hover:bg-accent/18"}`}
                  style={{
                    borderRadius: "2px",
                  }}
                >
                  {getExerciseTypeIcon(type)} {type}
                </button>
              ))}
            </div>
          )}

          {quickEditField === "muscles" && (
            <div className="flex flex-wrap gap-2">
              {dbOptions.muscles.map((mg) => (
                <button
                  key={mg}
                  type="button"
                  onClick={() => toggleQuickMuscle(mg)}
                  className={`px-2.5 py-1.5 text-xs border transition-colors ${quickMuscles.includes(mg) ? "text-accent border-accent bg-accent/10" : "text-text-primary border-border-custom bg-surface hover:text-cloud-white hover:border-accent/55 hover:bg-accent/18"}`}
                  style={{
                    borderRadius: "2px",
                  }}
                >
                  {mg}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={closeQuickEdit} className="px-3 py-1.5 text-xs border border-ink-light/35 text-mist-light hover:text-cloud-white hover:border-accent/55 hover:bg-accent/20 transition-colors rounded-md">
              Cancel
            </button>
            <GlowButton onClick={saveQuickEdit} variant="jade" size="sm" disabled={quickSaving}>
              {quickSaving ? "Saving..." : "Save"}
            </GlowButton>
          </div>
        </div>
      </GlowModal>

      {!isMobile && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-0 right-3 z-50">
            {historyDockOpen ? (
              <div
                ref={historyDockRef}
                className="w-[min(360px,calc(100vw-0.25rem))] rounded-t-xl border border-ink-light shadow-2xl overflow-hidden bg-ink-deep"
              >
                <div
                  className="flex items-center justify-between px-3 py-2 border-b border-ink-light transition-all duration-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-jade-glow uppercase tracking-wider">
                      Edit History
                    </p>
                    <p className="text-[11px] truncate text-mist-dark">
                      Latest library edits by users
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Minimize edit history"
                      title="Minimize"
                      onClick={() => setHistoryDockOpen(false)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-colors hover:bg-ink-mid/35"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      _
                    </button>
                    <button
                      type="button"
                      aria-label="Close edit history"
                      title="Close"
                      onClick={() => setHistoryDockOpen(false)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-colors hover:bg-ink-mid/35"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      x
                    </button>
                  </div>
                </div>

                <div className="max-h-[320px] overflow-y-auto sidebar-scroll">
                  {editHistory.length === 0 ? (
                    <p className="text-xs px-2 py-3" style={{ color: "var(--text-muted)" }}>
                      No edits recorded yet.
                    </p>
                  ) : (
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                          <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}>When</th>
                          <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}>User</th>
                          <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}>Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editHistory.slice(0, 40).map((entry) => {
                          const when = new Date(entry.editedAt);
                          const whenText = Number.isNaN(when.getTime())
                            ? "—"
                            : `${when.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })} ${when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
                          const fieldStyle = getHistoryFieldStyle(entry.field);
                          return (
                            <tr key={entry.id} className="border-b" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)" }}>
                              <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{whenText}</td>
                              <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{entry.userName}</td>
                              <td className="px-2 py-1" style={{ color: "var(--text-primary)" }}>
                                <div className="truncate" title={`${entry.exerciseName} | ${entry.field}: ${entry.beforeValue} -> ${entry.afterValue}`}>
                                  <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{entry.exerciseName}</span>
                                  {" · "}
                                  <span
                                    className="inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-bold uppercase tracking-[0.08em]"
                                    style={{
                                      color: fieldStyle.text,
                                      backgroundColor: fieldStyle.bg,
                                      borderColor: fieldStyle.border,
                                    }}
                                  >
                                    {entry.field}
                                  </span>
                                  {": "}
                                  <span className="font-medium" style={{ color: "var(--text-muted)" }}>{entry.beforeValue || "—"}</span>
                                  <span className="px-1 font-bold" style={{ color: "var(--state-warning)" }}>→</span>
                                  <span className="font-semibold" style={{ color: "var(--state-success)" }}>{entry.afterValue || "—"}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setHistoryDockOpen(true)}
                className="w-[min(200px,calc(100vw-0.25rem))] rounded-t-xl border border-ink-light border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider shadow-lg transition-all duration-200 bg-ink-deep text-cloud-white hover:bg-ink-mid/30"
              >
                Edit History
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExerciseDBPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const userId = user?.id;

  const resolveExerciseName = useCallback((exercise: SimpleExercise) => {
    return getExerciseDisplayName(
      {
        name: exercise.englishName || exercise.name,
        wuxiaName: exercise.vietnameseName || "",
        englishName: exercise.englishName,
        vietnameseName: exercise.vietnameseName,
      },
      settings.terminologyMode,
      settings.showExerciseForeignLanguage,
    );
  }, [settings.terminologyMode, settings.showExerciseForeignLanguage]);

  const [exercises, setExercises] = useState<SimpleExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [exerciseVariants, setExerciseVariants] = useState<Record<string, string[]>>({});
  const [dbOptions, setDbOptions] = useState<ExerciseDbOptions>(getDefaultExerciseDbOptions());
  const [lastEditedById, setLastEditedById] = useState<Record<string, string>>({});
  const [editHistory, setEditHistory] = useState<ExerciseEditHistoryEntry[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingExercise, setEditingExercise] = useState<SimpleExercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SimpleExercise | null>(null);
  const [variantsTarget, setVariantsTarget] = useState<SimpleExercise | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.get<{ exercises: SimpleExercise[] }>("/api/exercise-library");
      if (data.exercises) {
        setExercises(data.exercises);
        setExerciseVariants(
          Object.fromEntries(
            data.exercises.map((exercise) => [exercise.id, (exercise.variations ?? []).map((variation) => variation.name)]),
          ),
        );
      }
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  const fetchDbOptions = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.get<{ options?: ExerciseDbOptions }>("/api/exercise-library/db-settings");
      if (data.options) {
        setDbOptions(data.options);
      }
    } catch (err) {
      console.error("Failed to fetch DB settings:", err);
    }
  }, [userId]);

  useEffect(() => {
    void fetchDbOptions();
  }, [fetchDbOptions]);

  const fetchEditHistory = useCallback(async () => {
    if (!userId) {
      setEditHistory([]);
      setLastEditedById({});
      return;
    }

    try {
      const data = await api.get<{
        history: ExerciseEditHistoryEntry[];
        lastEditedById: Record<string, string>;
      }>("/api/exercise-library/edit-history");
      setEditHistory(Array.isArray(data.history) ? data.history : []);
      setLastEditedById(data.lastEditedById ?? {});
    } catch (err) {
      console.error("Failed to fetch exercise edit history:", err);
    }
  }, [userId]);

  useEffect(() => {
    void fetchEditHistory();
  }, [fetchEditHistory]);

  const appendEditHistory = useCallback(async (entry: Omit<ExerciseEditHistoryEntry, "id" | "userName" | "editedAt">) => {
    const data = await api.post<{ entry: ExerciseEditHistoryEntry }>("/api/exercise-library/edit-history", entry);
    const nextEntry = data.entry;

    setEditHistory((prev) => [nextEntry, ...prev].slice(0, 150));
    setLastEditedById((prev) => ({
      ...prev,
      [nextEntry.exerciseId]: nextEntry.editedAt,
    }));
  }, []);

  const handleExerciseVariantsSave = useCallback(async (exerciseId: string, variants: string[]) => {
    const existing = exercises.find((item) => item.id === exerciseId);
    const previousVariants = exerciseVariants[exerciseId] ?? [];

    if (!existing) return;
    const beforeValue = previousVariants.length > 0 ? previousVariants.join(", ") : "—";
    const afterValue = variants.length > 0 ? variants.join(", ") : "—";
    if (beforeValue === afterValue) return;

    await api.patch(`/api/exercise-library/${exerciseId}`, { variations: variants });
    await fetchExercises();

    await appendEditHistory({
      exerciseId,
      exerciseName: existing.name,
      field: "Variants",
      beforeValue,
      afterValue,
    });
    window.dispatchEvent(new Event("progression-exercises-updated"));
  }, [appendEditHistory, exerciseVariants, exercises, fetchExercises]);

  const handleAdd = () => { setEditingExercise(null); setModalMode("add"); setModalOpen(true); };
  const handleEdit = (ex: SimpleExercise) => { setEditingExercise(ex); setModalMode("edit"); setModalOpen(true); };

  const handleSave = async (data: ExerciseFormData) => {
    if (!userId) throw new Error("Not logged in");
    if (modalMode === "add") {
      const created = await api.post<{ exercise?: SimpleExercise }>("/api/exercise-library", { ...data });
      const createdExercise = created.exercise;
      if (createdExercise) {
        await appendEditHistory({
          exerciseId: createdExercise.id,
          exerciseName: createdExercise.name,
          field: "Created",
          beforeValue: "—",
          afterValue: "New exercise added",
        });
      }
    } else if (editingExercise) {
      const beforeName = editingExercise.name;
      const beforeCategory = editingExercise.category;
      const beforeType = editingExercise.exerciseType;
      const beforeMuscles = editingExercise.muscleGroups.join(", ");
      await api.patch(`/api/exercise-library/${editingExercise.id}`, { ...data });
      const afterName = data.name.trim();
      const afterMuscles = data.muscleGroups.join(", ");

      if (beforeName !== afterName) {
        await appendEditHistory({
          exerciseId: editingExercise.id,
          exerciseName: editingExercise.name,
          field: "Name",
          beforeValue: beforeName,
          afterValue: afterName,
        });
      }
      if (beforeCategory !== data.category) {
        await appendEditHistory({
          exerciseId: editingExercise.id,
          exerciseName: editingExercise.name,
          field: "Category",
          beforeValue: beforeCategory,
          afterValue: data.category,
        });
      }
      if (beforeType !== data.exerciseType) {
        await appendEditHistory({
          exerciseId: editingExercise.id,
          exerciseName: editingExercise.name,
          field: "Type",
          beforeValue: beforeType,
          afterValue: data.exerciseType,
        });
      }
      if (beforeMuscles !== afterMuscles) {
        await appendEditHistory({
          exerciseId: editingExercise.id,
          exerciseName: editingExercise.name,
          field: "Muscles",
          beforeValue: beforeMuscles,
          afterValue: afterMuscles,
        });
      }
    }
    await fetchExercises();
    window.dispatchEvent(new Event("progression-exercises-updated"));
  };

  const handleQuickUpdate = useCallback(async (exerciseId: string, data: Partial<ExerciseFormData>, field: "category" | "type" | "muscles") => {
    if (!userId) throw new Error("Not logged in");
    const existing = exercises.find((item) => item.id === exerciseId);
    await api.patch(`/api/exercise-library/${exerciseId}`, data);
    await fetchExercises();
    if (existing) {
      const beforeValue = field === "category"
        ? existing.category
        : field === "type"
          ? existing.exerciseType
          : existing.muscleGroups.join(", ");
      const afterValue = field === "category"
        ? String(data.category || existing.category)
        : field === "type"
          ? String(data.exerciseType || existing.exerciseType)
          : Array.isArray(data.muscleGroups)
            ? data.muscleGroups.join(", ")
            : existing.muscleGroups.join(", ");

      await appendEditHistory({
        exerciseId,
        exerciseName: existing.name,
        field: field === "category" ? "Category" : field === "type" ? "Type" : "Muscles",
        beforeValue,
        afterValue,
      });
    }
    window.dispatchEvent(new Event("progression-exercises-updated"));
  }, [appendEditHistory, exercises, fetchExercises, userId]);

  const handleDelete = async () => {
    if (!userId || !deleteTarget) return;
    const deletedExerciseId = deleteTarget.id;
    const deletedExerciseName = deleteTarget.name;
    await api.delete(`/api/exercise-library/${deleteTarget.id}`);
    await appendEditHistory({
      exerciseId: deletedExerciseId,
      exerciseName: deletedExerciseName,
      field: "Deleted",
      beforeValue: deletedExerciseName,
      afterValue: "Exercise removed",
    });
    await fetchExercises();
    void fetchEditHistory();
    window.dispatchEvent(new Event("progression-exercises-updated"));
  };

  const handleDuplicate = async (ex: SimpleExercise) => {
    if (!userId) return;
    try {
      const created = await api.post<{ exercise?: SimpleExercise }>("/api/exercise-library", {
        name: `${ex.englishName || ex.name} (Copy)`, category: ex.category, exerciseType: ex.exerciseType,
        muscleGroups: ex.muscleGroups, equipment: ex.equipment || [],
        difficulty: ex.difficulty || "", description: ex.description || "",
        instructions: ex.instructions || [],
        variations: (ex.variations ?? []).map((variation) => variation.name),
      });
      const createdExercise = created.exercise;
      if (createdExercise) {
        await appendEditHistory({
          exerciseId: createdExercise.id,
          exerciseName: createdExercise.name,
          field: "Duplicated",
          beforeValue: ex.name,
          afterValue: createdExercise.name,
        });
      }
      await fetchExercises();
      window.dispatchEvent(new Event("progression-exercises-updated"));
    } catch (err) { console.error("Duplicate failed:", err); }
  };

  const handleAppendPendingExercise = useCallback(async (exercise: SimpleExercise) => {
    if (pendingActionId) return;
    setPendingActionId(exercise.id);
    try {
      await api.post(`/api/exercise-library/${exercise.id}/pending`, { action: "append" });
      await appendEditHistory({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        field: "Approved",
        beforeValue: "Pending",
        afterValue: "Appended to database",
      });
      await fetchExercises();
      void fetchEditHistory();
      window.dispatchEvent(new Event("progression-exercises-updated"));
    } catch (err) {
      console.error("Failed to append pending exercise:", err);
    } finally {
      setPendingActionId(null);
    }
  }, [appendEditHistory, fetchEditHistory, fetchExercises, pendingActionId]);

  const handleDeletePendingExercise = useCallback(async (exercise: SimpleExercise) => {
    if (pendingActionId) return;
    const confirmed = typeof window !== "undefined"
      ? window.confirm(`Delete pending exercise \"${resolveExerciseName(exercise)}\"? Existing log rows will remain as \"Deleted exercise\".`)
      : true;
    if (!confirmed) return;

    setPendingActionId(exercise.id);
    try {
      await api.post(`/api/exercise-library/${exercise.id}/pending`, { action: "delete" });
      await appendEditHistory({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        field: "Deleted",
        beforeValue: "Pending",
        afterValue: "Marked as deleted exercise",
      });
      await fetchExercises();
      void fetchEditHistory();
      window.dispatchEvent(new Event("progression-exercises-updated"));
    } catch (err) {
      console.error("Failed to delete pending exercise:", err);
    } finally {
      setPendingActionId(null);
    }
  }, [appendEditHistory, fetchEditHistory, fetchExercises, pendingActionId]);

  return (
    <PageLayout
      title="Exercise DB"
      subtitle="Manage your exercise database"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-6 px-0 py-2 sm:py-3">
        <div className="space-y-3">
          <OverviewTab
            exercises={exercises}
            onEdit={handleEdit}
            onAppend={handleAppendPendingExercise}
            onDeletePending={handleDeletePendingExercise}
            pendingActionId={pendingActionId}
            resolveExerciseName={resolveExerciseName}
          />

          <ExercisesTab
            exercises={exercises}
            loading={loading}
            exerciseVariants={exerciseVariants}
            dbOptions={dbOptions}
            lastEditedById={lastEditedById}
            editHistory={editHistory}
            userId={userId}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onQuickUpdate={handleQuickUpdate}
            onEditVariants={setVariantsTarget}
            onDelete={setDeleteTarget}
            onDuplicate={handleDuplicate}
            resolveExerciseName={resolveExerciseName}
          />
        </div>
      </div>

      <ExerciseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        exercise={editingExercise}
        mode={modalMode}
        dbOptions={dbOptions}
      />

      <ExerciseVariantsModal
        isOpen={variantsTarget !== null}
        onClose={() => setVariantsTarget(null)}
        exercise={variantsTarget}
        variants={variantsTarget ? (exerciseVariants[variantsTarget.id] ?? []) : []}
        onSave={handleExerciseVariantsSave}
        resolveExerciseName={resolveExerciseName}
      />

      <DeleteModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget ? resolveExerciseName(deleteTarget) : ""}
      />
    </PageLayout>
  );
}
