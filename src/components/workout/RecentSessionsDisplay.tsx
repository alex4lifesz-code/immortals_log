"use client";

import { useState, useEffect, CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/context/AuthContext";
import { getDifficultyColorClass, getDifficultyGlowStyleScaled } from "@/lib/difficulty-styles";
import { getTypeColor, getTargetGroupColor, formatDateWithPreference } from "@/lib/constants";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import { getExerciseDisplayName, getExerciseNameTooltip } from "@/lib/exercise-name";
import ExerciseHistoryModal from "@/components/workout/ExerciseHistoryModal";
// DisplaySettingsPopup moved to TopBar

interface EditingExercise {
  id: string;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  notes: string | null;
}

interface WorkoutSession {
  id: string;
  name: string;
  date: string;
  totalXP: number;
  targetGroups?: string | null;
  simplifiedExercises: {
    id: string;
    weight1: number | null;
    reps1: number | null;
    weight2: number | null;
    reps2: number | null;
    weight3: number | null;
    reps3: number | null;
    notes: string | null;
    exercise: {
      id: string;
      name: string;
      wuxiaName?: string | null;
      difficulty: string;
      type: string;
      targetGroup: string | null;
    };
  }[];
}

// Column metadata for sequential set-based structure
const COLUMN_CONFIG_DEFAULT = [
  { key: "date", label: "Date", type: "display", width: "", colType: "" },
  { key: "exercise", label: "Exercise", type: "display", width: "", colType: "" },
  { key: "weight1", label: "W1", type: "numeric", width: "", editable: true, colType: "weight" },
  { key: "reps1", label: "R1", type: "numeric", width: "", editable: true, colType: "reps" },
  { key: "weight2", label: "W2", type: "numeric", width: "", editable: true, colType: "weight" },
  { key: "reps2", label: "R2", type: "numeric", width: "", editable: true, colType: "reps" },
  { key: "weight3", label: "W3", type: "numeric", width: "", editable: true, colType: "weight" },
  { key: "reps3", label: "R3", type: "numeric", width: "", editable: true, colType: "reps" },
  { key: "notes", label: "Notes", type: "text", width: "", editable: true, colType: "" },
];

// Grouped column order: W1,W2,W3,R1,R2,R3
const COLUMN_CONFIG_GROUPED = [
  { key: "date", label: "Date", type: "display", width: "", colType: "" },
  { key: "exercise", label: "Exercise", type: "display", width: "", colType: "" },
  { key: "weight1", label: "W1", type: "numeric", width: "", editable: true, colType: "weight" },
  { key: "weight2", label: "W2", type: "numeric", width: "", editable: true, colType: "weight" },
  { key: "weight3", label: "W3", type: "numeric", width: "", editable: true, colType: "weight" },
  { key: "reps1", label: "R1", type: "numeric", width: "", editable: true, colType: "reps" },
  { key: "reps2", label: "R2", type: "numeric", width: "", editable: true, colType: "reps" },
  { key: "reps3", label: "R3", type: "numeric", width: "", editable: true, colType: "reps" },
  { key: "notes", label: "Notes", type: "text", width: "", editable: true, colType: "" },
];

interface RecentSessionsDisplayProps {
  refreshTrigger?: number;
}

export default function RecentSessionsDisplay({ refreshTrigger }: RecentSessionsDisplayProps) {
  const { user } = useAuth();
  const { settings, updateSettings } = useDisplaySettings();
  const { isMobile, viewportMode } = useAppContext();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, EditingExercise>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ exerciseId: string; exerciseName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [historyModal, setHistoryModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null);

  // Compute effective compact mode: auto → compact on mobile, full on desktop
  const effectiveCompact = settings.recentSessionsCompact === "compact"
    || (settings.recentSessionsCompact === "auto" && (isMobile || viewportMode === "mobile"));

  const glowIntensityRecent = settings.glowIntensityRecentSessions ?? 100;

  const fetchSessions = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const days = settings.recentSessionsDays || 0;
      let url = `/api/workouts?userId=${user.id}`;
      if (days === -1) {
        url += '&showAll=true';
      } else if (days > 0) {
        url += `&days=${days}`;
      }
      
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSessions(data.workouts || []);
      } else {
        setError(data.error || "Failed to load training sessions");
      }
    } catch (error) {
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (user?.id) {
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSessions is stable, runs on user change
  }, [user?.id]);

  // Refresh when trigger changes (after new submission)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && user?.id) {
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSessions is stable
  }, [refreshTrigger, user?.id]);

  // Re-fetch when duration filter or showAllSessions toggle changes
  useEffect(() => {
    if (user?.id) {
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSessions is stable
  }, [settings.showAllSessions, settings.recentSessionsDays]);

  // Clear save message after 5 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => {
        setSaveMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Show relative time for recent sessions, configurable date for older ones
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
    return formatDateWithPreference(date, dateFormat);
  };

  const truncateExerciseName = (name: string): { display: string; full: string } => {
    return { display: name, full: name };
  };

  const displayNumericalValue = (value: number | null): string => {
    return value !== null && value !== undefined ? String(value) : "—";
  };

  const getZeroValueStyle = (value: number | null, colType: string): React.CSSProperties | undefined => {
    if (value === 0) {
      return {
        backgroundColor: 'var(--ink-mid)',
        color: 'var(--mist-dark)',
      };
    }
    if (settings.columnColorsEnabled && colType === 'weight') {
      return { backgroundColor: 'var(--col-weight-bg)' };
    }
    if (settings.columnColorsEnabled && colType === 'reps') {
      return { backgroundColor: 'var(--col-reps-bg)' };
    }
    return undefined;
  };

  const handleEditModeToggle = () => {
    if (!isEditMode) {
      // Entering edit mode - initialize editing data
      const newEditingData: Record<string, EditingExercise> = {};
      sessions.forEach(session => {
        session.simplifiedExercises.forEach(exercise => {
          newEditingData[exercise.id] = {
            id: exercise.id,
            weight1: exercise.weight1,
            reps1: exercise.reps1,
            weight2: exercise.weight2,
            reps2: exercise.reps2,
            weight3: exercise.weight3,
            reps3: exercise.reps3,
            notes: exercise.notes,
          };
        });
      });
      setEditingData(newEditingData);
    }
    setIsEditMode(!isEditMode);
  };

  const handleEditChange = (exerciseId: string, field: keyof EditingExercise, value: string | number | null) => {
    setEditingData(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: value,
      }
    }));
  };

  const validateEditingData = (): boolean => {
    for (const exerciseId in editingData) {
      const data = editingData[exerciseId];
      
      // At least one set with reps must be present
      if (!data.reps1 && !data.reps2 && !data.reps3) {
        setSaveMessage({ type: "error", text: "At least one set with reps is required" });
        return false;
      }

      // Validate reps ranges
      if (data.reps1 !== null && (data.reps1 < 1 || data.reps1 > 500)) {
        setSaveMessage({ type: "error", text: "Set 1 reps must be between 1 and 500" });
        return false;
      }
      if (data.reps2 !== null && (data.reps2 < 1 || data.reps2 > 500)) {
        setSaveMessage({ type: "error", text: "Set 2 reps must be between 1 and 500" });
        return false;
      }
      if (data.reps3 !== null && (data.reps3 < 1 || data.reps3 > 500)) {
        setSaveMessage({ type: "error", text: "Set 3 reps must be between 1 and 500" });
        return false;
      }

      // Validate weight ranges
      if (data.weight1 !== null && (data.weight1 < 0 || data.weight1 > 10000)) {
        setSaveMessage({ type: "error", text: "Set 1 weight must be between 0 and 10000" });
        return false;
      }
      if (data.weight2 !== null && (data.weight2 < 0 || data.weight2 > 10000)) {
        setSaveMessage({ type: "error", text: "Set 2 weight must be between 0 and 10000" });
        return false;
      }
      if (data.weight3 !== null && (data.weight3 < 0 || data.weight3 > 10000)) {
        setSaveMessage({ type: "error", text: "Set 3 weight must be between 0 and 10000" });
        return false;
      }
    }
    return true;
  };

  const handleSaveChanges = async () => {
    if (!validateEditingData()) {
      return;
    }

    setIsSaving(true);
    try {
      // Prepare update payload
      const updates = [];
      for (const exerciseId in editingData) {
        const data = editingData[exerciseId];
        updates.push({
          id: exerciseId,
          weight1: data.weight1,
          reps1: data.reps1,
          weight2: data.weight2,
          reps2: data.reps2,
          weight3: data.weight3,
          reps3: data.reps3,
          notes: data.notes,
        });
      }

      const response = await fetch("/api/workouts/update-exercises", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      });

      if (response.ok) {
        setSaveMessage({ type: "success", text: "Training sessions updated successfully!" });
        setIsEditMode(false);
        setEditingData({});
        fetchSessions();
      } else {
        const errorData = await response.json();
        setSaveMessage({ type: "error", text: errorData.error || "Failed to save changes" });
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveMessage({ type: "error", text: "Network error - unable to save changes" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingData({});
  };

  const handleDeleteExercise = async (exerciseEntryId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/workouts/delete-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseEntryId }),
      });

      if (response.ok) {
        // Remove from editing data
        const newData = { ...editingData };
        delete newData[exerciseEntryId];
        setEditingData(newData);

        // Remove from sessions state with animation
        setSessions(prev => {
          const updated = prev.map(session => ({
            ...session,
            simplifiedExercises: session.simplifiedExercises.filter(ex => ex.id !== exerciseEntryId),
          })).filter(session => session.simplifiedExercises.length > 0);
          return updated;
        });

        setSaveMessage({ type: "success", text: "Training record deleted successfully" });
      } else {
        const data = await response.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to delete record" });
      }
    } catch (error) {
      console.error("Delete error:", error);
      setSaveMessage({ type: "error", text: "Network error - unable to delete record" });
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <GlowCard glow="none" className="w-full">
        <div className="text-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-jade-glow border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-sm text-mist-light">Loading training history...</p>
        </div>
      </GlowCard>
    );
  }

  if (error) {
    return (
      <GlowCard glow="crimson" className="w-full">
        <div className="text-center py-6">
          <p className="text-sm text-crimson-light mb-2">⚠️ {error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchSessions}
            className="text-xs text-mist-light hover:text-cloud-white underline"
          >
            Try Again
          </motion.button>
        </div>
      </GlowCard>
    );
  }

  return (
    <GlowCard glow="jade" className="w-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-jade-glow">
            {settings.recentSessionsDays === -1
              ? "All Training Sessions"
              : settings.recentSessionsDays > 0
                ? `Training Sessions (${settings.recentSessionsDays}d)`
                : "Recent Training Sessions"}
          </h3>
          <div className="flex items-center gap-2">
            {sessions.length > 0 && (
              <>
                {!isEditMode && (
                  <select
                    value={settings.recentSessionsDays}
                    onChange={(e) => {
                      const days = parseInt(e.target.value, 10);
                      updateSettings({ recentSessionsDays: days, showAllSessions: days === 0 });
                    }}
                    className="text-xs px-2 py-0.5 rounded border border-ink-light/40 bg-ink-dark text-mist-light hover:border-jade/30 transition-all cursor-pointer outline-none focus:border-jade-glow/50"
                  >
                    <option value={0}>Recent 10</option>
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={-1}>All Sessions</option>
                  </select>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleEditModeToggle}
                  className={`text-xs px-3 py-1 rounded border transition-all ${
                    isEditMode
                      ? "bg-crimson-deep/20 border-crimson/40 text-crimson-light"
                      : "border-jade-glow/40 text-jade-light hover:bg-jade-deep/10"
                  }`}
                >
                  {isEditMode ? "✕ Cancel Edit" : "✎ Edit"}
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* Edit Mode Message */}
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg border bg-jade-deep/10 border-jade/40 text-xs text-jade-light"
          >
            Edit mode enabled. Modify the training data below and click Save or Cancel.
          </motion.div>
        )}

        {/* Save Message */}
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-lg border text-center text-xs ${
              saveMessage.type === "success"
                ? "bg-jade-deep/20 border-jade/40 text-jade-light"
                : "bg-crimson-deep/20 border-crimson/40 text-crimson-light"
            }`}
          >
            {saveMessage.text}
          </motion.div>
        )}

        {/* Sessions */}
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🏮</div>
            <h4 className="text-sm font-medium text-mist-light mb-2">Begin Your Training Journey</h4>
            <p className="text-xs text-mist-dark">
              Record your first cultivation session to start building your martial arts legacy.
            </p>
          </div>
        ) : effectiveCompact && !isEditMode ? (
          /* ── Compact Presentation Mode ── */
          <div className="space-y-1.5">
            {sessions.flatMap((session) =>
              session.simplifiedExercises.map((exercise) => {
                const formatSet = (w: number | null, r: number | null) => {
                  if (r === null && w === null) return null;
                  const wStr = w !== null ? `${w}` : "—";
                  const rStr = r !== null ? `×${r}` : "";
                  return `${wStr}${rStr}`;
                };
                const sets = [
                  formatSet(exercise.weight1, exercise.reps1),
                  formatSet(exercise.weight2, exercise.reps2),
                  formatSet(exercise.weight3, exercise.reps3),
                ].filter(Boolean);
                const exerciseDisplayName = getExerciseDisplayName(exercise.exercise, settings.terminologyMode);
                const exerciseTooltip = getExerciseNameTooltip(exercise.exercise, settings.terminologyMode);

                return (
                  <motion.div
                    key={exercise.id}
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-ink-light/40 bg-ink-dark/30 hover:bg-ink-mid/15 transition-colors cursor-pointer"
                    onClick={() => setHistoryModal({ exerciseId: exercise.exercise.id, exerciseName: exerciseDisplayName })}
                  >
                    <span className="text-[10px] text-mist-dark shrink-0 w-14">{formatDate(session.date)}</span>
                    {settings.recentSessionsMode === "name-only" ? (
                      <span className="text-xs font-normal text-cloud-white flex-1 min-w-0 break-words" title={exerciseTooltip}>
                        {exerciseDisplayName}
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-normal flex-1 min-w-0 break-words ${getDifficultyColorClass(exercise.exercise.difficulty)}`}
                        title={exerciseTooltip}
                      >
                        {exerciseDisplayName}
                      </span>
                    )}
                    <span className="text-[11px] text-mist-light shrink-0 font-mono">
                      {sets.length > 0 ? sets.join(" · ") : "—"}
                    </span>
                    {exercise.notes && (
                      <span className="text-[10px] text-mist-dark shrink-0" title={exercise.notes}>📝</span>
                    )}
                    {exercise.exercise.targetGroup && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${getTargetGroupColor(exercise.exercise.targetGroup)} bg-ink-dark/50 border border-current/10 shrink-0`}>
                        {exercise.exercise.targetGroup}
                      </span>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Sequential Set-Based Table Structure */}
            <table className="text-xs border-collapse" style={{ whiteSpace: 'nowrap', minWidth: isEditMode ? '720px' : '600px' }}>
              {/* Distinctive Header Row */}
              <thead>
                <tr className="border-b-2 border-jade-glow/50 bg-ink-mid/40 text-mist-light">
                  {(settings.columnOrderGrouped ? COLUMN_CONFIG_GROUPED : COLUMN_CONFIG_DEFAULT).map((col) => (
                    <th
                      key={col.key}
                      className={`py-2 font-semibold uppercase tracking-wider text-[11px] align-middle
                        ${col.type === 'numeric' ? 'text-center px-1' : 'text-left px-1.5'}
                        ${col.key === 'date' ? 'pr-1' : ''}
                        ${col.key === 'notes' ? 'w-[1%]' : ''}`}
                      style={
                        settings.columnColorsEnabled && col.colType === 'weight'
                          ? { color: 'var(--col-weight)' }
                          : settings.columnColorsEnabled && col.colType === 'reps'
                            ? { color: 'var(--col-reps)' }
                            : undefined
                      }
                    >
                      {col.label}
                    </th>
                  ))}
                  {isEditMode && <th className="px-1 py-2 text-center font-semibold text-mist-glow align-middle">⋮</th>}
                </tr>
              </thead>

              {/* Data Rows with Sequential Set Pairing */}
              <tbody>
                <AnimatePresence>
                  {sessions.flatMap((session, sessionIndex) =>
                    session.simplifiedExercises.map((exercise, exerciseIndex) => {
                      const editData = editingData[exercise.id];
                      const renderedName = getExerciseDisplayName(exercise.exercise, settings.terminologyMode);
                      const exerciseTooltip = getExerciseNameTooltip(exercise.exercise, settings.terminologyMode);
                      const exerciseName = truncateExerciseName(renderedName);

                      return (
                        <motion.tr
                          key={exercise.id}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ delay: (sessionIndex * 0.02) + (exerciseIndex * 0.02) }}
                          className={`border-b transition-all duration-200 ${
                            isEditMode
                              ? "border-jade-glow/20 bg-jade-deep/10 hover:bg-jade-deep/15"
                              : "border-ink-light hover:bg-ink-mid/15"
                          }`}
                        >
                          {/* DATE COLUMN - Chronological Anchor */}
                          <td className="px-1.5 py-1.5 text-mist-light text-xs tracking-normal align-middle whitespace-nowrap">
                            {formatDate(session.date)}
                          </td>

                          {/* EXERCISE COLUMN - Technique Identification */}
                          <td
                            className="px-1.5 py-1.5 align-middle whitespace-normal cursor-pointer hover:bg-jade-deep/10 rounded transition-colors"
                            style={{ minWidth: '120px', maxWidth: '260px', wordBreak: 'break-word' }}
                            onClick={() => !isEditMode && setHistoryModal({ exerciseId: exercise.exercise.id, exerciseName: renderedName })}
                          >
                            {settings.recentSessionsMode === "name-only" ? (
                              <span className="text-xs text-cloud-white" title={exerciseTooltip}>
                                {exerciseName.display}
                              </span>
                            ) : (
                              <div
                                className="px-2 py-1 rounded border inline-flex items-center gap-1.5"
                                style={glowIntensityRecent > 0 ? getDifficultyGlowStyleScaled(exercise.exercise.difficulty, glowIntensityRecent) as CSSProperties : undefined}
                                title={exerciseTooltip}
                              >
                                <span className={`text-xs font-normal ${getDifficultyColorClass(exercise.exercise.difficulty)}`}>
                                  {exerciseName.display}
                                </span>
                                {(settings.recentSessionsMode === "name-illumination-realm" ||
                                  settings.recentSessionsMode === "name-illumination-realm-path") && (
                                  <>
                                    <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getDifficultyColorClass(exercise.exercise.difficulty)} border border-current/20 opacity-80`}>
                                      {exercise.exercise.difficulty}
                                    </span>
                                    {settings.recentSessionsMode === "name-illumination-realm-path" && exercise.exercise.type && (
                                      <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getTypeColor(exercise.exercise.type)} border border-current/20 opacity-70`}>
                                        {exercise.exercise.type}
                                      </span>
                                    )}
                                    {settings.recentSessionsMode === "name-illumination-realm-path" && exercise.exercise.targetGroup && (
                                      <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getTargetGroupColor(exercise.exercise.targetGroup)} border border-current/20 opacity-70`}>
                                        {exercise.exercise.targetGroup}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </td>

                          {/* DATA COLUMNS — order driven by column order setting */}
                          {(() => {
                            const dataFields = settings.columnOrderGrouped
                              ? ["weight1", "weight2", "weight3", "reps1", "reps2", "reps3"] as const
                              : ["weight1", "reps1", "weight2", "reps2", "weight3", "reps3"] as const;
                            const fieldMeta: Record<string, { type: "weight" | "reps"; min: string; max?: string; step?: string }> = {
                              weight1: { type: "weight", min: "0", step: "0.5" },
                              weight2: { type: "weight", min: "0", step: "0.5" },
                              weight3: { type: "weight", min: "0", step: "0.5" },
                              reps1: { type: "reps", min: "1", max: "500" },
                              reps2: { type: "reps", min: "1", max: "500" },
                              reps3: { type: "reps", min: "1", max: "500" },
                            };
                            return dataFields.map((field) => {
                              const meta = fieldMeta[field];
                              const value = exercise[field as keyof typeof exercise] as number | null;
                              const editValue = editData?.[field as keyof typeof editData];
                              if (isEditMode && editData) {
                                return (
                                  <td key={field} className="px-1 py-1.5 text-center align-middle">
                                    <input
                                      type="number"
                                      min={meta.min}
                                      max={meta.max}
                                      step={meta.step}
                                      value={editValue ?? ""}
                                      onChange={(e) =>
                                        handleEditChange(
                                          exercise.id,
                                          field,
                                          e.target.value
                                            ? meta.type === "weight" ? parseFloat(e.target.value) : parseInt(e.target.value)
                                            : null
                                        )
                                      }
                                      placeholder="—"
                                      className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-cloud-white
                                                 text-center text-xs outline-none transition-all duration-200
                                                 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                                    />
                                  </td>
                                );
                              }
                              return (
                                <td key={field} className="px-1 py-1.5 text-center text-cloud-white text-xs align-middle"
                                  style={getZeroValueStyle(value, meta.type)}
                                >
                                  {displayNumericalValue(value)}
                                </td>
                              );
                            });
                          })()}

                          {/* NOTES COLUMN - Terminal Position */}
                          {isEditMode && editData ? (
                            <td className="px-1.5 py-1.5 align-middle">
                              <input
                                type="text"
                                value={editData.notes ?? ""}
                                onChange={(e) =>
                                  handleEditChange(
                                    exercise.id,
                                    "notes",
                                    e.target.value || null
                                  )
                                }
                                placeholder="Add notes..."
                                className="w-full min-w-[100px] bg-ink-deep border border-jade-glow/30 rounded px-2 py-1 text-cloud-white text-xs
                                           placeholder:text-mist-dark outline-none transition-all duration-200
                                           focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                              />
                            </td>
                          ) : (
                            <td
                              className="px-1.5 py-1.5 text-mist-light text-xs truncate max-w-[180px] cursor-help hover:text-mist-glow transition-colors align-middle whitespace-nowrap"
                              title={exercise.notes || "No notes"}
                              onClick={() => exercise.notes && setExpandedNotes(expandedNotes === exercise.id ? null : exercise.id)}
                            >
                              {exercise.notes ? (
                                <span className="hover:underline">
                                  {exercise.notes.length > 25 ? `${exercise.notes.substring(0, 25)}…` : exercise.notes}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}

                          {/* Edit Row Delete Action */}
                          {isEditMode && (
                            <td className="px-1 py-1.5 text-center align-middle">
                              <motion.button
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  setDeleteConfirm({
                                    exerciseId: exercise.id,
                                    exerciseName: renderedName,
                                  });
                                }}
                                className="text-crimson-light hover:text-crimson-glow transition-colors text-lg"
                                title="Delete this training record"
                                disabled={isDeleting}
                              >
                                ✕
                              </motion.button>
                            </td>
                          )}
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Mode Controls */}
        {isEditMode && sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 pt-4 border-t border-ink-light"
          >
            <GlowButton
              variant="jade"
              size="sm"
              className="flex-1"
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "✓ Save Changes"}
            </GlowButton>
            <GlowButton
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={handleCancel}
              disabled={isSaving}
            >
              ✕ Cancel
            </GlowButton>
          </motion.div>
        )}

        {sessions.length > 0 && !isEditMode && (
          <div className="text-center pt-4 border-t border-ink-light">
            <p className="text-xs text-mist-dark">
              Showing {sessions.length} {settings.recentSessionsDays === -1 ? "total" : settings.recentSessionsDays > 0 ? `(last ${settings.recentSessionsDays}d)` : "most recent"} training sessions
            </p>
          </div>
        )}
      </div>

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
                Are you sure you want to permanently delete the training record for{" "}
                <span className="text-cloud-white font-medium">{deleteConfirm.exerciseName}</span>?
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDeleteExercise(deleteConfirm.exerciseId)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-crimson-deep/30 border border-crimson/50 text-crimson-light hover:bg-crimson-deep/50 transition-all duration-200 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete Session"}
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

      {/* Exercise History Modal */}
      {historyModal && (
        <ExerciseHistoryModal
          exerciseId={historyModal.exerciseId}
          exerciseName={historyModal.exerciseName}
          isOpen={true}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </GlowCard>
  );
}
