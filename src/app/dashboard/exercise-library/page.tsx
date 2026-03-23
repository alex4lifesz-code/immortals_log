"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { GlowModal } from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
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

// ── Exercise Modal ──

interface ExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ExerciseFormData) => Promise<void>;
  exercise?: SimpleExercise | null;
  mode: "add" | "edit";
}

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

function ExerciseModal({ isOpen, onClose, onSave, exercise, mode }: ExerciseModalProps) {
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

  useEffect(() => {
    if (isOpen && exercise && mode === "edit") {
      setName(exercise.name);
      setCategory(exercise.category);
      setExerciseType(exercise.exerciseType);
      setMuscleGroups(exercise.muscleGroups);
      setEquipment(exercise.equipment || []);
      setDifficulty(exercise.difficulty || "");
      setDescription(exercise.description || "");
      setInstructions(exercise.instructions?.length ? exercise.instructions : [""]);
    } else if (isOpen && mode === "add") {
      setName("");
      setCategory("GYM");
      setExerciseType("weighted");
      setMuscleGroups([]);
      setEquipment([]);
      setDifficulty("");
      setDescription("");
      setInstructions([""]);
    }
    setError("");
  }, [isOpen, exercise, mode]);

  const toggleMuscleGroup = (mg: MuscleGroup) => {
    setMuscleGroups(prev =>
      prev.includes(mg) ? prev.filter(m => m !== mg) : [...prev, mg]
    );
  };

  const toggleEquipment = (eq: string) => {
    setEquipment(prev =>
      prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
    );
  };

  const updateInstruction = (index: number, value: string) => {
    setInstructions(prev => prev.map((s, i) => i === index ? value : s));
  };

  const addInstruction = () => {
    setInstructions(prev => [...prev, ""]);
  };

  const removeInstruction = (index: number) => {
    setInstructions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError("");

    if (name.trim().length < 2) {
      setError("Exercise name must be at least 2 characters");
      return;
    }
    if (muscleGroups.length === 0) {
      setError("Select at least one muscle group");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        category,
        exerciseType,
        muscleGroups,
        equipment,
        difficulty,
        description: description.trim(),
        instructions: instructions.filter(s => s.trim()),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save exercise");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-ink-dark border border-ink-light/40 rounded-lg px-3 py-2 text-sm text-cloud-white placeholder:text-mist-dark/50 outline-none transition-colors focus:border-jade-glow/60 focus:bg-ink-dark/90";
  const chipBase = "text-[11px] px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all duration-150 select-none";
  const chipActive = "bg-jade-deep/40 border-jade-glow/50 text-jade-light";
  const chipInactive = "bg-ink-dark/60 border-ink-light/40 text-mist-light hover:border-jade/30 hover:text-cloud-white";

  return (
    <GlowModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Add New Exercise" : "Edit Exercise"}
      panelClassName="!max-w-2xl"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-lg border border-crimson/40 bg-crimson-deep/20 px-3 py-2 text-xs text-crimson-light">
            {error}
          </div>
        )}

        {/* Name */}
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Exercise Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Incline Dumbbell Press"
            className={inputClass}
            maxLength={200}
          />
        </label>

        {/* Category */}
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Category *</span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TRAINING_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`${chipBase} ${category === cat ? chipActive : chipInactive}`}
              >
                {getCategoryIcon(cat)} {cat}
              </button>
            ))}
          </div>
        </label>

        {/* Exercise Type */}
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Exercise Type *</span>
          <div className="flex gap-2">
            {ALL_EXERCISE_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setExerciseType(type)}
                className={`flex-1 ${chipBase} text-center ${exerciseType === type ? chipActive : chipInactive}`}
              >
                {getExerciseTypeIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </label>

        {/* Muscle Groups */}
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Muscle Groups * (select all that apply)</span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_MUSCLE_GROUPS.map(mg => (
              <button
                key={mg}
                type="button"
                onClick={() => toggleMuscleGroup(mg)}
                className={`${chipBase} ${muscleGroups.includes(mg) ? chipActive : chipInactive}`}
              >
                {mg}
              </button>
            ))}
          </div>
        </label>

        {/* Equipment */}
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Equipment (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_EQUIPMENT.map(eq => (
              <button
                key={eq}
                type="button"
                onClick={() => toggleEquipment(eq)}
                className={`${chipBase} ${equipment.includes(eq) ? chipActive : chipInactive}`}
              >
                {eq}
              </button>
            ))}
          </div>
        </label>

        {/* Difficulty */}
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Difficulty (optional)</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDifficulty("")}
              className={`${chipBase} ${difficulty === "" ? chipActive : chipInactive}`}
            >
              None
            </button>
            {ALL_DIFFICULTIES.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`flex-1 ${chipBase} text-center ${difficulty === d ? chipActive : chipInactive}`}
              >
                {d}
              </button>
            ))}
          </div>
        </label>

        {/* Description */}
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the exercise..."
            className={`${inputClass} resize-none h-20`}
            maxLength={2000}
          />
        </label>

        {/* Instructions */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-dark">Instructions (optional)</span>
          <div className="space-y-1.5">
            {instructions.map((step, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <span className="text-[10px] text-mist-dark w-5 text-right shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => updateInstruction(i, e.target.value)}
                  placeholder={`Step ${i + 1}`}
                  className={`${inputClass} !py-1.5`}
                />
                {instructions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeInstruction(i)}
                    className="text-crimson-light/60 hover:text-crimson-light text-sm shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addInstruction}
              className="text-[11px] text-jade-light/70 hover:text-jade-light transition-colors"
            >
              + Add step
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-ink-light/30">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-mist-light hover:text-cloud-white transition-colors"
        >
          Cancel
        </button>
        <GlowButton
          onClick={handleSubmit}
          variant="jade"
          size="sm"
          glow
          disabled={saving}
          className="!px-6"
        >
          {saving ? "Saving..." : mode === "add" ? "Add Exercise" : "Save Changes"}
        </GlowButton>
      </div>
    </GlowModal>
  );
}

// ── Confirm Delete Modal ──

function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  exerciseName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  exerciseName: string;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Delete Exercise" panelClassName="!max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-mist-light">
          Are you sure you want to delete <strong className="text-crimson-light">{exerciseName}</strong>?
          This will also delete all associated training logs.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-mist-light hover:text-cloud-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-crimson-deep/40 text-crimson-light border border-crimson/40 hover:bg-crimson-deep/60 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </GlowModal>
  );
}

// ── Actions Dropdown ──

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
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-mist-dark hover:text-mist-light transition-colors px-1.5 py-0.5 rounded hover:bg-ink-mid/40"
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-36 rounded-lg border border-ink-light/40 bg-ink-dark shadow-xl">
            <button
              onClick={() => { setOpen(false); onEdit(exercise); }}
              className="w-full text-left px-3 py-2 text-xs text-mist-light hover:bg-ink-mid/40 hover:text-cloud-white transition-colors rounded-t-lg"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => { setOpen(false); onDuplicate(exercise); }}
              className="w-full text-left px-3 py-2 text-xs text-mist-light hover:bg-ink-mid/40 hover:text-cloud-white transition-colors"
            >
              📋 Duplicate
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(exercise); }}
              className="w-full text-left px-3 py-2 text-xs text-crimson-light hover:bg-crimson-deep/20 transition-colors rounded-b-lg"
            >
              🗑️ Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Difficulty Badge ──

function DifficultyBadge({ difficulty }: { difficulty?: Difficulty }) {
  if (!difficulty) return null;
  const colors: Record<Difficulty, string> = {
    Beginner: "text-green-400 border-green-500/30 bg-green-500/10",
    Intermediate: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    Advanced: "text-red-400 border-red-500/30 bg-red-500/10",
  };
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${colors[difficulty]}`}>
      {difficulty}
    </span>
  );
}

// ── Main Page ──

const ITEMS_PER_PAGE = 20;

export default function ExerciseLibraryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const userId = user?.id;

  const [exercises, setExercises] = useState<SimpleExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TrainingCategory | "">("");
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "">("");
  const [typeFilter, setTypeFilter] = useState<SimpleExerciseType | "">("");
  const [showCustomOnly, setShowCustomOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingExercise, setEditingExercise] = useState<SimpleExercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SimpleExercise | null>(null);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/exercise-library?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.exercises) setExercises(data.exercises);
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // Filtered exercises
  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!ex.name.toLowerCase().includes(q)) return false;
      }
      if (categoryFilter && ex.category !== categoryFilter) return false;
      if (muscleFilter && !ex.muscleGroups.includes(muscleFilter)) return false;
      if (typeFilter && ex.exerciseType !== typeFilter) return false;
      if (showCustomOnly && !ex.isCustom) return false;
      return true;
    });
  }, [exercises, searchQuery, categoryFilter, muscleFilter, typeFilter, showCustomOnly]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredExercises.length / ITEMS_PER_PAGE));
  const paginatedExercises = filteredExercises.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, muscleFilter, typeFilter, showCustomOnly]);

  // CRUD handlers
  const handleAdd = () => {
    setEditingExercise(null);
    setModalMode("add");
    setModalOpen(true);
  };

  const handleEdit = (ex: SimpleExercise) => {
    setEditingExercise(ex);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleSaveExercise = async (data: ExerciseFormData) => {
    if (!userId) throw new Error("Not logged in");

    if (modalMode === "add") {
      const res = await fetch("/api/exercise-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create exercise");
      }
    } else if (editingExercise) {
      const res = await fetch(`/api/exercise-library/${editingExercise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update exercise");
      }
    }

    await fetchExercises();
    // Notify other components
    window.dispatchEvent(new Event("progression-exercises-updated"));
  };

  const handleDelete = async () => {
    if (!userId || !deleteTarget) return;
    const res = await fetch(`/api/exercise-library/${deleteTarget.id}?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete exercise");
    }
    await fetchExercises();
    window.dispatchEvent(new Event("progression-exercises-updated"));
  };

  const handleDuplicate = async (ex: SimpleExercise) => {
    if (!userId) return;
    try {
      const res = await fetch("/api/exercise-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: `${ex.name} (Copy)`,
          category: ex.category,
          exerciseType: ex.exerciseType,
          muscleGroups: ex.muscleGroups,
          equipment: ex.equipment || [],
          difficulty: ex.difficulty || "",
          description: ex.description || "",
          instructions: ex.instructions || [],
        }),
      });
      if (res.ok) {
        await fetchExercises();
        window.dispatchEvent(new Event("progression-exercises-updated"));
      }
    } catch (err) {
      console.error("Failed to duplicate:", err);
    }
  };

  const chipBase = "text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-all duration-150 select-none";
  const chipActive = "bg-jade-deep/40 border-jade-glow/50 text-jade-light";
  const chipInactive = "bg-ink-dark/60 border-ink-light/40 text-mist-light hover:border-jade/30";

  return (
    <PageLayout title="Exercise Library" subtitle="Manage your exercise database">
      <div className="px-1 py-3 sm:px-0 sm:py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-cloud-white uppercase tracking-wider">Exercise Library</h2>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <GlowButton onClick={() => router.push("/dashboard/admin/weight-standards")} variant="gold" size="sm">
                ⚖️ Weight Standards
              </GlowButton>
            )}
            <GlowButton onClick={handleAdd} variant="jade" size="sm" glow>
              + Add Exercise
            </GlowButton>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist-dark pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ink-dark/80 border border-ink-light/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-cloud-white placeholder:text-mist-dark/60 outline-none transition-all duration-200 focus:border-jade-glow/60"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as TrainingCategory | "")}
              className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50"
            >
              <option value="">All Categories</option>
              {ALL_TRAINING_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={muscleFilter}
              onChange={(e) => setMuscleFilter(e.target.value as MuscleGroup | "")}
              className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50"
            >
              <option value="">All Muscles</option>
              {ALL_MUSCLE_GROUPS.map(mg => (
                <option key={mg} value={mg}>{mg}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as SimpleExerciseType | "")}
              className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50"
            >
              <option value="">All Types</option>
              {ALL_EXERCISE_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>

            <button
              onClick={() => setShowCustomOnly(!showCustomOnly)}
              className={`${chipBase} ${showCustomOnly ? chipActive : chipInactive}`}
            >
              🔧 Custom Only
            </button>
          </div>
        </div>

        {/* Exercise Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-mist-mid text-sm animate-pulse">Loading exercises…</p>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="text-4xl opacity-40">📚</div>
            <p className="text-sm text-mist-dark">{exercises.length === 0 ? "No exercises yet" : "No matching exercises"}</p>
            {exercises.length === 0 && (
              <GlowButton onClick={handleAdd} variant="jade" size="sm" glow>
                + Add Your First Exercise
              </GlowButton>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-ink-light/30 overflow-hidden">
              {/* Table Header */}
              <div className="hidden sm:grid sm:grid-cols-[40px_1fr_100px_90px_1fr_40px] gap-2 px-3 py-2 bg-ink-mid/30 border-b border-ink-light/20 text-[10px] font-semibold uppercase tracking-wider text-mist-dark">
                <span>#</span>
                <span>Exercise</span>
                <span>Category</span>
                <span>Type</span>
                <span>Muscles</span>
                <span></span>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-ink-light/15">
                <AnimatePresence mode="popLayout">
                  {paginatedExercises.map((ex, index) => {
                    const rowNum = (page - 1) * ITEMS_PER_PAGE + index + 1;

                    return (
                      <motion.div
                        key={ex.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group grid grid-cols-1 sm:grid-cols-[40px_1fr_100px_90px_1fr_40px] gap-1 sm:gap-2 px-3 py-2.5 hover:bg-ink-mid/20 transition-colors items-center"
                      >
                        {/* Row number */}
                        <span className="hidden sm:block text-[11px] text-mist-dark font-mono">{rowNum}</span>

                        {/* Exercise name */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-cloud-white font-medium truncate">{ex.name}</span>
                          {ex.isCustom && <span className="text-[9px] text-gold/70" title="Custom exercise">🔧</span>}
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
                          {ex.muscleGroups.slice(0, 3).map(mg => (
                            <span key={mg} className="text-[9px] px-1.5 py-0.5 rounded bg-ink-mid/40 text-mist-light border border-ink-light/20">
                              {mg}
                            </span>
                          ))}
                          {ex.muscleGroups.length > 3 && (
                            <span className="text-[9px] text-mist-dark">+{ex.muscleGroups.length - 3}</span>
                          )}
                        </div>

                        {/* Actions */}
                        <ActionsDropdown
                          exercise={ex}
                          onEdit={handleEdit}
                          onDelete={setDeleteTarget}
                          onDuplicate={handleDuplicate}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-mist-dark">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredExercises.length)} of {filteredExercises.length} exercises
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-[11px] rounded border border-ink-light/30 text-mist-light disabled:opacity-30 hover:bg-ink-mid/30 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                      page === n
                        ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light"
                        : "border-ink-light/30 text-mist-light hover:bg-ink-mid/30"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-[11px] rounded border border-ink-light/30 text-mist-light disabled:opacity-30 hover:bg-ink-mid/30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Exercise Modal */}
      <ExerciseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveExercise}
        exercise={editingExercise}
        mode={modalMode}
      />

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        exerciseName={deleteTarget?.name || ""}
      />
    </PageLayout>
  );
}
