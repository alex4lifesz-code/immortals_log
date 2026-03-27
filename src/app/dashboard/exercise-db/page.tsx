"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/context/AppContext";
import GlowButton from "@/components/ui/GlowButton";
import { api } from "@/lib/api-client";
import type {
  SimpleExercise,
  TrainingCategory,
  SimpleExerciseType,
  MuscleGroup,
  Difficulty,
} from "@/lib/exercise-types";
import {
  ALL_TRAINING_CATEGORIES,
  ALL_EXERCISE_TYPES,
  ALL_MUSCLE_GROUPS,
  ALL_DIFFICULTIES,
  ALL_EQUIPMENT,
  getExerciseTypeIcon,
  getCategoryIcon,
} from "@/lib/exercise-types";
import { GlowModal } from "@/components/ui/GlowCard";
import ExerciseImageBox from "@/components/exercise/ExerciseImageBox";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "overview" | "exercises" | "variants";

interface ExerciseFormData {
  name: string;
  category: TrainingCategory;
  exerciseType: SimpleExerciseType;
  muscleGroups: MuscleGroup[];
  equipment: string[];
  difficulty: Difficulty | "";
  description: string;
  instructions: string[];
}

const ITEMS_PER_PAGE = 25;

const VARIANT_STORAGE_KEY = "exercise-db-variants";

// ─── Variant helpers ──────────────────────────────────────────────────────────

function loadVariants(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VARIANT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVariants(variants: Record<string, string[]>) {
  try {
    localStorage.setItem(VARIANT_STORAGE_KEY, JSON.stringify(variants));
  } catch {}
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
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="text-mist-dark hover:text-mist-light transition-colors px-2 py-1 rounded hover:bg-ink-mid/40 text-base"
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-36 rounded-lg border border-ink-light/40 bg-ink-deep shadow-xl">
            <button onClick={() => { setOpen(false); onEdit(exercise); }} className="w-full text-left px-3 py-2 text-xs text-mist-light hover:bg-ink-mid/40 hover:text-cloud-white transition-colors rounded-t-lg">✏️ Edit</button>
            <button onClick={() => { setOpen(false); onDuplicate(exercise); }} className="w-full text-left px-3 py-2 text-xs text-mist-light hover:bg-ink-mid/40 hover:text-cloud-white transition-colors">📋 Duplicate</button>
            <button onClick={() => { setOpen(false); onDelete(exercise); }} className="w-full text-left px-3 py-2 text-xs text-crimson-light hover:bg-crimson-deep/20 transition-colors rounded-b-lg">🗑️ Delete</button>
          </div>
        </>
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
  customVariants,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ExerciseFormData) => Promise<void>;
  exercise?: SimpleExercise | null;
  mode: "add" | "edit";
  customVariants: Record<string, string[]>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TrainingCategory>("GYM");
  const [exerciseType, setExerciseType] = useState<SimpleExerciseType>("weighted");
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Merge built-in + custom options
  const allCategories = useMemo(() => {
    const custom = customVariants["category"] ?? [];
    return [...ALL_TRAINING_CATEGORIES, ...custom.filter((c) => !(ALL_TRAINING_CATEGORIES as string[]).includes(c))];
  }, [customVariants]);

  const allTypes = useMemo(() => {
    const custom = customVariants["exerciseType"] ?? [];
    return [...ALL_EXERCISE_TYPES, ...custom.filter((c) => !(ALL_EXERCISE_TYPES as string[]).includes(c))];
  }, [customVariants]);

  const allMuscles = useMemo(() => {
    const custom = customVariants["muscleGroup"] ?? [];
    return [...ALL_MUSCLE_GROUPS, ...custom.filter((c) => !(ALL_MUSCLE_GROUPS as string[]).includes(c))];
  }, [customVariants]);

  useEffect(() => {
    if (!isOpen) return;
    if (exercise && mode === "edit") {
      setName(exercise.name);
      setCategory(exercise.category);
      setExerciseType(exercise.exerciseType);
      setMuscleGroups(exercise.muscleGroups);
      setEquipment(exercise.equipment || []);
      setDifficulty(exercise.difficulty || "");
      setDescription(exercise.description || "");
      setInstructions(exercise.instructions?.length ? exercise.instructions : [""]);
    } else {
      setName(""); setCategory("GYM"); setExerciseType("weighted");
      setMuscleGroups([]); setEquipment([]); setDifficulty("");
      setDescription(""); setInstructions([""]);
    }
    setError("");
  }, [isOpen, exercise, mode]);

  const toggle = <T extends string>(arr: T[], item: T, set: (v: T[]) => void) =>
    set(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);

  const handleSubmit = async () => {
    setError("");
    if (name.trim().length < 2) { setError("Name must be at least 2 characters"); return; }
    if (muscleGroups.length === 0) { setError("Select at least one muscle group"); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), category, exerciseType,
        muscleGroups, equipment, difficulty,
        description: description.trim(),
        instructions: instructions.filter((s) => s.trim()),
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
  const chipOff = "bg-ink-dark/60 border-ink-light/40 text-mist-light hover:border-jade/30 hover:text-cloud-white";

  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title={mode === "add" ? "Add Exercise" : "Edit Exercise"} panelClassName="!max-w-2xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && <div className="rounded-lg border border-crimson/40 bg-crimson-deep/20 px-3 py-2 text-xs text-crimson-light">{error}</div>}

        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Exercise Name *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Incline Dumbbell Press" className={inputCls} maxLength={200} />
        </label>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Category *</span>
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => (
              <button key={cat} type="button" onClick={() => setCategory(cat as TrainingCategory)} className={`${chipBase} ${category === cat ? chipOn : chipOff}`}>
                {getCategoryIcon(cat as TrainingCategory)} {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Type *</span>
          <div className="flex flex-wrap gap-2">
            {allTypes.map((type) => (
              <button key={type} type="button" onClick={() => setExerciseType(type as SimpleExerciseType)} className={`flex-1 min-w-[90px] ${chipBase} text-center ${exerciseType === type ? chipOn : chipOff}`}>
                {getExerciseTypeIcon(type as SimpleExerciseType)} {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Muscle Groups * (select all that apply)</span>
          <div className="flex flex-wrap gap-1.5">
            {(allMuscles as string[]).map((mg) => (
              <button key={mg} type="button" onClick={() => toggle(muscleGroups, mg as MuscleGroup, setMuscleGroups)} className={`${chipBase} ${muscleGroups.includes(mg as MuscleGroup) ? chipOn : chipOff}`}>
                {mg}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Equipment (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_EQUIPMENT.map((eq) => (
              <button key={eq} type="button" onClick={() => toggle(equipment, eq, setEquipment)} className={`${chipBase} ${equipment.includes(eq) ? chipOn : chipOff}`}>
                {eq}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Difficulty (optional)</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDifficulty("")} className={`${chipBase} ${difficulty === "" ? chipOn : chipOff}`}>None</button>
            {ALL_DIFFICULTIES.map((d) => (
              <button key={d} type="button" onClick={() => setDifficulty(d)} className={`${chipBase} ${difficulty === d ? chipOn : chipOff}`}>{d}</button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Description (optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." className={`${inputCls} resize-none h-20`} maxLength={2000} />
        </label>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Instructions (optional)</span>
          <div className="space-y-1.5">
            {instructions.map((step, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <span className="text-[10px] text-mist-dark w-5 text-right shrink-0">{i + 1}.</span>
                <input type="text" value={step} onChange={(e) => setInstructions((prev) => prev.map((s, idx) => idx === i ? e.target.value : s))} placeholder={`Step ${i + 1}`} className={`${inputCls} !py-1.5`} />
                {instructions.length > 1 && (
                  <button type="button" onClick={() => setInstructions((prev) => prev.filter((_, idx) => idx !== i))} className="text-crimson-light/60 hover:text-crimson-light text-sm shrink-0">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setInstructions((prev) => [...prev, ""])} className="text-[11px] text-jade-light/70 hover:text-jade-light transition-colors">+ Add step</button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-ink-light/30">
        <button onClick={onClose} className="px-4 py-2 text-sm text-mist-light hover:text-cloud-white transition-colors">Cancel</button>
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-mist-light hover:text-cloud-white">Cancel</button>
          <button onClick={handle} disabled={deleting} className="px-4 py-2 text-sm font-semibold rounded-lg bg-crimson-deep/40 text-crimson-light border border-crimson/40 hover:bg-crimson-deep/60 disabled:opacity-50">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </GlowModal>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ exercises }: { exercises: SimpleExercise[] }) {
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

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="rounded-xl border border-ink-light/30 p-4" style={{ background: "var(--surface-gradient-strong)" }}>
      <div className="text-2xl font-bold text-cloud-white">{value}</div>
      <div className="text-xs font-semibold text-jade-light mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-mist-dark mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Exercises" value={exercises.length} />
        <StatCard label="Custom" value={customCount} sub="user-created" />
        <StatCard label="Categories" value={byCat.length} />
        <StatCard label="Muscle Groups" value={byMuscle.length} sub="covered" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-ink-light/30 p-4 space-y-2" style={{ background: "var(--surface-gradient-strong)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-dark">By Category</h3>
          {byCat.length === 0 ? <p className="text-sm text-mist-dark">No data</p> : byCat.map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-[11px] w-4">{getCategoryIcon(cat as TrainingCategory)}</span>
              <div className="flex-1 bg-ink-mid/30 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-jade-glow/60 rounded-full" style={{ width: `${Math.round((count / exercises.length) * 100)}%` }} />
              </div>
              <span className="text-[11px] text-mist-light w-24 truncate">{cat}</span>
              <span className="text-[11px] text-mist-dark font-mono">{count}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-ink-light/30 p-4 space-y-2" style={{ background: "var(--surface-gradient-strong)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-dark">Top Muscle Groups</h3>
          {byMuscle.length === 0 ? <p className="text-sm text-mist-dark">No data</p> : byMuscle.map(([mg, count]) => (
            <div key={mg} className="flex items-center gap-2">
              <div className="flex-1 bg-ink-mid/30 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-jade-glow/40 rounded-full" style={{ width: `${Math.round((count / exercises.length) * 100)}%` }} />
              </div>
              <span className="text-[11px] text-mist-light w-28 truncate">{mg}</span>
              <span className="text-[11px] text-mist-dark font-mono">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-ink-light/30 p-4" style={{ background: "var(--surface-gradient-strong)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-dark mb-3">By Type</h3>
        <div className="flex flex-wrap gap-3">
          {byType.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 rounded-lg border border-ink-light/30 bg-ink-mid/20 px-3 py-2">
              <span className="text-base">{getExerciseTypeIcon(type as SimpleExerciseType)}</span>
              <div>
                <div className="text-sm font-bold text-cloud-white">{count}</div>
                <div className="text-[10px] text-mist-dark capitalize">{type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Variants Tab ─────────────────────────────────────────────────────────────

const VARIANT_FIELDS: { key: string; label: string; description: string }[] = [
  { key: "category", label: "Categories", description: "Custom exercise categories (e.g., Martial Arts, Swimming)" },
  { key: "exerciseType", label: "Exercise Types", description: "Custom movement types (e.g., isometric, plyometric)" },
  { key: "muscleGroup", label: "Muscle Groups", description: "Custom muscle group names (e.g., Hip Flexors, Rotator Cuff)" },
];

function VariantsTab({ variants, onUpdate }: { variants: Record<string, string[]>; onUpdate: (v: Record<string, string[]>) => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const add = (field: string) => {
    const val = (inputs[field] ?? "").trim();
    if (!val) return;
    const current = variants[field] ?? [];
    if (current.map((s) => s.toLowerCase()).includes(val.toLowerCase())) return;
    const updated = { ...variants, [field]: [...current, val] };
    onUpdate(updated);
    setInputs((prev) => ({ ...prev, [field]: "" }));
  };

  const remove = (field: string, val: string) => {
    const updated = { ...variants, [field]: (variants[field] ?? []).filter((v) => v !== val) };
    onUpdate(updated);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-mist-light">Add custom values to the dropdowns used when creating or editing exercises. These are stored locally in your browser.</p>
      {VARIANT_FIELDS.map(({ key, label, description }) => (
        <div key={key} className="rounded-xl border border-ink-light/30 p-4 space-y-3" style={{ background: "var(--surface-gradient-strong)" }}>
          <div>
            <h3 className="text-sm font-semibold text-cloud-white">{label}</h3>
            <p className="text-[11px] text-mist-dark">{description}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(variants[key] ?? []).map((val) => (
              <span key={val} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-jade-deep/30 border border-jade-glow/30 text-jade-light">
                {val}
                <button onClick={() => remove(key, val)} className="text-jade-light/50 hover:text-crimson-light transition-colors ml-0.5">✕</button>
              </span>
            ))}
            {(variants[key] ?? []).length === 0 && <span className="text-[11px] text-mist-dark italic">No custom values yet</span>}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={inputs[key] ?? ""}
              onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(key); } }}
              placeholder={`Add custom ${label.toLowerCase().replace(/s$/, "")}…`}
              className="flex-1 bg-ink-dark border border-ink-light/40 rounded-lg px-3 py-2 text-sm text-cloud-white placeholder:text-mist-dark/50 outline-none focus:border-jade-glow/60"
            />
            <GlowButton onClick={() => add(key)} variant="jade" size="sm">Add</GlowButton>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Exercises Tab ────────────────────────────────────────────────────────────

function ExercisesTab({
  exercises,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  exercises: SimpleExercise[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (ex: SimpleExercise) => void;
  onDelete: (ex: SimpleExercise) => void;
  onDuplicate: (ex: SimpleExercise) => void;
}) {
  const { isMobile } = useAppContext();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<TrainingCategory | "">("");
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "">("");
  const [typeFilter, setTypeFilter] = useState<SimpleExerciseType | "">("");
  const [customOnly, setCustomOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter && ex.category !== catFilter) return false;
      if (muscleFilter && !ex.muscleGroups.includes(muscleFilter)) return false;
      if (typeFilter && ex.exerciseType !== typeFilter) return false;
      if (customOnly && !ex.isCustom) return false;
      return true;
    });
  }, [exercises, search, catFilter, muscleFilter, typeFilter, customOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, catFilter, muscleFilter, typeFilter, customOnly]);

  const chipBase = "text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-all duration-150 select-none";
  const chipOn = "bg-jade-deep/40 border-jade-glow/50 text-jade-light";
  const chipOff = "bg-ink-dark/60 border-ink-light/40 text-mist-light hover:border-jade/30";

  const activeFilterCount = [catFilter, muscleFilter, typeFilter, customOnly ? "1" : ""].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search + Add row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder=""
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-ink-dark/80 border border-ink-light/40 rounded-lg pl-10 pr-8 py-2 text-sm text-cloud-white placeholder:text-mist-dark/60 outline-none focus:border-jade-glow/60"
          />
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M16.5 16.5l4 4" />
          </svg>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold leading-none text-mist-dark transition-colors hover:text-cloud-white"
              aria-label="Clear search"
            >
              x
            </button>
          ) : null}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`px-3 py-2 text-xs rounded-lg border transition-colors relative ${showFilters ? "bg-ink-mid/30 border-jade-glow/40 text-jade-light" : "border-ink-light/40 text-mist-light hover:border-jade-glow/30"}`}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-jade-glow text-ink-deep text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <GlowButton onClick={onAdd} variant="jade" size="sm" glow>+ Add Exercise</GlowButton>
        </div>
      </div>

      {/* Collapsible filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-ink-light/30 p-3 space-y-2" style={{ background: "var(--surface-gradient-strong)" }}>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as TrainingCategory | "")} className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50">
                  <option value="">All Categories</option>
                  {ALL_TRAINING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value as MuscleGroup | "")} className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50">
                  <option value="">All Muscles</option>
                  {ALL_MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as SimpleExerciseType | "")} className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50">
                  <option value="">All Types</option>
                  {ALL_EXERCISE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <button onClick={() => setCustomOnly((v) => !v)} className={`${chipBase} ${customOnly ? chipOn : chipOff}`}>🔧 Custom Only</button>
                {activeFilterCount > 0 && (
                  <button onClick={() => { setCatFilter(""); setMuscleFilter(""); setTypeFilter(""); setCustomOnly(false); }} className="text-[10px] text-crimson-light/70 hover:text-crimson-light transition-colors">Clear all</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-mist-mid text-sm animate-pulse">Loading exercises…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="text-4xl opacity-40">📚</div>
          <p className="text-sm text-mist-dark">{exercises.length === 0 ? "No exercises yet" : "No matching exercises"}</p>
          {exercises.length === 0 && <GlowButton onClick={onAdd} variant="jade" size="sm" glow>+ Add Your First Exercise</GlowButton>}
        </div>
      ) : (
        <>
          <div
            className="rounded-xl border border-ink-light/30 overflow-hidden"
            style={{ background: "var(--surface-gradient-strong)" }}
          >
            {/* Table header */}
            <div className="hidden sm:grid border-b border-ink-light/20 px-3 py-2 bg-ink-mid/20 text-[10px] font-semibold uppercase tracking-wider text-mist-dark"
              style={{ gridTemplateColumns: "36px 1fr 110px 90px 1fr 40px" }}>
              <span>#</span>
              <span>Exercise</span>
              <span>Category</span>
              <span>Type</span>
              <span>Muscles</span>
              <span />
            </div>

            <div className="divide-y divide-ink-light/15">
              <AnimatePresence mode="popLayout">
                {paginated.map((ex, idx) => {
                  const rowNum = (page - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                    <motion.div
                      key={ex.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className={`group px-3 py-2.5 hover:bg-ink-mid/20 transition-colors
                        grid grid-cols-1 gap-1
                        sm:grid sm:gap-2 sm:items-center`}
                      style={isMobile ? undefined : { gridTemplateColumns: "36px 1fr 110px 90px 1fr 40px" }}
                    >
                      {/* Row number — desktop only */}
                      <span className="hidden sm:block text-[11px] text-mist-dark font-mono">{rowNum}</span>

                      {/* Name + badges */}
                      <div className="flex items-center gap-2 min-w-0">
                        <ExerciseImageBox className="h-9 w-9" compact />
                        <span className="text-sm text-cloud-white font-medium truncate">{ex.name}</span>
                        {ex.isCustom && <span className="text-[9px] text-gold/70 shrink-0" title="Custom">🔧</span>}
                        <DifficultyBadge difficulty={ex.difficulty} />
                      </div>

                      {/* Category */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px]">{getCategoryIcon(ex.category)}</span>
                        <span className="text-[11px] text-mist-light">{ex.category}</span>
                      </div>

                      {/* Type */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px]">{getExerciseTypeIcon(ex.exerciseType)}</span>
                        <span className="text-[11px] text-mist-light capitalize">{ex.exerciseType}</span>
                      </div>

                      {/* Muscles */}
                      <div className="flex flex-wrap gap-1">
                        {ex.muscleGroups.slice(0, 3).map((mg) => (
                          <span key={mg} className="text-[9px] px-1.5 py-0.5 rounded bg-ink-mid/40 text-mist-light border border-ink-light/20">{mg}</span>
                        ))}
                        {ex.muscleGroups.length > 3 && <span className="text-[9px] text-mist-dark">+{ex.muscleGroups.length - 3}</span>}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end sm:justify-center">
                        <ActionsDropdown exercise={ex} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-mist-dark">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[11px] rounded border border-ink-light/30 text-mist-light disabled:opacity-30 hover:bg-ink-mid/30 transition-colors">Prev</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((n) => (
                  <button key={n} onClick={() => setPage(n)} className={`px-2 py-1 text-[11px] rounded border transition-colors ${page === n ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light" : "border-ink-light/30 text-mist-light hover:bg-ink-mid/30"}`}>{n}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-[11px] rounded border border-ink-light/30 text-mist-light disabled:opacity-30 hover:bg-ink-mid/30 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExerciseDBPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [tab, setTab] = useState<Tab>("overview");
  const [exercises, setExercises] = useState<SimpleExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<Record<string, string[]>>({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingExercise, setEditingExercise] = useState<SimpleExercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SimpleExercise | null>(null);

  // Load variants from localStorage on mount
  useEffect(() => { setVariants(loadVariants()); }, []);

  const handleVariantsUpdate = useCallback((v: Record<string, string[]>) => {
    setVariants(v);
    saveVariants(v);
  }, []);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.get<{ exercises: SimpleExercise[] }>("/api/exercise-library");
      if (data.exercises) setExercises(data.exercises);
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  const handleAdd = () => { setEditingExercise(null); setModalMode("add"); setModalOpen(true); };
  const handleEdit = (ex: SimpleExercise) => { setEditingExercise(ex); setModalMode("edit"); setModalOpen(true); };

  const handleSave = async (data: ExerciseFormData) => {
    if (!userId) throw new Error("Not logged in");
    if (modalMode === "add") {
      await api.post("/api/exercise-library", { ...data });
    } else if (editingExercise) {
      await api.patch(`/api/exercise-library/${editingExercise.id}`, { ...data });
    }
    await fetchExercises();
    window.dispatchEvent(new Event("progression-exercises-updated"));
  };

  const handleDelete = async () => {
    if (!userId || !deleteTarget) return;
    await api.delete(`/api/exercise-library/${deleteTarget.id}`);
    await fetchExercises();
    window.dispatchEvent(new Event("progression-exercises-updated"));
  };

  const handleDuplicate = async (ex: SimpleExercise) => {
    if (!userId) return;
    try {
      await api.post("/api/exercise-library", {
        name: `${ex.name} (Copy)`, category: ex.category, exerciseType: ex.exerciseType,
        muscleGroups: ex.muscleGroups, equipment: ex.equipment || [],
        difficulty: ex.difficulty || "", description: ex.description || "",
        instructions: ex.instructions || [],
      });
      await fetchExercises();
      window.dispatchEvent(new Event("progression-exercises-updated"));
    } catch (err) { console.error("Duplicate failed:", err); }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "exercises", label: "Exercises" },
    { id: "variants", label: "Variants" },
  ];

  return (
    <PageLayout title="Exercise DB" subtitle="Manage your exercise database">
      <div className="px-1 py-3 sm:px-0 sm:py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-cloud-white uppercase tracking-wider">Exercise Database</h2>
        </div>

        {/* Tab bar — MapleRanks-style horizontal pill tabs */}
        <div className="flex gap-1 rounded-xl border border-ink-light/30 p-1" style={{ background: "var(--surface-gradient-strong)" }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`relative flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                tab === id
                  ? "bg-jade-deep/50 text-jade-light shadow-[0_0_12px_var(--glow-jade)]"
                  : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
              }`}
            >
              {label}
              {id === "exercises" && exercises.length > 0 && (
                <span className="absolute top-1 right-2 text-[9px] text-mist-dark">{exercises.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "overview" && <OverviewTab exercises={exercises} />}
            {tab === "exercises" && (
              <ExercisesTab
                exercises={exercises}
                loading={loading}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
                onDuplicate={handleDuplicate}
              />
            )}
            {tab === "variants" && <VariantsTab variants={variants} onUpdate={handleVariantsUpdate} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <ExerciseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        exercise={editingExercise}
        mode={modalMode}
        customVariants={variants}
      />

      <DeleteModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget?.name ?? ""}
      />
    </PageLayout>
  );
}
