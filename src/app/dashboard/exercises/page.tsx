"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowInput from "@/components/ui/GlowInput";
import { GlowSelect } from "@/components/ui/GlowInput";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { getExerciseDisplayName, getExerciseSearchText } from "@/lib/exercise-name";
import {
  DIFFICULTY_LEVELS,
  EXERCISE_TYPES,
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
  total,
  isMobile,
  exercises: _exercises,
  favouriteIds,
  onToggleFavourite: _onToggleFavourite,
  filterFavourites,
  setFilterFavourites,
  onDismissSidebar,
}: {
  onAdd: () => void;
  onSearch: (term: string) => void;
  searchTerm: string;
  filterDifficulty: string;
  setFilterDifficulty: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  total: number;
  isMobile: boolean;
  exercises: Exercise[];
  favouriteIds: Set<string>;
  onToggleFavourite: (id: string) => void;
  filterFavourites: boolean;
  setFilterFavourites: (v: boolean) => void;
  onDismissSidebar: () => void;
}) {
  return (
    <div className="space-y-3">
      <GlowButton variant="jade" size="sm" glow className="w-full" onClick={onAdd}>
        ✦ Add Technique
      </GlowButton>

      <div className="pt-4 border-t border-ink-light">
        <GlowInput
          placeholder="Search techniques..."
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter") onDismissSidebar();
          }}
        />
      </div>

      {/* Favourites filter — always visible */}
      <div className="pt-2">
        <GlowButton
          variant={filterFavourites ? "gold" : "ghost"}
          size="sm"
          className="w-full text-xs"
          onClick={() => setFilterFavourites(!filterFavourites)}
        >
          ★ Favourites{favouriteIds.size > 0 ? ` (${favouriteIds.size})` : ""}
        </GlowButton>
      </div>

      <div className="pt-2 space-y-2">
        {isMobile ? (
          <>
            <GlowSelect
              label="Difficulty"
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              options={[
                { value: "", label: "All Realms" },
                ...DIFFICULTY_LEVELS.map((d) => ({ value: d, label: d })),
              ]}
            />
            <GlowSelect
              label="Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[
                { value: "", label: "All Paths" },
                ...EXERCISE_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-mist-dark uppercase mb-2">Realm</p>
              <div className="flex flex-wrap gap-1">
                <GlowButton
                  variant={filterDifficulty === "" ? "jade" : "ghost"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setFilterDifficulty("")}
                >
                  All
                </GlowButton>
                {DIFFICULTY_LEVELS.map((d) => (
                  <GlowButton
                    key={d}
                    variant={filterDifficulty === d ? "jade" : "ghost"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setFilterDifficulty(d)}
                  >
                    {d.split(" ")[0]}
                  </GlowButton>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-mist-dark uppercase mb-2">Path</p>
              <div className="flex flex-wrap gap-1">
                <GlowButton
                  variant={filterType === "" ? "jade" : "ghost"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setFilterType("")}
                >
                  All
                </GlowButton>
                {EXERCISE_TYPES.map((t) => (
                  <GlowButton
                    key={t}
                    variant={filterType === t ? "jade" : "ghost"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setFilterType(t)}
                  >
                    {t.split(" ")[0]}
                  </GlowButton>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pt-4 border-t border-ink-light">
        <p className="text-xs text-mist-dark">
          <span className="text-jade-glow">{total}</span> techniques in library
        </p>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  const { isMobile, setMobileSidebarOpen } = useAppContext();
  const { settings } = useDisplaySettings();
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

  // New exercise form
  const [newName, setNewName] = useState("");
  const [newWuxiaName, setNewWuxiaName] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<string>(DIFFICULTY_LEVELS[0]);
  const [newType, setNewType] = useState<string>(EXERCISE_TYPES[0]);
  const [newStory, setNewStory] = useState("");
  const [newTarget, setNewTarget] = useState("");

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

  const addExercise = async () => {
    if (!newName.trim()) return;
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

  const deleteExercise = async (id: string) => {
    try {
      await fetch(`/api/exercises/${id}`, { method: "DELETE" });
      fetchExercises();
      setShowDetailModal(null);
      setShowConventionalInDetail(false);
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
          total={exercises.length}
          isMobile={isMobile}
          exercises={exercises}
          favouriteIds={favouriteIds}
          onToggleFavourite={toggleFavourite}
          filterFavourites={filterFavourites}
          setFilterFavourites={setFilterFavourites}
          onDismissSidebar={() => setMobileSidebarOpen(false)}
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
                  exercise.difficulty === "Immortal"
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
          <GlowSelect
            label="Path"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            options={EXERCISE_TYPES.map((t) => ({ value: t, label: t }))}
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
                <GlowButton
                  variant="crimson"
                  size="sm"
                  onClick={() => deleteExercise(showDetailModal.id)}
                  className="font-medium text-xs"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Remove Technique
                </GlowButton>
              </div>
            </div>
          );
        })()}
      </GlowModal>
    </PageLayout>
  );
}
