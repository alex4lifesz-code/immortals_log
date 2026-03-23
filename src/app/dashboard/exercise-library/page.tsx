"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
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
  getExerciseTypeIcon,
  getCategoryIcon,
} from "@/lib/exercise-types";
import {
  ExerciseModal,
  ConfirmDeleteModal,
  ActionsDropdown,
  DifficultyBadge,
  type ExerciseFormData,
} from "./components";

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
      const data = await api.get<{ exercises: SimpleExercise[] }>("/api/exercise-library");
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
      await api.post("/api/exercise-library", { ...data });
    } else if (editingExercise) {
      await api.patch(`/api/exercise-library/${editingExercise.id}`, { ...data });
    }

    await fetchExercises();
    // Notify other components
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
        name: `${ex.name} (Copy)`,
        category: ex.category,
        exerciseType: ex.exerciseType,
        muscleGroups: ex.muscleGroups,
        equipment: ex.equipment || [],
        difficulty: ex.difficulty || "",
        description: ex.description || "",
        instructions: ex.instructions || [],
      });
      await fetchExercises();
      window.dispatchEvent(new Event("progression-exercises-updated"));
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
