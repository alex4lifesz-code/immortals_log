"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings, TechniqueDisplayMode, ActiveCardStyle } from "@/context/DisplaySettingsContext";
import { getDifficultyColor, getTypeColor, DAY_ABBREVIATIONS, parseDayAssignments } from "@/lib/constants";
import { getDifficultyColorClass, getDifficultyGlowStyleScaled, getDifficultyStyle } from "@/lib/difficulty-styles";
import { getExerciseDisplayName, matchesLooseSearchInFields } from "@/lib/exercise-name";
import { useAppContext } from "@/context/AppContext";
import TechniqueManagementDrawer from "@/components/workout/TechniqueManagementDrawer";

// ── Types ──

interface ProgressionTier {
  id: string;
  level: number;
  name: string;
  wuxiaName: string;
  difficulty: string;
  description: string;
  targetHold: number | null;
  targetReps: number | null;
}

interface ProgressionVariation {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  description: string;
}

interface ProgressionModifier {
  id: string;
  type: string;
  available: boolean;
  difficultyMod: number;
  notes: string;
}

interface ProgressionLog {
  id: string;
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
  reps: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
  completed: boolean;
  createdAt: string;
}

interface UserProgress {
  id: string;
  currentLevel: number;
  logs: ProgressionLog[];
}

interface ProgressionExercise {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  type: string;
  story: string;
  tips: string;
  category: string;
  equipmentType: string;
  bodyweight: boolean;
  weighted: boolean;
  rings: boolean;
  primaryMuscles: string;
  secondaryMuscles: string;
  assignedDays: string;
  tiers: ProgressionTier[];
  variations: ProgressionVariation[];
  modifiers: ProgressionModifier[];
  userProgress: UserProgress[];
}

function parseTips(tips: string): string[] {
  if (!tips) return [];
  try { const arr = JSON.parse(tips); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

function getExerciseIcon(type: string): string {
  if (type === "Upper Heaven") return "☁️";
  if (type === "Lower Realms") return "🔥";
  if (type === "Heart Meridian") return "💚";
  if (type === "Unified Realm") return "⭐";
  return "🔱";
}

// ── Helpers ──

function getSelectedLevel(exercise: ProgressionExercise, defaults: Record<string, number>): number {
  if (defaults[exercise.id]) return defaults[exercise.id];
  return exercise.userProgress[0]?.currentLevel ?? 1;
}

function getTierName(exercise: ProgressionExercise, level: number): string {
  const tier = exercise.tiers.find((t) => t.level === level);
  return tier ? tier.name : `Level ${level}`;
}

function hasHoldBasedTiers(exercise: ProgressionExercise): boolean {
  return exercise.tiers.some((t) => t.targetHold != null);
}

const DIFFICULTY_SCALE = [
  "Mortal",
  "Foundation Establishment",
  "Core Formation",
  "Nascent Soul",
  "Soul Splitting",
  "Tribulation Transcendence",
  "Immortal",
  "Heavenly Dao",
] as const;

function getWeightedDifficulty(
  exercise: ProgressionExercise,
  level: number,
  variantName?: string | null,
  modifierType?: string | null,
): string {
  const sorted = [...exercise.tiers].sort((a, b) => a.level - b.level);
  const idx = sorted.findIndex((t) => t.level === level);
  const maxIdx = Math.max(sorted.length - 1, 1);

  // Base score from tier level position (0.0 → 1.0)
  let score = idx === -1 ? 0 : idx / maxIdx;

  // Variation shift: map variation difficulty to scale, shift ±0.15
  if (variantName && exercise.variations) {
    const variation = exercise.variations.find(v => v.name === variantName);
    if (variation?.difficulty) {
      const diffIdx = DIFFICULTY_SCALE.indexOf(variation.difficulty as typeof DIFFICULTY_SCALE[number]);
      if (diffIdx !== -1) {
        score += ((diffIdx / (DIFFICULTY_SCALE.length - 1)) - 0.5) * 0.30;
      }
    }
  }

  // Modifier shift: map difficultyMod to ±0.15
  if (modifierType && exercise.modifiers) {
    const modifier = exercise.modifiers.find(m => m.type === modifierType);
    if (modifier) {
      score += Math.max(-1, Math.min(1, modifier.difficultyMod / 3)) * 0.15;
    }
  }

  score = Math.max(0, Math.min(1, score));
  const scaleIdx = Math.round(score * (DIFFICULTY_SCALE.length - 1));
  return DIFFICULTY_SCALE[scaleIdx];
}

function getEquipmentTags(exercise: ProgressionExercise): string[] {
  const tags: string[] = [];
  if (exercise.bodyweight) tags.push("Bodyweight");
  if (exercise.weighted) tags.push("Weighted");
  if (exercise.rings) tags.push("Rings");
  if (tags.length === 0) tags.push(exercise.equipmentType);
  return tags;
}

// ── Equipment Badge ──

function EquipmentBadges({ exercise }: { exercise: ProgressionExercise }) {
  const badges: { label: string; color: string }[] = [];
  if (exercise.bodyweight) badges.push({ label: "BW", color: "text-jade-glow border-jade/40" });
  if (exercise.weighted) badges.push({ label: "W", color: "text-gold border-gold-dim/40" });
  if (exercise.rings) badges.push({ label: "R", color: "text-crimson-light border-crimson/40" });
  if (badges.length === 0) badges.push({ label: exercise.equipmentType, color: "text-mist-light border-ink-light" });

  return (
    <div className="flex gap-0.5">
      {badges.map((b) => (
        <span key={b.label} className={`text-[9px] px-1 py-0 border rounded ${b.color}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

// ── Level Status Icon ──

function LevelStatus({ tierLevel, currentLevel, logs }: { tierLevel: number; currentLevel: number; logs: ProgressionLog[] }) {
  const completedLogs = logs.filter((l) => l.level === tierLevel && l.completed);
  if (completedLogs.length > 0) return <span className="text-jade-glow text-xs">✦</span>;
  if (tierLevel === currentLevel) return <span className="text-gold text-xs animate-pulse">◆</span>;
  if (tierLevel < currentLevel) return <span className="text-jade/60 text-xs">✓</span>;
  return <span className="text-mist-dark text-xs">○</span>;
}

// ── Detail View Modal ──

function ExerciseDetailModal({
  exercise,
  isOpen,
  onClose,
}: {
  exercise: ProgressionExercise | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { settings } = useDisplaySettings();

  if (!exercise) return null;

  const isFantasy = settings.terminologyMode === "fantasy";
  const progress = exercise.userProgress[0];
  const currentLevel = progress?.currentLevel ?? 1;
  const logs = progress?.logs ?? [];
  const totalTiers = exercise.tiers.length;
  const completedTiers = exercise.tiers.filter((t) =>
    logs.some((l) => l.level === t.level && l.completed)
  ).length;
  const progressPercent = totalTiers > 0 ? Math.round((Math.min(currentLevel - 1, totalTiers) / totalTiers) * 100) : 0;

  const modalDiff = getWeightedDifficulty(exercise, currentLevel);
  const diffColorClass = getDifficultyColorClass(modalDiff);

  return (
    <GlowModal
      isOpen={isOpen}
      onClose={onClose}
      title={getExerciseDisplayName(exercise, settings.terminologyMode)}
      panelClassName="!max-w-2xl"
    >
      <div className="space-y-3">
        {/* Header badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {exercise.type && (
              <span className="text-base">{getExerciseIcon(exercise.type)}</span>
            )}
            {isFantasy && exercise.name && exercise.name !== exercise.wuxiaName && (
              <span className="text-[11px] text-mist-mid">{exercise.name}</span>
            )}
            <span className={`text-[9px] font-semibold px-1.5 py-0 rounded-full ${diffColorClass} bg-ink-dark/50 border border-current/30`}>
              {modalDiff}
            </span>
            {exercise.type && (
              <span className={`text-[9px] font-medium px-1.5 py-0 rounded-full ${getTypeColor(exercise.type)} bg-ink-dark/40 border border-current/15`}>
                {exercise.type}
              </span>
            )}
            <EquipmentBadges exercise={exercise} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] text-mist-dark">{completedTiers}/{totalTiers}</span>
          </div>
        </div>

        {/* Story */}
        {exercise.story && (
          <p className="text-[10px] text-mist-mid leading-relaxed italic">{exercise.story}</p>
        )}

        {/* Muscles */}
        <div className="flex flex-wrap gap-1">
          {exercise.primaryMuscles.split(",").filter(Boolean).map((m) => (
            <span key={m.trim()} className="text-[9px] px-1.5 py-0.5 bg-jade-deep/40 text-jade-light rounded">{m.trim()}</span>
          ))}
          {exercise.secondaryMuscles.split(",").filter(Boolean).map((m) => (
            <span key={m.trim()} className="text-[9px] px-1.5 py-0.5 bg-ink-mid/60 text-mist-light rounded">{m.trim()}</span>
          ))}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-mist-dark uppercase tracking-wider">Progress</span>
            <span className="text-[9px] text-mist-dark">{progressPercent}%</span>
          </div>
          <div className="h-1 bg-ink-mid rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-jade-deep to-jade-glow transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Progression Tiers */}
        <div>
          <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1">Progression Tiers</h4>
          <div className="space-y-px">
            {exercise.tiers.map((tier) => {
              const isCompleted = logs.some((l) => l.level === tier.level && l.completed);
              const isCurrent = tier.level === currentLevel;

              return (
                <div
                  key={tier.id}
                  className={`flex items-start gap-2 py-1.5 px-2 rounded ${isCurrent ? "bg-ink-mid/20" : ""}`}
                >
                  <div className="pt-px">
                    <LevelStatus tierLevel={tier.level} currentLevel={currentLevel} logs={logs} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-mist-dark font-mono">Lv.{tier.level}</span>
                      <span className={`text-xs font-medium ${isCompleted ? "text-jade-light" : isCurrent ? "text-gold" : "text-cloud-white"}`}>
                        {getExerciseDisplayName(tier, settings.terminologyMode)}
                      </span>
                      {tier.difficulty && (
                        <span className={`text-[8px] px-1 py-0 rounded-full ${getDifficultyColor(tier.difficulty)} bg-ink-dark/40 border border-current/15`}>
                          {tier.difficulty}
                        </span>
                      )}
                    </div>
                    {isFantasy && tier.wuxiaName && tier.name !== tier.wuxiaName && (
                      <p className="text-[9px] text-mist-dark">{tier.name}</p>
                    )}
                    {tier.description && <p className="text-[10px] text-mist-mid leading-snug">{tier.description}</p>}
                    {(tier.targetHold != null || tier.targetReps != null) && (
                      <div className="flex gap-2 mt-0.5">
                        {tier.targetHold != null && <span className="text-[9px] text-mountain-blue-glow">Hold: {tier.targetHold}s</span>}
                        {tier.targetReps != null && <span className="text-[9px] text-mountain-blue-glow">Reps: {tier.targetReps}</span>}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Variations */}
        {exercise.variations.length > 0 && (
          <div className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1">Variations</h4>
            <div className="space-y-1">
              {exercise.variations.map((v) => (
                <div key={v.id} className="text-[11px] flex items-center gap-1.5">
                  <span className="text-mountain-blue-glow shrink-0">◇</span>
                  <span className="text-cloud-white">{getExerciseDisplayName(v, settings.terminologyMode)}</span>
                  {v.difficulty && (
                    <span className={`text-[8px] px-1 py-0 rounded-full ${getDifficultyColor(v.difficulty)} bg-ink-dark/40 border border-current/15`}>
                      {v.difficulty}
                    </span>
                  )}
                  {isFantasy && v.wuxiaName && v.name !== v.wuxiaName && (
                    <span className="text-mist-dark text-[9px]">({v.name})</span>
                  )}
                  {v.description && <span className="text-mist-dark text-[9px]">— {v.description}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modifiers */}
        {exercise.modifiers.length > 0 && (
          <div className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1">Modifiers</h4>
            <div className="space-y-0.5">
              {exercise.modifiers.map((m) => (
                <div key={m.id} className="text-[11px] flex items-center gap-1.5">
                  <span className={m.available ? "text-jade-glow" : "text-mist-dark"}>{m.available ? "●" : "○"}</span>
                  <span className="text-cloud-white capitalize">{m.type}</span>
                  {m.difficultyMod !== 0 && <span className="text-gold text-[9px] font-mono">{m.difficultyMod > 0 ? "+" : ""}{m.difficultyMod}</span>}
                  {m.notes && <span className="text-mist-dark text-[9px]">({m.notes})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {parseTips(exercise.tips).length > 0 && (
          <div className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1">Cultivation Tips</h4>
            <ul className="space-y-0.5">
              {parseTips(exercise.tips).map((tip, i) => (
                <li key={i} className="text-[11px] text-mist-mid flex gap-1.5">
                  <span className="text-jade-glow shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GlowModal>
  );
}

// ── Training Log Table ──

interface FlatLogEntry {
  logId: string;
  date: string;
  exerciseName: string;
  exerciseId: string;
  level: number;
  tierName: string;
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
  completed: boolean;
  hasHold: boolean;
}

function flattenLogs(exercises: ProgressionExercise[]): FlatLogEntry[] {
  const entries: FlatLogEntry[] = [];

  for (const ex of exercises) {
    const progress = ex.userProgress[0];
    if (!progress) continue;
    for (const log of progress.logs) {
      const logHasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
      entries.push({
        logId: log.id,
        date: log.createdAt,
        exerciseName: ex.name,
        exerciseId: ex.id,
        level: log.level,
        tierName: getTierName(ex, log.level),
        weight1: log.weight1,
        reps1: log.reps1,
        weight2: log.weight2,
        reps2: log.reps2,
        weight3: log.weight3,
        reps3: log.reps3,
        holdTime: log.holdTime,
        holdTime2: log.holdTime2,
        holdTime3: log.holdTime3,
        modifier: log.modifier,
        variant: log.variant,
        notes: log.notes,
        completed: log.completed,
        hasHold: logHasHold,
      });
    }
  }
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return entries;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function displayVal(v: number | null): string {
  return v != null ? String(v) : "—";
}

function TrainingLogTable({
  exercises,
  onViewExercise,
  onRefresh,
  userId,
}: {
  exercises: ProgressionExercise[];
  onViewExercise: (exerciseId: string) => void;
  onRefresh: () => void;
  userId: string;
}) {
  const allEntries = flattenLogs(exercises);
  // Filter out hold-based entries — they go in the separate hold table
  const entries = allEntries.filter(e => !e.hasHold);
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, {
    weight1: number | null; reps1: number | null;
    weight2: number | null; reps2: number | null;
    weight3: number | null; reps3: number | null;
    modifier: string | null; variant: string | null; notes: string | null;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ logId: string; exerciseName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const logMode = settings.progressionLogMode ?? "name-illumination-realm";
  const compactSetting = settings.progressionLogCompact ?? "auto";
  const glowIntensity = settings.glowIntensityProgressionLog ?? 100;
  const columnColors = settings.progressionColumnColorsEnabled ?? true;
  const columnGrouped = settings.progressionColumnOrderGrouped ?? false;

  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && isMobile);

  const showIllumination = logMode !== "name-only";
  const showRealm = logMode === "name-illumination-realm" || logMode === "name-illumination-realm-path";
  const showPath = logMode === "name-illumination-realm-path";

  // Build exercise lookup for display
  const exerciseLookup = new Map(exercises.map(e => [e.id, e]));

  const anyModifier = entries.some(e => e.modifier);
  const anyVariant = entries.some(e => e.variant);

  const getZeroValueStyle = (value: number | null, colType: string): React.CSSProperties | undefined => {
    if (value === 0) return { backgroundColor: 'var(--ink-mid)', color: 'var(--mist-dark)' };
    if (columnColors && colType === 'weight') return { backgroundColor: 'var(--col-weight-bg)' };
    if (columnColors && colType === 'reps') return { backgroundColor: 'var(--col-reps-bg)' };
    return undefined;
  };

  // Clear save message after 5 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleEditModeToggle = () => {
    if (!isEditMode) {
      const newData: typeof editingData = {};
      entries.forEach(entry => {
        newData[entry.logId] = {
          weight1: entry.weight1, reps1: entry.reps1,
          weight2: entry.weight2, reps2: entry.reps2,
          weight3: entry.weight3, reps3: entry.reps3,
          modifier: entry.modifier, variant: entry.variant, notes: entry.notes,
        };
      });
      setEditingData(newData);
    }
    setIsEditMode(!isEditMode);
  };

  const handleEditChange = (logId: string, field: string, value: string | number | null) => {
    setEditingData(prev => ({ ...prev, [logId]: { ...prev[logId], [field]: value } }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(editingData).map(([id, data]) => ({ id, ...data }));
      const res = await fetch("/api/progressions/logs/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Training logs updated successfully!" });
        setIsEditMode(false);
        setEditingData({});
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to save changes" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to save changes" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingData({});
  };

  const handleDeleteLog = async (logId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/progressions/logs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Log record deleted successfully" });
        setDeleteConfirm(null);
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to delete record" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to delete record" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Column order
  const dataColumns = columnGrouped
    ? ["weight1", "weight2", "weight3", "reps1", "reps2", "reps3"] as const
    : ["weight1", "reps1", "weight2", "reps2", "weight3", "reps3"] as const;

  const dataColumnLabels = columnGrouped
    ? ["W1", "W2", "W3", "R1", "R2", "R3"]
    : ["W1", "R1", "W2", "R2", "W3", "R3"];

  const dataColumnTypes = columnGrouped
    ? ["weight", "weight", "weight", "reps", "reps", "reps"]
    : ["weight", "reps", "weight", "reps", "weight", "reps"];

  const fieldMeta: Record<string, { type: "weight" | "reps"; min: string; max?: string; step?: string }> = {
    weight1: { type: "weight", min: "0", step: "0.5" },
    weight2: { type: "weight", min: "0", step: "0.5" },
    weight3: { type: "weight", min: "0", step: "0.5" },
    reps1: { type: "reps", min: "0", max: "500" },
    reps2: { type: "reps", min: "0", max: "500" },
    reps3: { type: "reps", min: "0", max: "500" },
  };

  return (
    <>
    <GlowCard className="!p-0 overflow-hidden" glow="jade" hoverable={false}>
      {/* Edit header bar */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-ink-light">
          <div className="flex items-center gap-2">
            {saveMessage && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-[11px] ${saveMessage.type === "success" ? "text-jade-light" : "text-crimson-light"}`}
              >
                {saveMessage.text}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <GlowButton variant="jade" size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? "Saving..." : "✓ Save"}
                </GlowButton>
                <GlowButton variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                  ✕ Cancel
                </GlowButton>
              </>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEditModeToggle}
                className="text-xs px-3 py-1 rounded border border-jade-glow/40 text-jade-light hover:bg-jade-deep/10 transition-all"
              >
                ✎ Edit
              </motion.button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <table className={`text-xs border-collapse w-full`} style={{ whiteSpace: "nowrap", minWidth: effectiveCompact ? "400px" : (isEditMode ? "720px" : "650px") }}>
          <thead>
            <tr className="border-b-2 border-jade-glow/50 bg-ink-mid/40 text-mist-light">
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Date</th>
              <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}>Lvl</th>
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Exercise</th>
              {dataColumnLabels.map((label, idx) => (
                <th
                  key={label + idx}
                  className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}
                  style={columnColors ? { color: dataColumnTypes[idx] === "weight" ? "var(--col-weight)" : "var(--col-reps)" } : undefined}
                >
                  {label}
                </th>
              ))}
              {anyModifier && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-amber-400`}>Mod</th>
              )}
              {anyVariant && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-purple-400`}>Variant</th>
              )}
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Notes</th>
              {isEditMode && <th className="px-1 py-2 text-center font-semibold text-mist-glow text-[11px] align-middle">⋮</th>}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={10 + (anyModifier ? 1 : 0) + (anyVariant ? 1 : 0) + (isEditMode ? 1 : 0)} className="py-6 text-center text-mist-mid text-sm">
                  No training data logged yet. Select an exercise from the sidebar to log your first set.
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {entries.map((entry, i) => {
                  const ex = exerciseLookup.get(entry.exerciseId);
                  const tier = ex?.tiers.find(t => t.level === entry.level);
                  const tierDifficulty = ex ? getWeightedDifficulty(ex, entry.level, entry.variant, entry.modifier) : '';
                  const diffColorClass = tierDifficulty ? getDifficultyColorClass(tierDifficulty) : '';
                  const exerciseGlow = tierDifficulty ? getDifficultyGlowStyleScaled(tierDifficulty, glowIntensity) : {};
                  const entryDisplayName = tier
                    ? getExerciseDisplayName(tier, settings.terminologyMode)
                    : ex ? getExerciseDisplayName(ex, settings.terminologyMode) : entry.exerciseName;
                  const editData = editingData[entry.logId];

                  return (
                    <motion.tr
                      key={entry.logId}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ delay: i * 0.02 }}
                      className={`border-b transition-all duration-200 ${
                        isEditMode
                          ? "border-jade-glow/20 bg-jade-deep/10 hover:bg-jade-deep/15"
                          : "border-ink-light hover:bg-ink-mid/15"
                      }`}
                    >
                      <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs align-middle whitespace-nowrap`}>{formatDate(entry.date)}</td>
                      <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center align-middle`}>
                        <span className="text-[10px] text-gold" title={entry.tierName}>{entry.level}</span>
                      </td>
                      <td
                        className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} align-middle whitespace-normal cursor-pointer hover:bg-jade-deep/10 rounded transition-colors`}
                        style={{ minWidth: "120px", maxWidth: "260px", wordBreak: "break-word" }}
                        onClick={() => !isEditMode && onViewExercise(entry.exerciseId)}
                      >
                        {!showIllumination ? (
                          <span className="text-xs text-cloud-white" title={entryDisplayName}>
                            {entryDisplayName}
                          </span>
                        ) : (
                          <div
                            className="px-2 py-1 rounded border inline-flex items-center gap-1.5"
                            style={glowIntensity > 0 ? exerciseGlow as React.CSSProperties : undefined}
                            title={entryDisplayName}
                          >
                            <span className={`text-xs font-normal ${diffColorClass}`}>
                              {entryDisplayName}
                            </span>
                            {showRealm && ex && (
                              <>
                                <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${diffColorClass} border border-current/20 opacity-80`}>
                                  {tierDifficulty}
                                </span>
                                {showPath && ex.type && (
                                  <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getTypeColor(ex.type)} border border-current/20 opacity-70`}>
                                    {ex.type}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      {dataColumns.map((col, idx) => {
                        const meta = fieldMeta[col];
                        if (isEditMode && editData) {
                          const editVal = editData[col as keyof typeof editData];
                          return (
                            <td key={col + idx} className="px-1 py-1.5 text-center align-middle">
                              <input
                                type="number"
                                min={meta.min}
                                max={meta.max}
                                step={meta.step}
                                value={editVal ?? ""}
                                onChange={(e) =>
                                  handleEditChange(
                                    entry.logId,
                                    col,
                                    e.target.value
                                      ? meta.type === "weight" ? parseFloat(e.target.value) : parseInt(e.target.value)
                                      : null
                                  )
                                }
                                placeholder="—"
                                className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-cloud-white text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                              />
                            </td>
                          );
                        }
                        return (
                          <td
                            key={col + idx}
                            className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-cloud-white text-xs align-middle`}
                            style={getZeroValueStyle(entry[col], dataColumnTypes[idx])}
                          >
                            {displayVal(entry[col])}
                          </td>
                        );
                      })}
                      {anyModifier && (
                        isEditMode && editData ? (
                          <td className="px-1 py-1.5 text-center align-middle">
                            <input
                              type="text"
                              value={editData.modifier ?? ""}
                              onChange={(e) => handleEditChange(entry.logId, "modifier", e.target.value || null)}
                              placeholder="—"
                              className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-amber-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                            />
                          </td>
                        ) : (
                          <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-amber-400 text-xs truncate max-w-[80px] align-middle`} title={entry.modifier || ""}>
                            {entry.modifier || "—"}
                          </td>
                        )
                      )}
                      {anyVariant && (
                        isEditMode && editData ? (
                          <td className="px-1 py-1.5 text-center align-middle">
                            <input
                              type="text"
                              value={editData.variant ?? ""}
                              onChange={(e) => handleEditChange(entry.logId, "variant", e.target.value || null)}
                              placeholder="—"
                              className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-purple-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                            />
                          </td>
                        ) : (
                          <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-purple-400 text-xs truncate max-w-[80px] align-middle`} title={entry.variant || ""}>
                            {entry.variant || "—"}
                          </td>
                        )
                      )}
                      {isEditMode && editData ? (
                        <td className="px-1.5 py-1.5 align-middle">
                          <input
                            type="text"
                            value={editData.notes ?? ""}
                            onChange={(e) => handleEditChange(entry.logId, "notes", e.target.value || null)}
                            placeholder="Add notes..."
                            className="w-full min-w-[100px] bg-ink-deep border border-jade-glow/30 rounded px-2 py-1 text-cloud-white text-xs placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                          />
                        </td>
                      ) : (
                        <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs truncate max-w-[180px] align-middle`} title={entry.notes || ""}>
                          {entry.notes || "—"}
                          {entry.completed && <span className="text-jade-glow ml-1">✦</span>}
                        </td>
                      )}
                      {isEditMode && (
                        <td className="px-1 py-1.5 text-center align-middle">
                          <motion.button
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setDeleteConfirm({ logId: entry.logId, exerciseName: entryDisplayName })}
                            className="text-crimson-light hover:text-crimson-glow transition-colors text-lg"
                            title="Delete this log record"
                            disabled={isDeleting}
                          >
                            ✕
                          </motion.button>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </GlowCard>

    {/* Delete Confirmation Modal */}
    <AnimatePresence>
      {deleteConfirm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setDeleteConfirm(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] max-w-[90vw] bg-ink-deep border border-ink-light rounded-xl shadow-2xl p-5"
            style={{ boxShadow: "0 0 30px rgba(200, 50, 50, 0.15), 0 20px 40px rgba(0,0,0,0.4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-crimson-light mb-3">Delete Training Record</h3>
            <p className="text-xs text-mist-light mb-5 leading-relaxed">
              Are you sure you want to permanently delete the log record for{" "}
              <span className="text-cloud-white font-medium">{deleteConfirm.exerciseName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDeleteLog(deleteConfirm.logId)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-crimson-deep/30 border border-crimson/50 text-crimson-light hover:bg-crimson-deep/50 transition-all duration-200 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Record"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border border-ink-light text-mist-light hover:bg-ink-mid/30 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

// ── Hold Training Log Table (separate table below main for hold-based exercises) ──

function HoldTrainingLogTable({
  exercises,
  onViewExercise,
  onRefresh,
  userId,
}: {
  exercises: ProgressionExercise[];
  onViewExercise: (exerciseId: string) => void;
  onRefresh: () => void;
  userId: string;
}) {
  const allEntries = flattenLogs(exercises);
  const entries = allEntries.filter(e => e.hasHold);
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, {
    reps1: number | null; holdTime: number | null;
    reps2: number | null; holdTime2: number | null;
    reps3: number | null; holdTime3: number | null;
    modifier: string | null; variant: string | null; notes: string | null;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ logId: string; exerciseName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const logMode = settings.progressionLogMode ?? "name-illumination-realm";
  const compactSetting = settings.progressionLogCompact ?? "auto";
  const glowIntensity = settings.glowIntensityProgressionLog ?? 100;
  const columnColors = settings.progressionColumnColorsEnabled ?? true;
  const columnGrouped = settings.progressionColumnOrderGrouped ?? false;

  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && isMobile);

  const showIllumination = logMode !== "name-only";
  const showRealm = logMode === "name-illumination-realm" || logMode === "name-illumination-realm-path";
  const showPath = logMode === "name-illumination-realm-path";

  const exerciseLookup = new Map(exercises.map(e => [e.id, e]));

  const anyModifier = entries.some(e => e.modifier);
  const anyVariant = entries.some(e => e.variant);

  const getZeroValueStyle = (value: number | null, colType: string): React.CSSProperties | undefined => {
    if (value === 0) return { backgroundColor: 'var(--ink-mid)', color: 'var(--mist-dark)' };
    if (columnColors && colType === 'reps') return { backgroundColor: 'var(--col-reps-bg)' };
    if (columnColors && colType === 'hold') return { backgroundColor: 'rgba(94, 184, 232, 0.08)' };
    return undefined;
  };

  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleEditModeToggle = () => {
    if (!isEditMode) {
      const newData: typeof editingData = {};
      entries.forEach(entry => {
        newData[entry.logId] = {
          reps1: entry.reps1, holdTime: entry.holdTime,
          reps2: entry.reps2, holdTime2: entry.holdTime2,
          reps3: entry.reps3, holdTime3: entry.holdTime3,
          modifier: entry.modifier, variant: entry.variant, notes: entry.notes,
        };
      });
      setEditingData(newData);
    }
    setIsEditMode(!isEditMode);
  };

  const handleEditChange = (logId: string, field: string, value: string | number | null) => {
    setEditingData(prev => ({ ...prev, [logId]: { ...prev[logId], [field]: value } }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(editingData).map(([id, data]) => ({
        id,
        weight1: null, weight2: null, weight3: null,
        reps1: data.reps1, holdTime: data.holdTime,
        reps2: data.reps2, holdTime2: data.holdTime2,
        reps3: data.reps3, holdTime3: data.holdTime3,
        modifier: data.modifier, variant: data.variant, notes: data.notes,
      }));
      const res = await fetch("/api/progressions/logs/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Hold training logs updated!" });
        setIsEditMode(false);
        setEditingData({});
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to save changes" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to save changes" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingData({});
  };

  const handleDeleteLog = async (logId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/progressions/logs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Log record deleted successfully" });
        setDeleteConfirm(null);
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to delete record" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to delete record" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (entries.length === 0) return null;

  const holdFields = columnGrouped
    ? [
        { key: "holdTime", label: "H1", type: "hold" },
        { key: "holdTime2", label: "H2", type: "hold" },
        { key: "holdTime3", label: "H3", type: "hold" },
        { key: "reps1", label: "R1", type: "reps" },
        { key: "reps2", label: "R2", type: "reps" },
        { key: "reps3", label: "R3", type: "reps" },
      ] as const
    : [
        { key: "holdTime", label: "H1", type: "hold" },
        { key: "reps1", label: "R1", type: "reps" },
        { key: "holdTime2", label: "H2", type: "hold" },
        { key: "reps2", label: "R2", type: "reps" },
        { key: "holdTime3", label: "H3", type: "hold" },
        { key: "reps3", label: "R3", type: "reps" },
      ] as const;

  return (
    <>
    <GlowCard className="!p-0 overflow-hidden" glow="jade" hoverable={false}>
      {/* Edit header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-ink-light">
        <div className="flex items-center gap-2">
          {saveMessage && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-[11px] ${saveMessage.type === "success" ? "text-jade-light" : "text-crimson-light"}`}
            >
              {saveMessage.text}
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <GlowButton variant="jade" size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? "Saving..." : "✓ Save"}
              </GlowButton>
              <GlowButton variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                ✕ Cancel
              </GlowButton>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEditModeToggle}
              className="text-xs px-3 py-1 rounded border border-jade-glow/40 text-jade-light hover:bg-jade-deep/10 transition-all"
            >
              ✎ Edit
            </motion.button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <table className={`text-xs border-collapse w-full`} style={{ whiteSpace: "nowrap", minWidth: effectiveCompact ? "450px" : (isEditMode ? "720px" : "650px") }}>
          <thead>
            <tr className="border-b-2 border-mountain-blue-glow/50 bg-ink-mid/40 text-mist-light">
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Date</th>
              <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}>Lvl</th>
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Exercise</th>
              {holdFields.map((field) => (
                <th
                  key={field.key}
                  className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center ${field.type === 'hold' ? 'font-bold' : 'font-semibold'} uppercase tracking-wider text-[11px]`}
                  style={columnColors ? { color: field.type === 'hold' ? '#5eb8e8' : 'var(--col-reps)' } : undefined}
                >
                  {field.label}
                </th>
              ))}
              {anyModifier && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-amber-400`}>Mod</th>
              )}
              {anyVariant && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-purple-400`}>Variant</th>
              )}
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Notes</th>
              {isEditMode && <th className="px-1 py-2 text-center font-semibold text-mist-glow text-[11px] align-middle">⋮</th>}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {entries.map((entry, i) => {
                const ex = exerciseLookup.get(entry.exerciseId);
                const tier = ex?.tiers.find(t => t.level === entry.level);
                const tierDifficulty = ex ? getWeightedDifficulty(ex, entry.level, entry.variant, entry.modifier) : '';
                const diffColorClass = tierDifficulty ? getDifficultyColorClass(tierDifficulty) : '';
                const exerciseGlow = tierDifficulty ? getDifficultyGlowStyleScaled(tierDifficulty, glowIntensity) : {};
                const entryDisplayName = tier
                  ? getExerciseDisplayName(tier, settings.terminologyMode)
                  : ex ? getExerciseDisplayName(ex, settings.terminologyMode) : entry.exerciseName;
                const editData = editingData[entry.logId];

                return (
                  <motion.tr
                    key={entry.logId}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ delay: i * 0.02 }}
                    className={`border-b transition-all duration-200 ${
                      isEditMode
                        ? "border-jade-glow/20 bg-jade-deep/10 hover:bg-jade-deep/15"
                        : "border-ink-light hover:bg-ink-mid/15"
                    }`}
                  >
                    <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs align-middle whitespace-nowrap`}>{formatDate(entry.date)}</td>
                    <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center align-middle`}>
                      <span className="text-[10px] text-gold" title={entry.tierName}>{entry.level}</span>
                    </td>
                    <td
                      className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} align-middle whitespace-normal cursor-pointer hover:bg-jade-deep/10 rounded transition-colors`}
                      style={{ minWidth: "120px", maxWidth: "260px", wordBreak: "break-word" }}
                      onClick={() => !isEditMode && onViewExercise(entry.exerciseId)}
                    >
                      {!showIllumination ? (
                        <span className="text-xs text-cloud-white" title={entryDisplayName}>
                          {entryDisplayName}
                        </span>
                      ) : (
                        <div
                          className="px-2 py-1 rounded border inline-flex items-center gap-1.5"
                          style={glowIntensity > 0 ? exerciseGlow as React.CSSProperties : undefined}
                          title={entryDisplayName}
                        >
                          <span className={`text-xs font-normal ${diffColorClass}`}>
                            {entryDisplayName}
                          </span>
                          {showRealm && ex && (
                            <>
                              <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${diffColorClass} border border-current/20 opacity-80`}>
                                {tierDifficulty}
                              </span>
                              {showPath && ex.type && (
                                <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getTypeColor(ex.type)} border border-current/20 opacity-70`}>
                                  {ex.type}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    {holdFields.map((field) => {
                      const value = entry[field.key as keyof typeof entry] as number | null;
                      if (isEditMode && editData) {
                        const editVal = editData[field.key as keyof typeof editData];
                        return (
                          <td key={field.key} className="px-1 py-1.5 text-center align-middle">
                            <input
                              type="number"
                              min="0"
                              max={field.type === "reps" ? "500" : "9999"}
                              value={editVal ?? ""}
                              onChange={(e) =>
                                handleEditChange(
                                  entry.logId,
                                  field.key,
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                              placeholder="—"
                              className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-cloud-white text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                            />
                          </td>
                        );
                      }
                      if (field.type === "hold") {
                        return (
                          <td key={field.key} className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-xs font-medium align-middle`} style={{ color: '#5eb8e8', ...getZeroValueStyle(value, 'hold') }}>
                            {value != null ? `${value}s` : "—"}
                          </td>
                        );
                      }
                      return (
                        <td key={field.key} className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-cloud-white text-xs align-middle`} style={getZeroValueStyle(value, 'reps')}>
                          {displayVal(value)}
                        </td>
                      );
                    })}
                    {anyModifier && (
                      isEditMode && editData ? (
                        <td className="px-1 py-1.5 text-center align-middle">
                          <input
                            type="text"
                            value={editData.modifier ?? ""}
                            onChange={(e) => handleEditChange(entry.logId, "modifier", e.target.value || null)}
                            placeholder="—"
                            className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-amber-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                          />
                        </td>
                      ) : (
                        <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-amber-400 text-xs truncate max-w-[80px] align-middle`} title={entry.modifier || ""}>
                          {entry.modifier || "—"}
                        </td>
                      )
                    )}
                    {isEditMode && editData ? (
                      <td className="px-1 py-1.5 text-center align-middle">
                        <input
                          type="text"
                          value={editData.variant ?? ""}
                          onChange={(e) => handleEditChange(entry.logId, "variant", e.target.value || null)}
                          placeholder="—"
                          className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-purple-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                        />
                      </td>
                    ) : (
                      <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-purple-400 text-xs truncate max-w-[80px] align-middle`} title={entry.variant || ""}>
                        {entry.variant || "—"}
                      </td>
                    )}
                    {isEditMode && editData ? (
                      <td className="px-1.5 py-1.5 align-middle">
                        <input
                          type="text"
                          value={editData.notes ?? ""}
                          onChange={(e) => handleEditChange(entry.logId, "notes", e.target.value || null)}
                          placeholder="Add notes..."
                          className="w-full min-w-[100px] bg-ink-deep border border-jade-glow/30 rounded px-2 py-1 text-cloud-white text-xs placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                        />
                      </td>
                    ) : (
                      <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs truncate max-w-[180px] align-middle`} title={entry.notes || ""}>
                        {entry.notes || "—"}
                        {entry.completed && <span className="text-jade-glow ml-1">✦</span>}
                      </td>
                    )}
                    {isEditMode && (
                      <td className="px-1 py-1.5 text-center align-middle">
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setDeleteConfirm({ logId: entry.logId, exerciseName: entryDisplayName })}
                          className="text-crimson-light hover:text-crimson-glow transition-colors text-lg"
                          title="Delete this log record"
                          disabled={isDeleting}
                        >
                          ✕
                        </motion.button>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </GlowCard>

    {/* Delete Confirmation Modal */}
    <AnimatePresence>
      {deleteConfirm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setDeleteConfirm(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] max-w-[90vw] bg-ink-deep border border-ink-light rounded-xl shadow-2xl p-5"
            style={{ boxShadow: "0 0 30px rgba(200, 50, 50, 0.15), 0 20px 40px rgba(0,0,0,0.4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-crimson-light mb-3">Delete Training Record</h3>
            <p className="text-xs text-mist-light mb-5 leading-relaxed">
              Are you sure you want to permanently delete the log record for{" "}
              <span className="text-cloud-white font-medium">{deleteConfirm.exerciseName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDeleteLog(deleteConfirm.logId)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-crimson-deep/30 border border-crimson/50 text-crimson-light hover:bg-crimson-deep/50 transition-all duration-200 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Record"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border border-ink-light text-mist-light hover:bg-ink-mid/30 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

// ── Inline Log Form (appears above table for selected exercises) ──

function InlineLogForm({
  exercise,
  selectedLevel,
  onSubmit,
  onChangeLevel,
  onDismiss,
  onViewDetail,
}: {
  exercise: ProgressionExercise;
  selectedLevel: number;
  onSubmit: (exerciseId: string, level: number, data: {
    weight1?: number; reps1?: number;
    weight2?: number; reps2?: number;
    weight3?: number; reps3?: number;
    holdTime?: number; holdTime2?: number; holdTime3?: number; modifier?: string; variant?: string; notes?: string;
  }) => Promise<void>;
  onChangeLevel: (exerciseId: string, level: number) => void;
  onDismiss: (exerciseId: string) => void;
  onViewDetail: (exerciseId: string) => void;
}) {
  const [w1, setW1] = useState("");
  const [r1, setR1] = useState("");
  const [w2, setW2] = useState("");
  const [r2, setR2] = useState("");
  const [w3, setW3] = useState("");
  const [r3, setR3] = useState("");
  const [hold, setHold] = useState("");
  const [hold2, setHold2] = useState("");
  const [hold3, setHold3] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedModifier, setSelectedModifier] = useState("");
  const [selectedVariation, setSelectedVariation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [inputMode, setInputMode] = useState<"weight" | "hold">("weight");
  const showHold = inputMode === "hold";
  const { settings } = useDisplaySettings();

  const mode = settings.progressionCardMode ?? "name-illumination-realm-path";
  const cardStyle = settings.progressionCardStyle ?? "default";
  const isCompact = settings.progressionCardCompact ?? false;
  const glowIntensity = settings.glowIntensityProgressionCards ?? 100;
  const loreVisible = settings.progressionCardLoreVisible ?? true;

  const showIllumination = mode !== "name-only";
  const showRealm = mode === "name-illumination-realm" || mode === "name-illumination-realm-path";
  const showPath = mode === "name-illumination-realm-path";
  const isScrollStyle = cardStyle === "scroll-card";

  const diffColorClass = getDifficultyColorClass(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, selectedModifier || undefined));
  const glowStyle = getDifficultyGlowStyleScaled(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, selectedModifier || undefined), glowIntensity);
  const currentDifficulty = getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, selectedModifier || undefined);
  const displayName = getExerciseDisplayName(exercise, settings.terminologyMode);
  const typeEmoji = exercise.type === "Upper Heaven" ? "☁️"
    : exercise.type === "Lower Realms" ? "🔥"
    : exercise.type === "Heart Meridian" ? "💚"
    : "⭐";

  const handleSubmit = async () => {
    const primaryMissing = showHold ? (!hold && !r1) : (!w1 && !r1);
    if (primaryMissing) {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }
    const hasData = w1 || r1 || w2 || r2 || w3 || r3 || hold || hold2 || hold3 || notes || selectedModifier || selectedVariation;
    if (!hasData) return;
    setSubmitting(true);
    setSaved(false);
    try {
      await onSubmit(exercise.id, selectedLevel, {
        weight1: w1 ? parseFloat(w1) : undefined,
        reps1: r1 ? parseInt(r1) : undefined,
        weight2: w2 ? parseFloat(w2) : undefined,
        reps2: r2 ? parseInt(r2) : undefined,
        weight3: w3 ? parseFloat(w3) : undefined,
        reps3: r3 ? parseInt(r3) : undefined,
        holdTime: hold ? parseInt(hold) : undefined,
        holdTime2: hold2 ? parseInt(hold2) : undefined,
        holdTime3: hold3 ? parseInt(hold3) : undefined,
        modifier: selectedModifier || undefined,
        variant: selectedVariation || undefined,
        notes: notes || undefined,
      });
      setW1(""); setR1(""); setW2(""); setR2(""); setW3(""); setR3(""); setHold(""); setHold2(""); setHold3(""); setNotes(""); setSelectedModifier(""); setSelectedVariation("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const tierName = getTierName(exercise, selectedLevel);
  const diffStyle = getDifficultyStyle(currentDifficulty);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`relative rounded-xl border-2 overflow-hidden ${isCompact ? 'p-2' : 'p-3'}`}
        style={{
          background: 'var(--ink-deep)',
          borderColor: `${diffStyle.glowColor}90`,
          boxShadow: `0 0 28px ${diffStyle.glowColor}70, 0 0 56px ${diffStyle.glowColor}35, inset 0 0 28px ${diffStyle.glowColor}20, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Difficulty accent stripe */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
          style={{ background: `linear-gradient(to bottom, ${diffStyle.glowColor}, ${diffStyle.glowColor}40)` }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-2.5 pl-2">
          <div className="flex items-center gap-2 min-w-0">
            {isScrollStyle && (
              <span className="text-sm opacity-80 shrink-0">{typeEmoji}</span>
            )}
            <h4
              className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold truncate`}
              style={{ color: diffStyle.glowColor }}
            >
              {displayName}
            </h4>
            <span
              className="text-[9px] font-bold px-1.5 py-[1px] rounded shrink-0"
              style={{
                color: diffStyle.glowColor,
                background: `${diffStyle.glowColor}15`,
                border: `1px solid ${diffStyle.glowColor}30`,
              }}
            >
              {currentDifficulty}
            </span>
            {showPath && exercise.type && (
              <span className={`text-[9px] font-medium px-1.5 py-0 rounded-full ${getTypeColor(exercise.type)} bg-ink-dark/40 border border-current/15 shrink-0`}>
                {exercise.type}
              </span>
            )}
            {showPath && <EquipmentBadges exercise={exercise} />}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onViewDetail(exercise.id)}
              className="text-mist-dark/60 hover:text-cloud-white transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-ink-mid/30"
              title="View full progression details"
            >
              ⓘ
            </button>
            <button
              onClick={() => onDismiss(exercise.id)}
              className="text-mist-dark/60 hover:text-crimson-light transition-colors text-sm px-1.5 py-0.5 rounded hover:bg-crimson-deep/10"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Lore text */}
        {loreVisible && showPath && exercise.story && !isCompact && (
          <p className="text-[10px] text-mist-mid/70 leading-relaxed line-clamp-2 mb-2.5 pl-2">
            {exercise.story}
          </p>
        )}

        {/* Controls row: Level + Mode + Modifiers */}
        <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
          {/* Level selector */}
          <select
            value={selectedLevel}
            onChange={(e) => onChangeLevel(exercise.id, Number(e.target.value))}
            className="bg-ink-dark border rounded px-2 py-1 text-xs outline-none transition-colors cursor-pointer"
            style={{
              borderColor: `${diffStyle.glowColor}30`,
              color: diffStyle.glowColor,
            }}
          >
            {exercise.tiers.map((t) => {
              const logs = exercise.userProgress[0]?.logs ?? [];
              const count = logs.filter((l) =>
                l.level === t.level
                && (!selectedModifier || l.modifier === selectedModifier)
                && (!selectedVariation || l.variant === selectedVariation)
                && (showHold
                  ? (l.holdTime != null || l.holdTime2 != null || l.holdTime3 != null)
                  : (l.weight1 != null || l.weight2 != null || l.weight3 != null))
              ).length;
              return (
                <option key={t.level} value={t.level}>
                  Lv.{t.level} — {t.name} ({count})
                </option>
              );
            })}
          </select>

          {/* Tier name */}
          <span className="text-[10px] text-mist-dark/70 truncate hidden sm:inline">{tierName}</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Mode toggle */}
          <div className="flex rounded-md overflow-hidden border border-ink-light/30">
            <button
              onClick={() => { setInputMode("weight"); setW1(""); setW2(""); setW3(""); setR1(""); setR2(""); setR3(""); setHold(""); setHold2(""); setHold3(""); }}
              className={`px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 border-r ${
                inputMode === "weight"
                  ? "bg-jade-deep/40 text-jade-light border-jade/20"
                  : "bg-ink-dark/60 text-mist-dark/60 border-ink-light/20 hover:text-mist-light"
              }`}
            >
              Weight
            </button>
            <button
              onClick={() => { setInputMode("hold"); setW1(""); setW2(""); setW3(""); setR1(""); setR2(""); setR3(""); setHold(""); setHold2(""); setHold3(""); }}
              className={`px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 ${
                inputMode === "hold"
                  ? "bg-mountain-blue/20 text-mountain-blue-glow"
                  : "bg-ink-dark/60 text-mist-dark/60 hover:text-mist-light"
              }`}
            >
              Hold
            </button>
          </div>
        </div>

        {/* Optional modifiers row */}
        {((exercise.modifiers && exercise.modifiers.length > 0) || (exercise.variations && exercise.variations.length > 0)) && (
          <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
            {exercise.modifiers && exercise.modifiers.length > 0 && (
              <select
                value={selectedModifier}
                onChange={(e) => setSelectedModifier(e.target.value)}
                className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-gold outline-none
                           focus:border-gold/40 transition-colors cursor-pointer"
              >
                <option value="">No modifier</option>
                {exercise.modifiers.filter(m => m.available).map((m) => (
                  <option key={m.id} value={m.type}>
                    {m.type}{m.difficultyMod !== 0 ? ` (${m.difficultyMod > 0 ? "+" : ""}${m.difficultyMod})` : ""}
                  </option>
                ))}
              </select>
            )}
            {exercise.variations && exercise.variations.length > 0 && (
              <select
                value={selectedVariation}
                onChange={(e) => setSelectedVariation(e.target.value)}
                className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-crimson-light outline-none
                           focus:border-crimson/40 transition-colors cursor-pointer"
              >
                <option value="">No variation</option>
                {exercise.variations.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Input grid */}
        <div className="pl-2">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, 1fr) 1.5fr" }}>
            {/* Column headers */}
            {!showHold ? (
              <>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-weight)', opacity: 0.7 }}>W1</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.7 }}>R1</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-weight)', opacity: 0.7 }}>W2</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.7 }}>R2</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-weight)', opacity: 0.7 }}>W3</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.7 }}>R3</div>
              </>
            ) : (
              <>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold text-mountain-blue-glow/70 pb-0.5">H1</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.7 }}>R1</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold text-mountain-blue-glow/70 pb-0.5">H2</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.7 }}>R2</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold text-mountain-blue-glow/70 pb-0.5">H3</div>
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.7 }}>R3</div>
              </>
            )}
            <div className="text-[9px] text-center uppercase tracking-widest font-semibold text-mist-dark/50 pb-0.5">Notes</div>

            {/* Input fields */}
            {!showHold ? (
              <>
                <input type="number" min="0" step="0.5" value={w1} onChange={(e) => { setW1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                  className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-jade-light placeholder:text-mist-dark/30 focus:border-jade-glow/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                  style={{ borderColor: shakeError ? 'rgba(220,50,50,0.7)' : 'rgba(58,143,143,0.15)' }} />
                <input type="number" min="0" max="500" value={r1} onChange={(e) => { setR1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                  className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-gold placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                  style={{ borderColor: shakeError ? 'rgba(220,50,50,0.7)' : 'rgba(196,168,74,0.15)' }} />
                <input type="number" min="0" step="0.5" value={w2} onChange={(e) => setW2(e.target.value)} placeholder="—"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-jade-light placeholder:text-mist-dark/30 focus:border-jade-glow/50 focus:bg-ink-mid/40"
                  style={{ borderColor: 'rgba(58,143,143,0.15)' }} />
                <input type="number" min="0" max="500" value={r2} onChange={(e) => setR2(e.target.value)} placeholder="—"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-gold placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                  style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
                <input type="number" min="0" step="0.5" value={w3} onChange={(e) => setW3(e.target.value)} placeholder="—"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-jade-light placeholder:text-mist-dark/30 focus:border-jade-glow/50 focus:bg-ink-mid/40"
                  style={{ borderColor: 'rgba(58,143,143,0.15)' }} />
                <input type="number" min="0" max="500" value={r3} onChange={(e) => setR3(e.target.value)} placeholder="—"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-gold placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                  style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
              </>
            ) : (
              <>
                <input type="number" min="0" value={hold} onChange={(e) => { setHold(e.target.value); if (shakeError) setShakeError(false); }} placeholder="sec"
                  className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-mountain-blue/20 text-mountain-blue-glow placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                  style={shakeError ? { borderColor: 'rgba(220,50,50,0.7)' } : undefined} />
                <input type="number" min="0" max="500" value={r1} onChange={(e) => { setR1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                  className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-gold placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                  style={{ borderColor: shakeError ? 'rgba(220,50,50,0.7)' : 'rgba(196,168,74,0.15)' }} />
                <input type="number" min="0" value={hold2} onChange={(e) => setHold2(e.target.value)} placeholder="sec"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-mountain-blue/20 text-mountain-blue-glow placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40" />
                <input type="number" min="0" max="500" value={r2} onChange={(e) => setR2(e.target.value)} placeholder="—"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-gold placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                  style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
                <input type="number" min="0" value={hold3} onChange={(e) => setHold3(e.target.value)} placeholder="sec"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-mountain-blue/20 text-mountain-blue-glow placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40" />
                <input type="number" min="0" max="500" value={r3} onChange={(e) => setR3(e.target.value)} placeholder="—"
                  className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-gold placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                  style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
              </>
            )}
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..."
              className="w-full rounded-md px-1.5 py-1.5 text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/20 text-cloud-white placeholder:text-mist-dark/40 focus:border-mist-mid/30 focus:bg-ink-mid/30" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-end gap-2 pl-2">
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs font-medium"
              style={{ color: diffStyle.glowColor }}
            >
              ✦ Saved
            </motion.span>
          )}
          <motion.button
            onClick={handleSubmit}
            disabled={submitting}
            animate={saved ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            whileHover={!submitting ? { scale: 1.06, boxShadow: `0 0 10px ${diffStyle.glowColor}50` } : {}}
            whileTap={!submitting ? { scale: 0.96 } : {}}
            transition={{ duration: 0.3 }}
            className="px-4 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40 cursor-pointer"
            style={{
              background: saved ? `${diffStyle.glowColor}30` : `${diffStyle.glowColor}18`,
              border: `1px solid ${saved ? `${diffStyle.glowColor}60` : `${diffStyle.glowColor}35`}`,
              color: diffStyle.glowColor,
              transition: 'background 0.3s, border-color 0.3s',
            }}
          >
            {submitting ? "Saving…" : saved ? "✦ Logged!" : "Log Set"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Sidebar with exercise list, search, filters ──

function ProgressionSidebar({
  exercises,
  selectedIds,
  onToggleExercise,
  onSelectWithLevel,
  searchTerm,
  onSearch,
  filterCategory,
  setFilterCategory,
  filterType,
  setFilterType,
  filterEquipment,
  setFilterEquipment,
  categories,
  types,
  equipmentTypes,
  levelDefaults,
  selectedDayFilter,
  setSelectedDayFilter,
  onDrawerOpen,
}: {
  exercises: ProgressionExercise[];
  selectedIds: Set<string>;
  onToggleExercise: (id: string) => void;
  onSelectWithLevel: (exerciseId: string, level: number) => void;
  searchTerm: string;
  onSearch: (term: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterEquipment: string;
  setFilterEquipment: (v: string) => void;
  categories: string[];
  types: string[];
  equipmentTypes: string[];
  levelDefaults: Record<string, number>;
  selectedDayFilter: number | null;
  setSelectedDayFilter: (v: number | null) => void;
  onDrawerOpen: () => void;
}) {
  const { settings, updateSettings } = useDisplaySettings();
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("cultivateos-progression-sidebar-compact") === "true"; } catch { return false; }
  });

  // Persist compact state
  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-compact", String(isCompact)); } catch {}
  }, [isCompact]);

  const [sortMode, setSortMode] = useState<string>(() => {
    if (typeof window === "undefined") return "a-z";
    try { return localStorage.getItem("cultivateos-progression-sidebar-sort") || "a-z"; } catch { return "a-z"; }
  });

  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-sort", sortMode); } catch {}
  }, [sortMode]);

  const displayMode = settings.progressionSidebarMode ?? "name-illumination-realm";
  const cardStyle = settings.progressionSidebarStyle ?? "default";
  const glowIntensity = settings.glowIntensityProgressionSidebar ?? 100;
  const loreVisible = settings.progressionSidebarLoreVisible ?? true;
  const useThemeColor = settings.progressionSidebarUseThemeColor ?? true;
  const expandTiers = settings.progressionSidebarExpandTiers ?? true;

  const showIllumination = displayMode !== "name-only";
  const showRealm = displayMode === "name-illumination-realm" || displayMode === "name-illumination-realm-path";
  const showPath = displayMode === "name-illumination-realm-path";
  const isScrollStyle = cardStyle === "scroll-card";

  // Compute technique counts per day
  const dayCounts = useMemo(() => {
    const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const ex of exercises) {
      const days = parseDayAssignments(ex.assignedDays || "");
      for (const d of days) {
        if (d >= 0 && d <= 6) counts[d]++;
      }
    }
    return counts;
  }, [exercises]);

  // Apply filters
  const filtered = exercises.filter((e) => {
    // Day filter
    if (selectedDayFilter !== null) {
      if (!e.assignedDays || e.assignedDays.trim() === "") return false;
      const assignedDays = e.assignedDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
      if (!assignedDays.includes(selectedDayFilter)) return false;
    }
    if (filterCategory && e.category !== filterCategory) return false;
    if (filterType && e.type !== filterType) return false;
    if (filterEquipment) {
      const tags = getEquipmentTags(e);
      if (!tags.includes(filterEquipment)) return false;
    }
    if (searchTerm) {
      return matchesLooseSearchInFields(searchTerm, [
        e.name,
        e.wuxiaName,
      ]);
    }
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    const nameA = getExerciseDisplayName(a, settings.terminologyMode);
    const nameB = getExerciseDisplayName(b, settings.terminologyMode);
    switch (sortMode) {
      case "a-z":
        return nameA.localeCompare(nameB);
      case "z-a":
        return nameB.localeCompare(nameA);
      case "recent": {
        const aLatest = a.userProgress[0]?.logs?.reduce((max, l) => {
          const t = new Date(l.createdAt).getTime();
          return t > max ? t : max;
        }, 0) ?? 0;
        const bLatest = b.userProgress[0]?.logs?.reduce((max, l) => {
          const t = new Date(l.createdAt).getTime();
          return t > max ? t : max;
        }, 0) ?? 0;
        return bLatest - aLatest;
      }
      case "most-logged": {
        const aCount = a.userProgress[0]?.logs?.length ?? 0;
        const bCount = b.userProgress[0]?.logs?.length ?? 0;
        return bCount - aCount;
      }
      case "level-high": {
        const aLvl = levelDefaults[a.id] || (a.userProgress[0]?.currentLevel ?? 1);
        const bLvl = levelDefaults[b.id] || (b.userProgress[0]?.currentLevel ?? 1);
        return bLvl - aLvl;
      }
      case "level-low": {
        const aLvl = levelDefaults[a.id] || (a.userProgress[0]?.currentLevel ?? 1);
        const bLvl = levelDefaults[b.id] || (b.userProgress[0]?.currentLevel ?? 1);
        return aLvl - bLvl;
      }
      case "selected": {
        const aS = selectedIds.has(a.id) ? 0 : 1;
        const bS = selectedIds.has(b.id) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return nameA.localeCompare(nameB);
      }
      default:
        return 0;
    }
  });

  const [showFilters, setShowFilters] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchCollapsedIds, setSearchCollapsedIds] = useState<Set<string>>(new Set());

  const activeFiltersCount = (filterCategory ? 1 : 0) + (filterType ? 1 : 0) + (filterEquipment ? 1 : 0);
  const searchQuery = searchTerm.trim();
  const isSearchActive = searchQuery.length > 0;
  const canCollapseAll = sorted.some((exercise) => expandedIds.has(exercise.id));

  useEffect(() => {
    if (!isSearchActive) {
      setSearchCollapsedIds(new Set());
    }
  }, [isSearchActive]);

  const toggleExpand = useCallback((id: string) => {
    if (isSearchActive) {
      setSearchCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }

    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [isSearchActive]);

  const sortOptions = [
    { key: "a-z", label: "A–Z", icon: "↕" },
    { key: "z-a", label: "Z–A", icon: "↕" },
    { key: "recent", label: "Recent", icon: "◷" },
    { key: "most-logged", label: "Most Logged", icon: "▤" },
    { key: "level-high", label: "Level ↓", icon: "▾" },
    { key: "level-low", label: "Level ↑", icon: "▴" },
    { key: "selected", label: "Selected", icon: "✦" },
  ] as const;

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
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
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

        {/* Day Filter — All + Sun-Sat buttons */}
        <div className="space-y-1">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedDayFilter(null)}
              className={`
                flex-1 py-1 text-[10px] font-semibold rounded-md transition-all duration-200 border
                ${selectedDayFilter === null
                  ? 'bg-jade-deep/60 text-jade-glow border-jade-glow/40 shadow-[inset_0_0_12px_rgba(58,143,143,0.15)]'
                  : 'bg-ink-dark/60 text-mist-dark border-ink-light/40 hover:text-mist-light hover:bg-ink-mid/40'
                }
              `}
            >
              All
              <span className="ml-1 text-[9px] opacity-70">({exercises.length})</span>
            </button>
            {selectedDayFilter !== null && (
              <GlowButton
                onClick={(e) => { e.stopPropagation(); onDrawerOpen(); }}
                variant="jade"
                size="sm"
                glow
                className="!py-1 !text-[10px] shrink-0"
              >
                ⚙ Manage
              </GlowButton>
            )}
          </div>
          <div className="flex rounded-md overflow-hidden border border-ink-light/40">
            {DAY_ABBREVIATIONS.map((day, index) => {
              const count = dayCounts[index];
              const hasExercises = count > 0;
              const isSelected = selectedDayFilter === index;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDayFilter(index)}
                  className={`
                    flex-1 py-1 text-[10px] font-semibold transition-all duration-200 relative flex flex-col items-center gap-0.5
                    ${index > 0 ? 'border-l border-ink-light/30' : ''}
                    ${isSelected
                      ? 'bg-jade-deep/60 text-jade-glow shadow-[inset_0_0_12px_rgba(58,143,143,0.15)]'
                      : hasExercises
                        ? 'bg-ink-dark/60 text-jade-light/80 hover:text-jade-light hover:bg-ink-mid/40'
                        : 'bg-ink-dark/60 text-mist-dark hover:text-mist-light hover:bg-ink-mid/40'
                    }
                  `}
                >
                  <span>{day}</span>
                  {hasExercises && (
                    <span className={`text-[7px] leading-none rounded-full min-w-[12px] px-0.5 py-[1px] font-bold ${
                      isSelected
                        ? 'bg-jade-glow/30 text-jade-light'
                        : 'bg-ink-light/60 text-mist-light'
                    }`}>
                      {count}
                    </span>
                  )}
                  {isSelected && (
                    <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-jade-glow rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action bar: icons row */}
        <div className="flex items-center gap-1">
          <div className="flex-1" />

          {/* Expand / Collapse all */}
          {expandTiers && !isSearchActive && sorted.length > 0 && (
            <button
              onClick={() => setExpandedIds(new Set())}
              disabled={!canCollapseAll}
              className={`group inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border focus-visible:outline-none focus-visible:ring-2 transition-all duration-200 text-[10px] font-semibold tracking-wide ${
                canCollapseAll
                  ? 'border-jade/45 bg-jade-deep/30 text-jade-light hover:bg-jade-deep/45 hover:border-jade/65 hover:text-cloud-white focus-visible:ring-jade-glow/35 shadow-[0_0_10px_rgba(58,143,143,0.18)]'
                  : 'border-ink-light/35 bg-ink-mid/20 text-mist-dark/70 cursor-not-allowed focus-visible:ring-mist-mid/20 opacity-80'
              }`}
              title={canCollapseAll ? "Collapse all tier panels" : "No expanded tier panels"}
              aria-label="Collapse all tier panels"
            >
              <svg className={`w-3 h-3 shrink-0 transition-transform duration-200 ${canCollapseAll ? 'group-hover:translate-y-px' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10l-7 7-7-7" />
              </svg>
              Collapse
            </button>
          )}

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
          <button
            onClick={() => setIsCompact(!isCompact)}
            className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all duration-150 ${
              isCompact
                ? 'bg-jade-deep/25 border-jade/40 text-jade-glow'
                : 'border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60'
            }`}
            title={isCompact ? "Expanded view" : "Compact view"}
          >
            {isCompact ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            )}
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
              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium">Category</span>
                    {filterCategory && (
                      <button onClick={() => setFilterCategory("")} className="text-[9px] text-jade-glow/70 hover:text-jade-glow transition-colors">clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterCategory("")}
                      className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
                        !filterCategory
                          ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                          : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                        className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
                          filterCategory === cat
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipment */}
              {types.length > 0 && (
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
                    {types.map((t) => (
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
              )}

              {/* Equipment */}
              {equipmentTypes.length > 1 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium">Equipment</span>
                    {filterEquipment && (
                      <button onClick={() => setFilterEquipment("")} className="text-[9px] text-jade-glow/70 hover:text-jade-glow transition-colors">clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {equipmentTypes.map((eq) => (
                      <button
                        key={eq}
                        onClick={() => setFilterEquipment(filterEquipment === eq ? "" : eq)}
                        className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
                          filterEquipment === eq
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort */}
              <div>
                <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium block mb-1">Sort By</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="w-full bg-ink-dark/80 border border-ink-light/40 rounded-md px-2 py-1 text-[11px] text-cloud-white outline-none transition-all duration-150 focus:border-jade-glow/50 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 6px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', paddingRight: '28px' }}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
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
              {sorted.length} exercise{sorted.length !== 1 ? "s" : ""}
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[9px] text-jade-glow/80 bg-jade-deep/20 px-1.5 py-0 rounded-full border border-jade/20">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={() => { for (const id of [...selectedIds]) onToggleExercise(id); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-crimson/40 bg-crimson-deep/20 text-crimson-light hover:bg-crimson-deep/35 hover:border-crimson/60 transition-all duration-150 text-[10px] font-semibold"
              title="Unselect all"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      {/* ── Exercise list ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin">
        {sorted.length === 0 ? (
          selectedDayFilter !== null && exercises.length > 0 ? (
            /* Empty day — prompt to use Manage drawer */
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-4xl opacity-40">📋</div>
              <p className="text-xs text-mist-dark text-center">
                No exercises assigned to <span className="text-mist-light font-medium">{DAY_ABBREVIATIONS[selectedDayFilter]}</span>
              </p>
              <GlowButton
                onClick={(e) => { e.stopPropagation(); onDrawerOpen(); }}
                variant="jade"
                size="sm"
                glow
                className="!text-[11px]"
              >
                ⚙ Manage Techniques
              </GlowButton>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-2xl opacity-30 mb-2">{exercises.length === 0 ? "📂" : "🔍"}</div>
              <p className="text-[11px] text-mist-dark">
                {exercises.length === 0 ? "Upload a JSON file to add exercises" : "No exercises match current filters"}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setFilterCategory(""); setFilterType(""); setFilterEquipment(""); }}
                  className="mt-2 text-[10px] text-jade-glow/70 hover:text-jade-glow transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )
        ) : (
          <div className={`${isCompact ? 'space-y-px' : 'space-y-1'}`}>
            {sorted.map((exercise, idx) => {
              const isActive = selectedIds.has(exercise.id);
              const currentLevel = exercise.userProgress[0]?.currentLevel ?? 1;
              const effectiveLevel = levelDefaults[exercise.id] || currentLevel;
              const typeColor = getTypeColor(exercise.type);
              const displayName = getExerciseDisplayName(exercise, settings.terminologyMode);
              const typeEmoji = exercise.type === "Upper Heaven" ? "☁️"
                : exercise.type === "Lower Realms" ? "🔥"
                : exercise.type === "Heart Meridian" ? "💚"
                : "⭐";
              const levelDifficulty = getWeightedDifficulty(exercise, effectiveLevel);
              const levelDiffColor = 'text-jade-glow';
              const glowStyle = {};
              const logCount = exercise.userProgress[0]?.logs?.length ?? 0;
              const isExpanded = expandTiers && (isSearchActive
                ? !searchCollapsedIds.has(exercise.id)
                : expandedIds.has(exercise.id));
              const isSearchMatch = isSearchActive && matchesLooseSearchInFields(searchQuery, [
                exercise.name,
                exercise.wuxiaName,
              ]);

              // Shared select/add button
              const selectButton = (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExercise(exercise.id); }}
                  className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all duration-150 ${
                    isActive
                      ? 'bg-jade-glow/20 border-jade/50 text-jade-glow hover:bg-crimson-deep/20 hover:border-crimson/40 hover:text-crimson-light'
                      : 'border-ink-light/40 text-mist-dark hover:bg-jade-deep/20 hover:border-jade/40 hover:text-jade-glow'
                  }`}
                  title={isActive ? "Remove from training" : "Add to training"}
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    {isActive
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    }
                  </svg>
                </button>
              );

              // Shared tier expansion panel
              const tierPanel = isExpanded && exercise.tiers.length > 0 ? (
                <AnimatePresence initial={false}>
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1.5 mt-1.5 border-t border-ink-light/20 space-y-0.5">
                      {exercise.tiers.map((tier) => {
                        const isCurrent = tier.level === effectiveLevel;
                        const isActiveTier = isActive && isCurrent;
                        return (
                          <div
                            key={tier.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isActive && isCurrent) {
                                // clicking the already-active tier → remove exercise
                                onToggleExercise(exercise.id);
                              } else {
                                // clicking any other tier → add (or switch level)
                                onSelectWithLevel(exercise.id, tier.level);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-1.5 py-[3px] rounded text-[10px] transition-colors cursor-pointer ${
                              isActiveTier ? 'bg-jade-deep/25 hover:bg-crimson-deep/20' : isCurrent ? 'bg-jade-deep/15 hover:bg-jade-deep/25' : 'hover:bg-jade-deep/10'
                            }`}
                          >
                            <span className={`font-mono w-4 text-center shrink-0 ${isCurrent ? 'text-gold font-bold' : 'text-mist-dark/60'}`}>
                              {tier.level}
                            </span>
                            <span className={`truncate flex-1 ${isActiveTier ? 'text-jade-light font-semibold' : 'text-jade-glow'} ${isCurrent ? 'font-medium' : 'opacity-70'}`} title={tier.wuxiaName || tier.name}>
                              {settings.terminologyMode === "fantasy" && tier.wuxiaName ? tier.wuxiaName : tier.name}
                            </span>
                            {isActiveTier ? (
                              <span className="shrink-0 text-[8px] text-crimson-light/70" title="Click to remove">✕</span>
                            ) : isCurrent ? (
                              <span className="shrink-0 text-[8px] text-gold/80">◆</span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : null;

              // Chevron indicator (only in expand-tiers mode)
              const chevron = expandTiers && exercise.tiers.length > 0 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(exercise.id); }}
                  className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-glow/30 ${
                    isExpanded
                      ? 'border-jade/40 bg-jade-deep/20 text-jade-light hover:border-jade/60 hover:bg-jade-deep/30'
                      : 'border-ink-light/40 bg-ink-dark/35 text-mist-dark hover:text-mist-light hover:border-ink-light/70 hover:bg-ink-mid/30'
                  }`}
                  title={isExpanded ? "Collapse tiers" : "Expand tiers"}
                  aria-label={isExpanded ? "Collapse tiers" : "Expand tiers"}
                >
                  <svg className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : null;

              // Row click handler: expand/collapse tiers when expandTiers is on, otherwise toggle selection
              const handleRowClick = expandTiers
                ? () => toggleExpand(exercise.id)
                : () => onToggleExercise(exercise.id);

              /* ═══ Compact mode ═══ */
              if (isCompact) {
                return (
                  <div key={exercise.id}>
                    <div
                      className={`
                        relative flex items-center gap-1.5 px-2.5 py-[5px] rounded-md cursor-pointer transition-all duration-150
                        group border
                        ${isActive
                          ? 'bg-jade-deep/20 border-jade/30'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/15'
                            : 'bg-ink-dark/40 border-ink-light/50 hover:bg-ink-mid/20 hover:border-ink-light/70'
                        }
                      `}
                      style={showIllumination && isActive ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      {chevron}
                      {/* Selection indicator */}
                      <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-ink-light/40'}`} />
                      <span className={`text-[11px] truncate flex-1 ${showIllumination ? levelDiffColor : isActive ? 'text-cloud-white' : 'text-mist-light'}`} title={displayName}>
                        {displayName}
                      </span>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className="text-[9px] text-gold/80 shrink-0 font-mono">Lv.{effectiveLevel}</span>
                      <span className={`shrink-0 text-[8px] font-medium px-1 py-0 rounded ${!expandTiers ? levelDiffColor : levelDiffColor + ' opacity-70'}`}>
                        {!expandTiers ? levelDifficulty : levelDifficulty.split(" ").map(w => w[0]).join("")}
                      </span>
                    </div>
                    {expandTiers && tierPanel}
                  </div>
                );
              }

              /* ═══ Scroll-Card Style (expanded) ═══ */
              if (isScrollStyle) {
                return (
                  <motion.div
                    key={exercise.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.015, duration: 0.2 }}
                  >
                    <div
                      className={`
                        relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                        ${isActive
                          ? 'bg-jade-deep/15 border-jade/30 shadow-[0_0_10px_rgba(58,143,143,0.1)]'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_12px_rgba(58,143,143,0.14)] hover:bg-jade-deep/15'
                            : 'bg-ink-dark/40 border-ink-light/50 hover:border-ink-light/70 hover:bg-ink-mid/15'
                        }
                      `}
                      style={showIllumination && glowIntensity > 0 ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-jade-glow" />
                      )}

                      <div className="flex items-start gap-2">
                        <span className="text-base pt-0.5 opacity-70 shrink-0">{typeEmoji}</span>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {chevron}
                            <h3 className={`text-[11px] font-medium ${showIllumination ? levelDiffColor : 'text-cloud-white'} truncate flex-1 leading-snug`} title={displayName}>
                              {displayName}
                            </h3>
                            <span className="text-[9px] text-gold/70 shrink-0 font-mono">Lv.{effectiveLevel}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className={`text-[8px] font-medium px-1.5 py-0 rounded ${levelDiffColor} bg-ink-dark/50 border border-current/20`}>
                              {levelDifficulty}
                            </span>
                            {showPath && (
                              <span className={`text-[8px] px-1.5 py-0 rounded ${typeColor} bg-ink-dark/30 border border-current/15 opacity-70`}>
                                {exercise.type}
                              </span>
                            )}
                            <EquipmentBadges exercise={exercise} />
                            {logCount > 0 && (
                              <span className="text-[8px] text-mist-dark/60 font-mono">{logCount} log{logCount !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {showRealm && exercise.category && (
                            <span className="text-[9px] text-mist-dark/60 mt-0.5">{exercise.category}</span>
                          )}
                          {loreVisible && showPath && exercise.story && (
                            <p className="mt-1 text-[9px] text-mist-mid/70 leading-relaxed line-clamp-2">
                              {exercise.story}
                            </p>
                          )}
                          {expandTiers && tierPanel}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              /* ═══ Default Style (expanded) ═══ */
              return (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.015, duration: 0.2 }}
                >
                  <div
                    className={`
                      relative p-2 rounded-lg border cursor-pointer transition-all duration-200 group
                      ${isActive
                        ? 'bg-jade-deep/15 border-jade/30'
                        : isSearchMatch
                          ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_12px_rgba(58,143,143,0.14)] hover:bg-jade-deep/15'
                          : 'bg-ink-dark/40 border-ink-light/50 hover:border-ink-light/70 hover:bg-ink-mid/15'
                      }
                    `}
                    style={showIllumination ? glowStyle as React.CSSProperties : undefined}
                    onClick={handleRowClick}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-jade-glow" />
                    )}

                    <div className="flex items-center gap-1.5 pl-1">
                      {chevron}
                      <div className={`text-[11px] font-medium ${showIllumination ? levelDiffColor : isActive ? 'text-cloud-white' : 'text-mist-light'} transition-colors duration-150 truncate flex-1`} title={displayName}>
                        {displayName}
                      </div>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/60 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className="text-[9px] text-gold/70 shrink-0 font-mono">Lv.{effectiveLevel}</span>
                      <span className={`shrink-0 text-[8px] font-medium px-1.5 py-0 rounded ${levelDiffColor} bg-ink-dark/30 border border-current/15`}>
                        {levelDifficulty}
                      </span>
                    </div>
                    {(showRealm || showPath) && (
                      <div className="flex items-center gap-1 mt-0.5 pl-1 flex-wrap">
                        {showPath && (
                          <span className={`inline-flex items-center px-1.5 py-0 rounded text-[8px] ${typeColor} opacity-60`}>
                            {exercise.type}
                          </span>
                        )}
                        <EquipmentBadges exercise={exercise} />
                        {showRealm && exercise.category && (
                          <span className="text-[8px] text-mist-dark/50">{exercise.category}</span>
                        )}
                      </div>
                    )}
                    {loreVisible && showPath && exercise.story && (
                      <p className="text-[9px] text-mist-mid/60 leading-relaxed line-clamp-2 mt-0.5 pl-1">
                        {exercise.story}
                      </p>
                    )}
                    {expandTiers && tierPanel}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cultivation Color Guide ──

const GUIDE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Mortal": { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30" },
  "Foundation Establishment": { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  "Core Formation": { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  "Nascent Soul": { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
  "Soul Splitting": { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30" },
  "Tribulation Transcendence": { bg: "bg-yellow-400/15", text: "text-yellow-300", border: "border-yellow-400/30" },
  "Immortal": { bg: "bg-pink-300/15", text: "text-pink-300", border: "border-pink-300/30" },
  "Heavenly Dao": { bg: "bg-cyan-300/15", text: "text-cyan-300", border: "border-cyan-300/30" },
};

function CultivationColorGuide({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Cultivation Color System">
      <div className="space-y-5 text-xs">
        {/* Intro */}
        <p className="text-mist-mid leading-relaxed text-sm">
          Each training log entry glows with a colour representing its <span className="text-cloud-white font-medium">cultivation rank</span> — computed from three weighted factors.
        </p>

        {/* Color Scale */}
        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">The Eight Ranks</h4>
          <div className="flex rounded-lg overflow-hidden border border-ink-light">
            {DIFFICULTY_SCALE.map((d) => {
              const c = GUIDE_COLORS[d];
              return (
                <div key={d} className={`flex-1 py-2 px-0.5 text-center ${c.bg}`}>
                  <div className={`text-[9px] font-bold ${c.text} leading-tight`}>
                    {d.split(" ").map((w, i) => <span key={i} className="block">{w}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[9px] text-green-400/70">← Easiest</span>
            <span className="text-[9px] text-cyan-300/70">Hardest →</span>
          </div>
        </div>

        {/* Scoring Breakdown */}
        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">How Colour Is Determined</h4>
          <p className="text-mist-mid mb-3 leading-relaxed">
            A weighted score from <span className="text-cloud-white">0.0</span> to <span className="text-cloud-white">1.0</span> is computed, then mapped to the rank scale above.
          </p>

          <div className="space-y-2.5">
            {/* Level Factor */}
            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">📊</span> Tier Level
                </span>
                <span className="text-jade-glow font-bold text-[11px] bg-jade-deep/20 px-2 py-0.5 rounded-full">Base Score</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Your tier position within the exercise determines the <span className="text-cloud-white">base colour</span>.
                The lowest tier = <span className="text-green-400">0.0</span> (Mortal), the highest = <span className="text-cyan-300">1.0</span> (Heavenly Dao).
                Tiers in between are spaced evenly across the scale.
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">score = tierIndex / (totalTiers − 1)</span>
              </div>
            </div>

            {/* Variation Factor */}
            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">🔀</span> Variation
                </span>
                <span className="text-purple-400 font-bold text-[11px] bg-purple-500/15 px-2 py-0.5 rounded-full">±0.15 shift</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Selecting a variation shifts the score based on its <span className="text-purple-400">difficulty rank</span>.
                A <span className="text-green-400">Mortal</span>-difficulty variation shifts down (−0.15), while a <span className="text-cyan-300">Heavenly Dao</span>-grade one shifts up (+0.15).
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">shift = (variationRank / 6 − 0.5) × 0.30</span>
              </div>
            </div>

            {/* Modifier Factor */}
            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">⚡</span> Modifier
                </span>
                <span className="text-amber-400 font-bold text-[11px] bg-amber-500/15 px-2 py-0.5 rounded-full">±0.15 shift</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Modifiers with a positive <span className="text-amber-400">difficulty mod</span> push the score upward, while negative ones pull it down.
                The shift is proportional to the modifier value (capped at ±3).
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">shift = clamp(diffMod / 3, −1, 1) × 0.15</span>
              </div>
            </div>
          </div>
        </div>

        {/* Final Formula */}
        <div className="rounded-lg border border-jade-glow/30 bg-jade-deep/10 p-3 space-y-2">
          <h4 className="text-[11px] text-jade-glow uppercase tracking-wider font-semibold">Final Computation</h4>
          <div className="bg-ink-mid/40 rounded px-3 py-2 text-center">
            <span className="text-[11px] font-mono text-cloud-white">
              finalScore = <span className="text-jade-glow">base</span> + <span className="text-purple-400">variationShift</span> + <span className="text-amber-400">modifierShift</span>
            </span>
          </div>
          <p className="text-mist-mid leading-relaxed">
            The result is clamped to <span className="text-cloud-white">0.0 – 1.0</span> and mapped to the nearest cultivation rank.
            Without a variation or modifier, the colour is determined purely by tier level.
          </p>
        </div>

        {/* Examples */}
        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">Examples</h4>
          <div className="space-y-1.5">
            {([
              { desc: "Lowest tier, no modifiers", score: "0.00", rank: "Mortal" },
              { desc: "Mid tier, no modifiers", score: "0.50", rank: "Nascent Soul" },
              { desc: "Mid tier + hard variation", score: "0.65", rank: "Soul Splitting" },
              { desc: "Mid tier + hard variation + weighted (+2)", score: "0.75", rank: "Tribulation Transcendence" },
              { desc: "Highest tier, no modifiers", score: "1.00", rank: "Heavenly Dao" },
            ] as const).map((ex) => {
              const c = GUIDE_COLORS[ex.rank];
              return (
                <div key={ex.desc} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${c.bg} border ${c.border} shrink-0`} />
                  <span className="text-mist-mid flex-1">{ex.desc}</span>
                  <span className="text-mist-dark font-mono">{ex.score}</span>
                  <span className={`${c.text} font-semibold text-[10px] min-w-[80px] text-right`}>{ex.rank}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GlowModal>
  );
}

// ── Empty State ──

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="text-6xl mb-6 opacity-40">🏛️</div>
      <h2 className="text-xl text-cloud-white mb-2">No Progressions Yet</h2>
      <p className="text-sm text-mist-mid max-w-md mb-6">
        Upload a JSON file in the <span className="text-jade-glow font-medium">Technique Scroll</span> page to populate your progression exercises.
      </p>
    </motion.div>
  );
}

// ── Main Page ──

export default function ProgressionPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [detailExercise, setDetailExercise] = useState<ProgressionExercise | null>(null);
  const [levelDefaults, setLevelDefaults] = useState<Record<string, number>>({});
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [showColorGuide, setShowColorGuide] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [exerciseOrder, setExerciseOrder] = useState<string[]>([]);

  const userId = user?.id;

  // ── Persist level defaults in localStorage ──
  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(`progression-levels-${userId}`);
    if (stored) {
      try { setLevelDefaults(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [userId]);

  const updateLevelDefault = useCallback((exerciseId: string, level: number) => {
    setLevelDefaults((prev) => {
      const next = { ...prev, [exerciseId]: level };
      if (userId) localStorage.setItem(`progression-levels-${userId}`, JSON.stringify(next));
      return next;
    });
  }, [userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/progressions?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.exercises) setExercises(data.exercises);
    } catch (err) {
      console.error("Failed to fetch progressions:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // Listen for uploads from exercises page
  useEffect(() => {
    const handler = () => fetchExercises();
    window.addEventListener("progression-exercises-updated", handler);
    return () => window.removeEventListener("progression-exercises-updated", handler);
  }, [fetchExercises]);

  // ── Toggle exercise selection ──
  const toggleExercise = useCallback((id: string) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const dismissExercise = useCallback((id: string) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ── Day assignment management (for TechniqueManagementDrawer) ──
  const handleUpdateDayAssignments = useCallback(async (exerciseId: string, assignedDays: string) => {
    if (!userId) return;
    const dayIndices = assignedDays ? assignedDays.split(',').map(d => parseInt(d)).filter(d => !isNaN(d)) : [];
    const response = await fetch(`/api/progressions/${exerciseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, assignedDays: dayIndices }),
    });
    if (response.ok) {
      const { exercise } = await response.json();
      setExercises(prev => prev.map(ex =>
        ex.id === exerciseId ? { ...ex, assignedDays: exercise.assignedDays } : ex
      ));
    } else {
      throw new Error("Failed to update day assignments");
    }
  }, [userId]);

  const handleReorderExercises = useCallback((orderedIds: string[]) => {
    setExerciseOrder(orderedIds);
    if (userId) {
      localStorage.setItem(`cultivateos-progression-order-${userId}`, JSON.stringify(orderedIds));
    }
  }, [userId]);

  // Initialize exercise order from localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(`cultivateos-progression-order-${userId}`);
      if (stored) setExerciseOrder(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [userId]);

  const handleDrawerOpen = useCallback(() => setIsDrawerOpen(true), []);
  const handleDrawerClose = useCallback(() => setIsDrawerOpen(false), []);

  // ── Log training data ──
  const handleLog = async (exerciseId: string, level: number, data: {
    weight1?: number; reps1?: number;
    weight2?: number; reps2?: number;
    weight3?: number; reps3?: number;
    holdTime?: number; holdTime2?: number; holdTime3?: number; modifier?: string; variant?: string; notes?: string;
  }) => {
    if (!userId) return;
    const res = await fetch(`/api/progressions/${exerciseId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, level, ...data }),
    });
    if (!res.ok) {
      const text = await res.text();
      let errMsg = "Failed to log";
      try {
        const err = JSON.parse(text);
        errMsg = err.error || errMsg;
      } catch {
        console.error(`Log failed (${res.status}):`, text.slice(0, 200));
      }
      throw new Error(errMsg);
    }
    await fetchExercises();
  };

  // ── Complete level ──
  const handleComplete = async (exerciseId: string, level: number) => {
    if (!userId) return;
    try {
      await fetch(`/api/progressions/${exerciseId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, level, completed: true }),
      });
      fetchExercises();
    } catch (err) {
      console.error("Failed to complete:", err);
    }
  };

  // ── Delete single ──
  const handleDelete = async (exerciseId: string) => {
    if (!userId) return;
    try {
      await fetch(`/api/progressions/${exerciseId}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
      dismissExercise(exerciseId);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  // ── View detail ──
  const handleViewExercise = (exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (ex) setDetailExercise(ex);
  };

  // ── Derived data ──
  const categories = [...new Set(exercises.map((e) => e.category))].sort();
  const types = [...new Set(exercises.map((e) => e.type).filter((t): t is string => !!t && t.trim().length > 0))].sort();
  const equipmentTypes = [...new Set(exercises.flatMap(getEquipmentTags))].sort();

  // Selected exercises in order they were added
  const selectedExercises = exercises.filter((e) => selectedExerciseIds.has(e.id));

  // ── Render ──

  const sidebar = (
    <ProgressionSidebar
      exercises={exercises}
      selectedIds={selectedExerciseIds}
      onToggleExercise={toggleExercise}
      onSelectWithLevel={(exerciseId, level) => {
        if (!selectedExerciseIds.has(exerciseId)) toggleExercise(exerciseId);
        updateLevelDefault(exerciseId, level);
      }}
      searchTerm={searchTerm}
      onSearch={setSearchTerm}
      filterCategory={filterCategory}
      setFilterCategory={setFilterCategory}
      filterType={filterType}
      setFilterType={setFilterType}
      filterEquipment={filterEquipment}
      setFilterEquipment={setFilterEquipment}
      categories={categories}
      types={types}
      equipmentTypes={equipmentTypes}
      levelDefaults={levelDefaults}
      selectedDayFilter={selectedDayFilter}
      setSelectedDayFilter={setSelectedDayFilter}
      onDrawerOpen={handleDrawerOpen}
    />
  );

  if (loading) {
    return (
      <PageLayout sidebar={sidebar} title="Training Grounds" subtitle="Record your cultivation sessions">
        <div className="flex items-center justify-center py-20">
          <p className="text-mist-mid text-sm animate-pulse">Loading exercises…</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout sidebar={sidebar} title="Training Grounds" subtitle="Record your cultivation sessions">
      {exercises.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="p-4 space-y-4">
          {/* Color guide */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowColorGuide(true)}
              className="ml-auto px-2.5 py-1 rounded-md text-[10px] font-semibold border border-ink-light/60 text-mist-dark hover:text-cloud-white hover:border-mist-dark transition-all duration-200 flex items-center gap-1"
              title="Cultivation Color System"
            >
              <span className="text-sm">🌈</span> Colors
            </button>
          </div>

          {/* Selected exercise log forms (above table) */}
          {selectedExercises.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-mist-light uppercase tracking-wider">Log Training Data</h3>
                <button
                  onClick={() => setSelectedExerciseIds(new Set())}
                  className="text-[10px] text-mist-dark hover:text-crimson-light transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {selectedExercises.map((exercise) => (
                    <InlineLogForm
                      key={exercise.id}
                      exercise={exercise}
                      selectedLevel={getSelectedLevel(exercise, levelDefaults)}
                      onSubmit={handleLog}
                      onChangeLevel={updateLevelDefault}
                      onDismiss={dismissExercise}
                      onViewDetail={handleViewExercise}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Training Log Table */}
          <section>
            <h3 className="text-xs text-mist-light uppercase tracking-wider mb-3">Training Log</h3>
            <TrainingLogTable exercises={exercises} onViewExercise={handleViewExercise} onRefresh={fetchExercises} userId={userId || ''} />
          </section>

          {/* Hold Training Log Table */}
          {exercises.some(hasHoldBasedTiers) && (
            <section>
              <h3 className="text-xs text-mountain-blue-glow uppercase tracking-wider mb-3">Hold Training Log</h3>
              <HoldTrainingLogTable exercises={exercises} onViewExercise={handleViewExercise} onRefresh={fetchExercises} userId={userId || ''} />
            </section>
          )}
        </div>
      )}

      {/* Detail View Modal */}
      <ExerciseDetailModal
        exercise={detailExercise}
        isOpen={detailExercise !== null}
        onClose={() => setDetailExercise(null)}
      />

      {/* Cultivation Color Guide Modal */}
      <CultivationColorGuide isOpen={showColorGuide} onClose={() => setShowColorGuide(false)} />

      {/* Technique Management Drawer */}
      <TechniqueManagementDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        exercises={exercises.map(e => ({
          id: e.id,
          name: e.name,
          wuxiaName: e.wuxiaName,
          difficulty: e.difficulty,
          type: e.type,
          story: e.story,
          assignedDays: e.assignedDays,
        }))}
        onUpdateDayAssignments={handleUpdateDayAssignments}
        onReorderExercises={handleReorderExercises}
        selectedDayFilter={selectedDayFilter}
      />
    </PageLayout>
  );
}
