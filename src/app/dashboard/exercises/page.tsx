"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowInput from "@/components/ui/GlowInput";
import { GlowSelect } from "@/components/ui/GlowInput";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { getExerciseDisplayName, getExerciseSearchText } from "@/lib/exercise-name";
import {
  DIFFICULTY_LEVELS,
  TARGET_GROUPS,
  getDifficultyColor,
  getDifficultyGlow,
  getTypeColor,
  getTargetGroupColor,
} from "@/lib/constants";

const FAVOURITES_KEY = "cultivateos-favourite-techniques";

interface Exercise {
  id: string;
  name: string;
  wuxiaName?: string;
  difficulty: string;
  type: string;
  story?: string;
  targetGroup?: string;
}

function ExercisesSidebar({
  onAdd,
  onSearch,
  searchTerm,
  filterDifficulty,
  setFilterDifficulty,
  filterType,
  setFilterType,
  availableTypes,
  total,
  exercises: _exercises,
  favouriteIds,
  onToggleFavourite: _onToggleFavourite,
  filterFavourites,
  setFilterFavourites,
  onDismissSidebar,
  onUploadProgression,
  onRemoveAllProgressions,
  progressionCount,
}: {
  onAdd: () => void;
  onSearch: (term: string) => void;
  searchTerm: string;
  filterDifficulty: string;
  setFilterDifficulty: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  availableTypes: string[];
  total: number;
  exercises: Exercise[];
  favouriteIds: Set<string>;
  onToggleFavourite: (id: string) => void;
  filterFavourites: boolean;
  setFilterFavourites: (v: boolean) => void;
  onDismissSidebar: () => void;
  onUploadProgression: () => void;
  onRemoveAllProgressions: () => void;
  progressionCount: number;
}) {
  const [showFilters, setShowFilters] = useState(true);
  const [sortMode, setSortMode] = useState<string>(() => {
    if (typeof window === "undefined") return "a-z";
    try { return localStorage.getItem("cultivateos-exercises-sidebar-sort") || "a-z"; } catch { return "a-z"; }
  });

  useEffect(() => {
    try { localStorage.setItem("cultivateos-exercises-sidebar-sort", sortMode); } catch {}
  }, [sortMode]);

  const activeFiltersCount = (filterDifficulty ? 1 : 0) + (filterType ? 1 : 0) + (filterFavourites ? 1 : 0);

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 space-y-2">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mist-dark pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search techniques..."
            value={searchTerm}
            onChange={(e) => {
              onSearch(e.target.value);
            }}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") onDismissSidebar();
            }}
            className="w-full bg-ink-dark/80 border border-ink-light/50 rounded-lg pl-8 pr-8 py-1.5 text-[11px] text-cloud-white placeholder:text-mist-dark/70 outline-none transition-all duration-200 focus:border-jade-glow/60 focus:bg-ink-dark"
          />
          {searchTerm && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-dark hover:text-cloud-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1">
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-jade/30 text-jade-light bg-jade-deep/15 hover:bg-jade-deep/30 hover:border-jade/50 transition-all duration-150"
            title="Add new technique"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add
          </button>
          <button
            onClick={onUploadProgression}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-jade/30 text-jade-light bg-jade-deep/15 hover:bg-jade-deep/30 hover:border-jade/50 transition-all duration-150"
            title="Upload progression JSON file"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
            Upload
          </button>
          {progressionCount > 0 && (
            <button
              onClick={onRemoveAllProgressions}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-crimson/20 text-crimson-light/70 hover:bg-crimson-deep/15 hover:border-crimson/40 hover:text-crimson-light transition-all duration-150"
              title="Remove all progressions"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={() => setFilterFavourites(!filterFavourites)}
            className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] border transition-all duration-150 ${
              filterFavourites
                ? 'bg-gold-dim/20 border-gold-dim/50 text-gold'
                : 'border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60'
            }`}
            title={filterFavourites ? "Show all" : `Favourites${favouriteIds.size > 0 ? ` (${favouriteIds.size})` : ""}`}
          >
            {filterFavourites ? "★" : "☆"}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all duration-150 ${
              showFilters
                ? 'bg-jade-deep/25 border-jade/40 text-jade-glow'
                : 'border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60'
            }`}
            title={showFilters ? "Hide filters" : "Show filters"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          </button>
        </div>
      </div>

      {/* ── Collapsible Filters + Sort ── */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-3 pb-2 space-y-2">
              {/* Realm / Difficulty */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium">Realm</span>
                  {filterDifficulty && (
                    <button onClick={() => setFilterDifficulty("")} className="text-[9px] text-jade-glow/70 hover:text-jade-glow transition-colors">clear</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFilterDifficulty("")}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
                      !filterDifficulty
                        ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                        : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                    }`}
                  >
                    All
                  </button>
                  {DIFFICULTY_LEVELS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDifficulty(filterDifficulty === d ? "" : d)}
                      className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
                        filterDifficulty === d
                          ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                          : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                      }`}
                    >
                      {d.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium">Type</span>
                  {filterType && (
                    <button onClick={() => setFilterType("")} className="text-[9px] text-jade-glow/70 hover:text-jade-glow transition-colors">clear</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFilterType("")}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
                      !filterType
                        ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                        : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                    }`}
                  >
                    All
                  </button>
                  {availableTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(filterType === t ? "" : t)}
                      className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
                        filterType === t
                          ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                          : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium block mb-1">Sort By</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="w-full bg-ink-dark/80 border border-ink-light/40 rounded-md px-2 py-1 text-[11px] text-cloud-white outline-none transition-all duration-150 focus:border-jade-glow/50 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 6px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', paddingRight: '28px' }}
                >
                  <option value="a-z">A–Z</option>
                  <option value="z-a">Z–A</option>
                  <option value="recent">Recent</option>
                  <option value="difficulty">Difficulty</option>
                  <option value="favourites">Favourites First</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Divider with stats ── */}
      <div className="px-3 py-1.5 border-y border-ink-light/20 bg-ink-dark/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-mist-light/90 font-medium">
              {total} technique{total !== 1 ? "s" : ""}
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[9px] text-jade-glow/80 bg-jade-deep/20 px-1.5 py-0 rounded-full border border-jade/20">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {favouriteIds.size > 0 && (
            <span className="text-[10px] text-gold/70 font-medium">★ {favouriteIds.size}</span>
          )}
        </div>
      </div>

      {/* Spacer so content below scrolls cleanly */}
      <div className="flex-1" />
    </div>
  );
}

export default function ExercisesPage() {
  const { isMobile, setMobileSidebarOpen } = useAppContext();
  const { settings } = useDisplaySettings();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterType, setFilterType] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Exercise | null>(null);
  const [showConventionalInDetail, setShowConventionalInDetail] = useState(false);
  const [hoveredExercise, setHoveredExercise] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [filterFavourites, setFilterFavourites] = useState(false);

  // Progression upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [progressionCount, setProgressionCount] = useState(0);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;

  // New exercise form
  const [newName, setNewName] = useState("");
  const [newWuxiaName, setNewWuxiaName] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<string>(DIFFICULTY_LEVELS[0]);
  const [newType, setNewType] = useState("");
  const [newStory, setNewStory] = useState("");
  const [newTarget, setNewTarget] = useState("");

  const availableTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const ex of exercises) {
      const t = (ex.type || "").trim();
      if (t) seen.add(t);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  // Load favourites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVOURITES_KEY);
      if (saved) setFavouriteIds(new Set(JSON.parse(saved)));
    } catch { /* ignore corrupted data */ }
  }, []);

  const toggleFavourite = useCallback((id: string) => {
    setFavouriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const getDifficultyBorderColor = (difficulty: string) => {
    if (difficulty === "Mortal") return "#22c55e";
    if (difficulty === "Foundation Establishment") return "#f59e0b";
    if (difficulty === "Core Formation") return "#ef4444";
    if (difficulty === "Nascent Soul") return "#8b5cf6";
    if (difficulty === "Soul Splitting") return "#ec4899";
    if (difficulty === "Tribulation Transcendence") return "#c4a84a";
    return "#f9a8d4";
  };

  const fetchExercises = useCallback(async () => {
    try {
      const res = await fetch("/api/exercises");
      const data = await res.json();
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    const handleExercisesUpdated = () => {
      fetchExercises();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "exercises-library-updated-at") {
        fetchExercises();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchExercises();
      }
    };

    window.addEventListener("exercises-library-updated", handleExercisesUpdated);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("exercises-library-updated", handleExercisesUpdated);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchExercises]);

  const filteredExercises = exercises.filter((e) => {
    const matchSearch =
      getExerciseSearchText(e).includes(searchTerm.toLowerCase()) ||
      (e.story || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.targetGroup || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchDifficulty = !filterDifficulty || e.difficulty === filterDifficulty;
    const matchType = !filterType || e.type === filterType;
    const matchFavourites = !filterFavourites || favouriteIds.has(e.id);
    return matchSearch && matchDifficulty && matchType && matchFavourites;
  });

  // --- Progression upload/delete logic ---
  const fetchProgressionCount = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/progressions?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      const arr = data.exercises ?? data;
      setProgressionCount(Array.isArray(arr) ? arr.length : 0);
    } catch { setProgressionCount(0); }
  }, [userId]);

  useEffect(() => {
    fetchProgressionCount();
  }, [fetchProgressionCount]);

  const processFile = useCallback(async (file: File) => {
    if (!userId) return;
    setUploadError("");
    setUploadSuccess("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const exercisesArr: Record<string, unknown>[] = Array.isArray(json) ? json : json.exercises;
      if (!Array.isArray(exercisesArr) || exercisesArr.length === 0) {
        setUploadError("Invalid format — expected an array of exercises.");
        return;
      }

      // 1) Import into Exercise library so they show on this page
      const libraryPayload = exercisesArr.map((ex) => {
        const tiers = (ex.progressions || ex.tiers) as { difficulty?: string }[] | undefined;
        const maxDifficulty = tiers?.length
          ? tiers[tiers.length - 1]?.difficulty || "Mortal"
          : (ex.difficulty as string) || "Mortal";
        return {
          name: ex.name,
          wuxiaName: ex.wuxiaName || "",
          difficulty: maxDifficulty,
          type: ex.type || "Unified Realm",
          story: ex.story || "",
          targetGroup: ex.category || "",
        };
      });
      const libRes = await fetch("/api/exercises/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises: libraryPayload }),
      });
      const libData = await libRes.json();
      if (!libRes.ok) {
        setUploadError(libData.error || "Library import failed");
        return;
      }

      // 2) Import into Progression system for tier tracking
      const progRes = await fetch("/api/progressions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, exercises: exercisesArr }),
      });
      const progData = await progRes.json();
      if (!progRes.ok) {
        setUploadError(progData.error || "Progression import failed (library import succeeded)");
        return;
      }

      const imported = libData.imported ?? 0;
      const skipped = (libData.skipped ?? 0) + (progData.skipped ?? 0);
      let msg = `Imported ${imported} exercise${imported !== 1 ? "s" : ""}`;
      if (skipped > 0) msg += ` (${skipped > imported ? Math.ceil(skipped / 2) : skipped} duplicate${skipped !== 1 ? "s" : ""} skipped)`;
      setUploadSuccess(msg);
      fetchExercises();
      fetchProgressionCount();
      window.dispatchEvent(new Event("progression-exercises-updated"));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [userId, fetchExercises, fetchProgressionCount]);

  const handleRemoveAllProgressions = useCallback(async () => {
    if (!userId) return;
    try {
      // Remove progression data
      await fetch(`/api/progressions?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      // Remove exercise library entries
      await fetch("/api/exercises", { method: "DELETE" });
      setProgressionCount(0);
      setShowConfirmRemove(false);
      fetchExercises();
      window.dispatchEvent(new Event("progression-exercises-updated"));
    } catch (err) { console.error("Failed to remove exercises:", err); }
  }, [userId, fetchExercises]);

  const addExercise = async () => {
    if (!newName.trim() || !newType.trim()) return;
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          wuxiaName: newWuxiaName,
          difficulty: newDifficulty,
          type: newType,
          story: newStory,
          targetGroup: newTarget,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewName("");
        setNewWuxiaName("");
        setNewStory("");
        setNewTarget("");
        fetchExercises();
      }
    } catch (err) {
      console.error("Failed to add exercise:", err);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const deleteExercise = async (id: string) => {
    try {
      await fetch(`/api/exercises/${id}`, { method: "DELETE" });
      fetchExercises();
      setShowDetailModal(null);
      setShowConventionalInDetail(false);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete exercise:", err);
    }
  };

  return (
    <PageLayout
      title="Technique Scroll"
      subtitle="A comprehensive library of martial cultivation techniques"
      sidebarLabel="Categories"
      sidebar={
        <ExercisesSidebar
          onAdd={() => setShowAddModal(true)}
          onSearch={setSearchTerm}
          searchTerm={searchTerm}
          filterDifficulty={filterDifficulty}
          setFilterDifficulty={setFilterDifficulty}
          filterType={filterType}
          setFilterType={setFilterType}
          availableTypes={availableTypes}
          total={exercises.length}
          exercises={exercises}
          favouriteIds={favouriteIds}
          onToggleFavourite={toggleFavourite}
          filterFavourites={filterFavourites}
          setFilterFavourites={setFilterFavourites}
          onDismissSidebar={() => setMobileSidebarOpen(false)}
          onUploadProgression={() => { setUploadError(""); setUploadSuccess(""); setShowUploadModal(true); }}
          onRemoveAllProgressions={() => setShowConfirmRemove(true)}
          progressionCount={progressionCount}
        />
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-3xl"
          >
            ☯
          </motion.div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Main content search bar — mobile only; desktop uses sidebar search */}
          {isMobile && (
            <div className="mb-4">
              <GlowInput
                placeholder="Search techniques..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {filteredExercises.length === 0 ? (
        <div className="text-center py-16">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-5xl mb-4"
          >
            📜
          </motion.div>
          <h3 className="text-lg text-cloud-white mb-2">
            {exercises.length === 0
              ? "The Scroll Library is Empty"
              : "No Techniques Found"}
          </h3>
          <p className="text-sm text-mist-mid mb-6">
            {exercises.length === 0
              ? "Add techniques manually or import a JSON scroll to populate your library."
              : "Try adjusting your search or filters."}
          </p>
          {exercises.length === 0 && (
            <div className="flex gap-3 justify-center">
              <GlowButton
                variant="jade"
                glow
                onClick={() => setShowAddModal(true)}
              >
                ✦ Add Technique
              </GlowButton>
            </div>
          )}
        </div>
      ) : (
        <>

          {filteredExercises.map((exercise, i) => (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 260, damping: 22 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.99 }}
              onMouseEnter={() => setHoveredExercise(exercise.id)}
              onMouseLeave={() => setHoveredExercise(null)}
            >
              <GlowCard
                glow={
                  exercise.difficulty === "Heavenly Dao"
                    ? "gold"
                    : exercise.difficulty === "Immortal"
                    ? "gold"
                    : exercise.difficulty.includes("Tribulation")
                    ? "crimson"
                    : "jade"
                }
                onClick={() => setShowDetailModal(exercise)}
                className={`transition-all duration-300 min-h-[172px] shadow-[0_0_12px_rgba(58,143,143,0.2)] ${
                  hoveredExercise === exercise.id
                    ? `${getDifficultyGlow(exercise.difficulty)} shadow-[0_0_20px_rgba(58,143,143,0.4)]`
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 h-full">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-lg pt-0.5 opacity-80">
                      {exercise.type === "Upper Heaven"
                        ? "☁️"
                        : exercise.type === "Lower Realms"
                        ? "🔥"
                        : exercise.type === "Heart Meridian"
                        ? "💚"
                        : "⭐"}
                    </span>
                    <div className="flex flex-col min-w-0 h-full">
                      <h3 className="text-sm font-semibold text-cloud-white truncate leading-snug tracking-wide">
                        {getExerciseDisplayName(exercise, settings.terminologyMode)}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-nowrap overflow-hidden">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getDifficultyColor(exercise.difficulty)} bg-ink-dark/40 whitespace-nowrap border border-current/15`}
                        >
                          {exercise.difficulty}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTypeColor(exercise.type)} bg-ink-dark/40 whitespace-nowrap border border-current/15`}
                        >
                          {exercise.type}
                        </span>
                        {exercise.targetGroup && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${getTargetGroupColor(exercise.targetGroup)} bg-ink-dark/40 truncate border border-current/10`}>
                            {exercise.targetGroup}
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 text-[11px] text-mist-mid leading-relaxed lore-clamp">
                        {exercise.story?.trim() || <span className="italic text-mist-dark">No lore inscribed yet.</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavourite(exercise.id); }}
                      className={`text-base transition-all duration-200 hover:scale-125 ${
                        favouriteIds.has(exercise.id) ? "text-gold opacity-100" : "text-mist-dark/40 opacity-60 hover:opacity-100"
                      }`}
                      aria-label={favouriteIds.has(exercise.id) ? "Remove from favourites" : "Add to favourites"}
                    >
                      {favouriteIds.has(exercise.id) ? "★" : "☆"}
                    </button>
                    <span className="text-mist-dark/60 text-xs">→</span>
                  </div>
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </>
      )}
        </div>
      )}

      {/* Add Exercise Modal */}
      <GlowModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Inscribe New Technique"
      >
        <div className="space-y-3">
          <GlowInput
            label="Exercise Name (Conventional)"
            placeholder="Name of the exercise..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <GlowInput
            label="Technique Name (Wuxia, Optional)"
            placeholder="Wuxia-themed name..."
            value={newWuxiaName}
            onChange={(e) => setNewWuxiaName(e.target.value)}
          />
          <GlowSelect
            label="Cultivation Realm"
            value={newDifficulty}
            onChange={(e) => setNewDifficulty(e.target.value)}
            options={DIFFICULTY_LEVELS.map((d) => ({ value: d, label: d }))}
          />
          <GlowInput
            label="Path"
            placeholder="e.g. barbell, machine, cardio..."
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          />
          <GlowSelect
            label="Target Group"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            options={[
              { value: "", label: "Select Target Group (Optional)" },
              ...TARGET_GROUPS.map((tg) => ({ value: tg, label: tg }))
            ]}
          />
          <GlowInput
            label="Target Group"
            placeholder="e.g. Chest, Legs, Full Body..."
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-xs text-mist-light tracking-wider uppercase">
              Technique Lore
            </label>
            <textarea
              placeholder="The story behind this technique..."
              value={newStory}
              onChange={(e) => setNewStory(e.target.value)}
              rows={3}
              className="w-full bg-ink-dark border border-ink-light rounded-lg px-3 py-2 text-sm text-cloud-white placeholder:text-mist-dark outline-none transition-all duration-300 resize-none focus:border-jade-glow focus:shadow-[0_0_12px_rgba(58,143,143,0.3)]"
            />
          </div>
          <GlowButton variant="jade" glow className="w-full" onClick={addExercise}>
            ✦ Inscribe Technique
          </GlowButton>
        </div>
      </GlowModal>

      {/* Detail Modal */}
      <GlowModal
        isOpen={!!showDetailModal}
        onClose={() => { setShowDetailModal(null); setShowConventionalInDetail(false); }}
        title=""
        hideHeader
        panelClassName="max-w-2xl max-h-[90vh] min-h-[40vh] overflow-y-auto sidebar-scroll"
        contentClassName="p-0"
        glowColor={showDetailModal ? getDifficultyBorderColor(showDetailModal.difficulty) : undefined}
      >
        {showDetailModal && (() => {
          const accentColor = getDifficultyBorderColor(showDetailModal.difficulty);
          return (
            <div className="relative">
              {/* Warm parchment background */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(170deg, ${accentColor}08 0%, transparent 30%, ${accentColor}04 100%)`,
                }}
              />

              {/* ─── Close Button ─── */}
              <div className="sticky top-0 z-20 flex justify-end px-6 pt-5">
                <motion.button
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowDetailModal(null); setShowConventionalInDetail(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-ink-dark/80 backdrop-blur-sm border border-ink-light/50 text-mist-dark hover:text-cloud-white hover:border-mist-mid transition-all duration-200"
                  aria-label="Close technique details"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              {/* ─── Title Section ─── */}
              <div className="px-8 sm:px-12 pt-2 pb-6 text-center relative">
                {/* Decorative top rule */}
                <div
                  className="h-px w-20 mx-auto mb-6 opacity-60"
                  style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
                />

                <h2
                  className="text-2xl sm:text-3xl font-bold tracking-wide leading-tight"
                  style={{
                    fontFamily: "'Cinzel', 'Georgia', serif",
                    color: accentColor,
                    textShadow: `0 0 30px ${accentColor}30`,
                    letterSpacing: '0.04em',
                  }}
                >
                  {getExerciseDisplayName(showDetailModal, settings.terminologyMode)}
                </h2>
                {showDetailModal.wuxiaName && settings.terminologyMode === "normal" && (
                  <p className="mt-2 text-xs text-mist-mid">Wuxia title: {showDetailModal.wuxiaName}</p>
                )}
                {showDetailModal.wuxiaName && settings.terminologyMode === "fantasy" && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setShowConventionalInDetail(!showConventionalInDetail)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${showConventionalInDetail ? 'bg-jade-glow/20 text-jade-glow border border-jade-glow/40' : 'bg-ink-light/30 text-mist-dark hover:text-mist-light hover:bg-ink-light/50 border border-ink-light/40'}`}
                      title="Show conventional name"
                    >
                      i
                    </button>
                    {showConventionalInDetail && (
                      <p className="text-xs text-mist-mid">Conventional name: {showDetailModal.name}</p>
                    )}
                  </div>
                )}

                {/* Decorative bottom rule */}
                <div
                  className="h-px w-20 mx-auto mt-6 opacity-60"
                  style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
                />

                <p
                  className="mt-4 text-[11px] text-mist-dark uppercase tracking-[0.35em]"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Technique Scroll
                </p>
              </div>

              {/* ─── Metadata Strip ─── */}
              <div
                className="mx-6 sm:mx-10 px-5 py-4 rounded-lg flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}08, transparent, ${accentColor}05)`,
                  borderTop: `1px solid ${accentColor}20`,
                  borderBottom: `1px solid ${accentColor}20`,
                }}
              >
                {/* Cultivation Realm */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-mist-dark uppercase tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>
                    Realm
                  </span>
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full border"
                    style={{
                      color: accentColor,
                      borderColor: `${accentColor}40`,
                      backgroundColor: `${accentColor}10`,
                      fontFamily: "'Cinzel', serif",
                    }}
                  >
                    {showDetailModal.difficulty}
                  </span>
                </div>

                {/* Separator dot */}
                <span className="text-ink-light text-[6px] hidden sm:inline">●</span>

                {/* Dao Path */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-mist-dark uppercase tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>
                    Path
                  </span>
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full border"
                    style={{
                      color: '#c9b697',
                      borderColor: '#8b735540',
                      backgroundColor: '#8b735510',
                      fontFamily: "'Cinzel', serif",
                    }}
                  >
                    {showDetailModal.type}
                  </span>
                </div>

                {/* Focus Region */}
                {showDetailModal.targetGroup && (
                  <>
                    <span className="text-ink-light text-[6px] hidden sm:inline">●</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-mist-dark uppercase tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>
                        Focus
                      </span>
                      <span
                        className="text-xs font-medium px-3 py-1 rounded-full border"
                        style={{
                          color: '#a89478',
                          borderColor: '#8b735530',
                          backgroundColor: '#8b735508',
                          fontFamily: "'Cinzel', serif",
                        }}
                      >
                        {showDetailModal.targetGroup}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* ─── Lore / Story Section ─── */}
              {showDetailModal.story ? (
                <div className="px-8 sm:px-12 pt-10 pb-8">
                  {/* Section heading */}
                  <div className="text-center mb-8">
                    <p
                      className="text-[11px] uppercase tracking-[0.4em] font-semibold"
                      style={{
                        color: `${accentColor}cc`,
                        fontFamily: "'Cinzel', serif",
                      }}
                    >
                      Ancient Lore
                    </p>
                    <div
                      className="h-px w-16 mx-auto mt-3 opacity-40"
                      style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
                    />
                  </div>

                  {/* Prose body — optimised for extended reading */}
                  <div className="max-w-prose mx-auto">
                    {showDetailModal.story.split(/\n\n+/).map((paragraph, i) => (
                      <p
                        key={i}
                        className="first-letter:text-[1.5em] first-letter:font-semibold first-letter:leading-[1]"
                        style={{
                          color: '#d4c5b0',
                          fontFamily: "'Libre Baskerville', 'Georgia', 'Times New Roman', serif",
                          fontSize: '0.95rem',
                          lineHeight: '2',
                          textIndent: i > 0 ? '2em' : undefined,
                          marginBottom: '1.5em',
                          textAlign: 'justify',
                          wordBreak: 'break-word',
                          hyphens: 'auto',
                        }}
                      >
                        {paragraph.trim()}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-8 sm:px-12 py-12 text-center">
                  <p className="text-sm text-mist-dark italic" style={{ fontFamily: "'Libre Baskerville', 'Georgia', serif" }}>
                    No lore has been inscribed for this technique.
                  </p>
                </div>
              )}

              {/* ─── Footer Actions ─── */}
              <div
                className="px-8 sm:px-12 py-5 flex justify-center"
                style={{ borderTop: `1px solid ${accentColor}15` }}
              >
                {showDeleteConfirm === showDetailModal.id ? (
                  <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                    <p className="text-xs text-crimson-light text-center">Are you sure you want to remove this technique? This action cannot be undone.</p>
                    <div className="flex gap-2 w-full">
                      <GlowButton
                        variant="crimson"
                        size="sm"
                        onClick={() => deleteExercise(showDetailModal.id)}
                        className="flex-1 font-medium text-xs"
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        Confirm Remove
                      </GlowButton>
                      <GlowButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(null)}
                        className="flex-1 font-medium text-xs"
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        Cancel
                      </GlowButton>
                    </div>
                  </div>
                ) : (
                  <GlowButton
                    variant="crimson"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(showDetailModal.id)}
                    className="font-medium text-xs"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    Remove Technique
                  </GlowButton>
                )}
              </div>
            </div>
          );
        })()}
      </GlowModal>

      {/* ─── Progression Upload Modal ─── */}
      <GlowModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Technique Scroll"
      >
        <div className="space-y-4">
          <p className="text-sm text-mist-light">
            Upload a JSON scroll to populate the <span className="text-jade-glow font-medium">Exercise Library</span> and <span className="text-jade-glow font-medium">Progression</span> tracker.
          </p>
          <input
            ref={modalFileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }}
          />
          <GlowButton
            variant="jade"
            glow
            className="w-full"
            onClick={() => modalFileInputRef.current?.click()}
          >
            📤 Select JSON File
          </GlowButton>
          {uploadError && (
            <p className="text-xs text-crimson-light bg-crimson-dark/10 border border-crimson-dark/20 rounded px-3 py-2">{uploadError}</p>
          )}
          {uploadSuccess && (
            <p className="text-xs text-jade-glow bg-jade-glow/10 border border-jade-glow/20 rounded px-3 py-2">{uploadSuccess}</p>
          )}
          <div className="bg-ink-dark/50 border border-ink-light/20 rounded-lg p-3">
            <p className="text-[10px] text-mist-dark font-medium uppercase tracking-wider mb-2">Expected Format</p>
            <pre className="text-[10px] text-mist-mid leading-relaxed overflow-x-auto sidebar-scroll">
{`{
  "exercises": [
    {
      "name": "Push Up",
      "category": "Upper Body",
      "tiers": [
        {
          "tier": 1,
          "variations": [
            { "name": "Wall Push Up", "reps": "3x10" }
          ]
        }
      ]
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </GlowModal>

      {/* ─── Remove All Progressions Confirmation ─── */}
      <GlowModal
        isOpen={showConfirmRemove}
        onClose={() => setShowConfirmRemove(false)}
        title="Purge All Exercises"
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-crimson-light">
            This will permanently remove all exercises from the library and <span className="font-bold">{progressionCount}</span> progression exercise{progressionCount !== 1 ? "s" : ""} with all training logs.
          </p>
          <p className="text-xs text-mist-dark">This action cannot be undone.</p>
          <div className="flex gap-3 justify-center pt-2">
            <GlowButton variant="crimson" glow onClick={handleRemoveAllProgressions}>
              Purge All
            </GlowButton>
            <GlowButton variant="ghost" onClick={() => setShowConfirmRemove(false)}>
              Cancel
            </GlowButton>
          </div>
        </div>
      </GlowModal>
    </PageLayout>
  );
}
