"use client";

import { useState, useEffect } from "react";
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

// ── Types ──

export interface ExerciseFormData {
  name: string;
  category: TrainingCategory;
  exerciseType: SimpleExerciseType;
  muscleGroups: MuscleGroup[];
  equipment: string[];
  difficulty: Difficulty | "";
  description: string;
  instructions: string[];
}

// ── Exercise Modal ──

export function ExerciseModal({ isOpen, onClose, onSave, exercise, mode }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ExerciseFormData) => Promise<void>;
  exercise?: SimpleExercise | null;
  mode: "add" | "edit";
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

export function ConfirmDeleteModal({
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

export function ActionsDropdown({
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

export function DifficultyBadge({ difficulty }: { difficulty?: Difficulty }) {
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
