"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlowButton from "@/components/ui/GlowButton";
import { getDifficultyColorClass, getDifficultyGlowStyleScaled } from "@/lib/difficulty-styles";
import { getTypeColor, getDifficultyColor, getDifficultyGlow, getTargetGroupColor, formatDateWithPreference } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import { getExerciseDisplayName } from "@/lib/exercise-name";

interface Exercise {
  id: string;
  name: string;
  wuxiaName?: string;
  difficulty: string;
  type: string;
  targetGroup?: string;
  assignedDays?: string;
  story?: string;
}

interface ActiveTrainingCardProps {
  exercise: Exercise;
  onSubmit: () => void;
  onRemove: () => void;
  delay?: number;
}

export default function ActiveTrainingCard({ 
  exercise, 
  onSubmit, 
  onRemove,
  delay = 0 
}: ActiveTrainingCardProps) {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const { isMobile, viewportMode } = useAppContext();
  const effectiveMobile = isMobile || viewportMode === "mobile";
  const [weight1, setWeight1] = useState("");
  const [reps1, setReps1] = useState("");
  const [weight2, setWeight2] = useState("");
  const [reps2, setReps2] = useState("");
  const [weight3, setWeight3] = useState("");
  const [reps3, setReps3] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showConventionalName, setShowConventionalName] = useState(false);
  const [historyData, setHistoryData] = useState<{ id: string; date: string; weight1: number | null; reps1: number | null; weight2: number | null; reps2: number | null; weight3: number | null; reps3: number | null; notes: string | null }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const difficultyColorClass = getDifficultyColorClass(exercise.difficulty);
  const exerciseDisplayName = getExerciseDisplayName(exercise, settings.terminologyMode);
  const typeColor = getTypeColor(exercise.type);
  const glowIntensity = settings.glowIntensityActiveCards ?? 100;
  const loreVisible = settings.activeCardLoreVisible ?? true;
  const glowStyle = getDifficultyGlowStyleScaled(exercise.difficulty, glowIntensity);

  // Derive display flags from activeCardMode
  const mode = settings.activeCardMode || "name-illumination-realm-path";
  const showIllumination = mode !== "name-only";
  const showRealm = mode === "name-illumination-realm" || mode === "name-illumination-realm-path";
  const showPath = mode === "name-illumination-realm-path";
  const notesAlwaysVisible = settings.activeCardNotesAlwaysVisible || false;
  const isCompact = settings.activeCardCompact || false;
  const cardStyle = settings.activeCardStyle || "default";
  const isScrollStyle = cardStyle === "scroll-card";

  // Scroll-card style helpers (matching Technique Scroll page)
  const typeEmoji =
    exercise.type === "Upper Heaven" ? "☁️"
    : exercise.type === "Lower Realms" ? "🔥"
    : exercise.type === "Heart Meridian" ? "💚"
    : "⭐";

  // Sync showNotes with the always-visible setting
  useEffect(() => {
    if (notesAlwaysVisible) {
      setShowNotes(true);
    } else {
      setShowNotes(false);
    }
  }, [notesAlwaysVisible]);

  const fetchHistory = async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/exercises/history?exerciseId=${exercise.id}&userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryToggle = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  const validateInputs = (): boolean => {
    const errors: Record<string, boolean> = {};
    let hasData = false;

    if (reps1) hasData = true;
    if (reps2) hasData = true;
    if (reps3) hasData = true;

    if (!hasData) {
      errors.reps1 = true;
      errors.reps2 = true;
      errors.reps3 = true;
    }

    if (weight1 && (isNaN(parseFloat(weight1)) || parseFloat(weight1) < 0 || parseFloat(weight1) > 10000)) {
      errors.weight1 = true;
    }
    if (weight2 && (isNaN(parseFloat(weight2)) || parseFloat(weight2) < 0 || parseFloat(weight2) > 10000)) {
      errors.weight2 = true;
    }
    if (weight3 && (isNaN(parseFloat(weight3)) || parseFloat(weight3) < 0 || parseFloat(weight3) > 10000)) {
      errors.weight3 = true;
    }
    if (reps1 && (isNaN(parseInt(reps1)) || parseInt(reps1) < 1 || parseInt(reps1) > 500)) {
      errors.reps1 = true;
    }
    if (reps2 && (isNaN(parseInt(reps2)) || parseInt(reps2) < 1 || parseInt(reps2) > 500)) {
      errors.reps2 = true;
    }
    if (reps3 && (isNaN(parseInt(reps3)) || parseInt(reps3) < 1 || parseInt(reps3) > 500)) {
      errors.reps3 = true;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!user) {
      setSubmitMessage({ type: "error", text: "Please log in to record training sessions." });
      return;
    }

    if (!validateInputs()) {
      setSubmitMessage({ type: "error", text: "Please enter valid data for at least one set." });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          exerciseId: exercise.id,
          weight1: weight1 ? parseFloat(weight1) : undefined,
          reps1: reps1 ? parseInt(reps1) : undefined,
          weight2: weight2 ? parseFloat(weight2) : undefined,
          reps2: reps2 ? parseInt(reps2) : undefined,
          weight3: weight3 ? parseFloat(weight3) : undefined,
          reps3: reps3 ? parseInt(reps3) : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        setSubmitMessage({ type: "success", text: "Session recorded!" });
        setValidationErrors({});
        
        setWeight1("");
        setReps1("");
        setWeight2("");
        setReps2("");
        setWeight3("");
        setReps3("");
        setNotes("");
        if (!notesAlwaysVisible) setShowNotes(false);
        
        setTimeout(() => {
          setSubmitMessage(null);
          onSubmit();
        }, 1200);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to record training session");
      }
    } catch (error: unknown) {
      console.error("Error recording training session:", error);
      setSubmitMessage({ 
        type: "error", 
        text: error instanceof Error ? error.message : "Failed to record training session" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sets = [
    { num: 1, w: weight1, r: reps1, setW: setWeight1, setR: setReps1, wKey: "weight1", rKey: "reps1" },
    { num: 2, w: weight2, r: reps2, setW: setWeight2, setR: setReps2, wKey: "weight2", rKey: "reps2" },
    { num: 3, w: weight3, r: reps3, setW: setWeight3, setR: setReps3, wKey: "weight3", rKey: "reps3" },
  ];

  const inputBaseClass = "bg-ink-deep border border-ink-light rounded-md px-2 py-1.5 text-xs text-cloud-white placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow/50 focus:shadow-[0_0_8px_rgba(58,143,143,0.15)] text-center";
  const inputErrorClass = "!border-red-500/60 !bg-red-500/5";
  const inputNormalClass = "border-ink-light";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.95 }}
      transition={{ 
        delay,
        type: "spring",
        stiffness: 400,
        damping: 30 
      }}
    >
      {isScrollStyle ? (
        /* ═══════════════ Technique Scroll Style Card ═══════════════ */
        <div
          className={`relative bg-ink-dark border border-ink-light rounded-xl transition-all duration-300 overflow-hidden shadow-[0_0_12px_rgba(58,143,143,0.2)] hover:shadow-[0_0_20px_rgba(58,143,143,0.4)] hover:border-jade/40 ${showIllumination && glowIntensity >= 100 ? getDifficultyGlow(exercise.difficulty) : ''}`}
          style={showIllumination && glowIntensity > 0 && glowIntensity < 100 ? { boxShadow: `0 0 12px rgba(58,143,143,0.2), ${glowStyle.boxShadow || ''}` } : undefined}
        >
          {/* Success overlay animation */}
          <AnimatePresence>
            {submitMessage?.type === "success" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-green-500/10 border border-green-500/30 rounded-xl z-20 flex items-center justify-center"
              >
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-green-400 text-xs font-medium flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {submitMessage.text}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`${isCompact ? 'p-2.5' : 'p-4'} flex flex-col ${isCompact ? 'gap-1.5' : 'gap-3'}`}>
            {/* ── Scroll-style header: emoji + name + badges ── */}
            <div className="flex items-start justify-between gap-3">
              <div className={`flex items-start ${isCompact ? 'gap-2' : 'gap-3'} min-w-0 flex-1`}>
                <span className={`${isCompact ? 'text-sm' : 'text-lg'} pt-0.5 opacity-80 shrink-0`}>{typeEmoji}</span>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold ${showIllumination ? difficultyColorClass : 'text-cloud-white'} truncate leading-snug tracking-wide`}>
                      {exerciseDisplayName}
                    </h3>
                    {settings.terminologyMode === "fantasy" && exercise.name && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowConventionalName(!showConventionalName); }}
                        className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-200 ${showConventionalName ? 'bg-jade-glow/20 text-jade-glow border border-jade-glow/40' : 'bg-ink-light/30 text-mist-dark hover:text-mist-light hover:bg-ink-light/50 border border-ink-light/40'}`}
                        title="Show conventional name"
                      >
                        i
                      </button>
                    )}
                  </div>
                  {showConventionalName && settings.terminologyMode === "fantasy" && exercise.name && (
                    <p className="text-[10px] text-mist-mid mt-0.5 truncate">Conventional: {exercise.name}</p>
                  )}
                  {!isCompact && (showRealm || showPath) && (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {showRealm && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getDifficultyColor(exercise.difficulty)} bg-ink-dark/40 whitespace-nowrap border border-current/15`}>
                          {exercise.difficulty}
                        </span>
                      )}
                      {showPath && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTypeColor(exercise.type)} bg-ink-dark/40 whitespace-nowrap border border-current/15`}>
                          {exercise.type}
                        </span>
                      )}
                      {showPath && exercise.targetGroup && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${getTargetGroupColor(exercise.targetGroup)} bg-ink-dark/40 truncate border border-current/10`}>
                          {exercise.targetGroup}
                        </span>
                      )}
                    </div>
                  )}
                  {isCompact && (showRealm || showPath) && (
                    <div className="flex items-center gap-1.5">
                      {showRealm && (
                        <span className={`text-[9px] font-medium ${difficultyColorClass} opacity-70`}>
                          {exercise.difficulty}
                        </span>
                      )}
                      {showPath && (
                        <span className={`text-[9px] font-medium ${typeColor} opacity-60`}>
                          {exercise.type}
                        </span>
                      )}
                    </div>
                  )}
                  {!isCompact && loreVisible && showPath && exercise.story && (
                    <p className="mt-2 text-[11px] text-mist-mid leading-relaxed line-clamp-2">
                      {exercise.story}
                    </p>
                  )}
                </div>
              </div>

              {/* Top-right actions */}
              <div className={`flex items-center ${isCompact ? 'gap-0.5' : 'gap-1.5'} shrink-0`}>
                {!isCompact && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleHistoryToggle(); }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-jade-deep/15 border border-jade-glow/20 text-jade-glow/70 hover:text-jade-glow hover:bg-jade-deep/30 hover:border-jade-glow/40 transition-all duration-200 shrink-0"
                    title="View training history"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[9px] font-medium">History</span>
                  </button>
                )}
                {!isCompact && !notesAlwaysVisible && !effectiveMobile && (
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className={`p-1 rounded transition-colors duration-200 ${showNotes ? 'text-amber-400 bg-amber-500/10' : 'text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10'}`}
                    title="Toggle notes"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onRemove}
                  className={`${isCompact ? 'p-0.5' : 'p-1'} rounded text-mist-dark hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200`}
                  title="Remove technique"
                >
                  <svg className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Set Inputs Section (scroll style) ── */}
            {!effectiveMobile ? (
              <div className={`${isCompact ? 'space-y-1' : 'space-y-2'} pt-1 border-t border-ink-light/20`}>
                {!isCompact && (
                  <p className="text-[10px] font-semibold text-mist-dark uppercase tracking-wider">Training Sets</p>
                )}
                <div className={`flex items-center ${isCompact ? 'gap-1.5' : 'gap-2'}`}>
                  {sets.map((set) => (
                    <div key={set.num} className={`flex items-center gap-1 bg-ink-deep/40 rounded-md ${isCompact ? 'px-1.5 py-1' : 'px-2 py-1.5'} flex-1 min-w-0`} style={{ flexBasis: 0 }}>
                      <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-mist-dark font-semibold shrink-0 uppercase`}>S{set.num}</span>
                      <input type="number" placeholder="Wt" value={set.w} onChange={(e) => { set.setW(e.target.value); setValidationErrors(p => ({ ...p, [set.wKey]: false })); }} onWheel={(e) => e.currentTarget.blur()} className={`${inputBaseClass} ${validationErrors[set.wKey] ? inputErrorClass : inputNormalClass} flex-1 min-w-0 ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`} min="0" max="10000" step="any" />
                      <span className={`text-mist-dark ${isCompact ? 'text-[9px]' : 'text-[10px]'} shrink-0`}>&times;</span>
                      <input type="number" placeholder="Reps" value={set.r} onChange={(e) => { set.setR(e.target.value); setValidationErrors(p => ({ ...p, [set.rKey]: false })); }} onWheel={(e) => e.currentTarget.blur()} className={`${inputBaseClass} ${validationErrors[set.rKey] ? inputErrorClass : inputNormalClass} flex-1 min-w-0 ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`} min="1" max="500" />
                    </div>
                  ))}
                  {(isCompact || !(notesAlwaysVisible || showNotes)) && (
                    <GlowButton onClick={handleSubmit} disabled={isSubmitting} variant="jade" size="sm" className={isCompact ? "!px-3 !py-1 !text-[10px] font-semibold shrink-0" : "!px-4 !py-1.5 !text-[11px] font-semibold shrink-0"}>
                      {isSubmitting ? "..." : isCompact ? "✓" : "Record"}
                    </GlowButton>
                  )}
                </div>
              </div>
            ) : (
              <div className={`${isCompact ? 'space-y-1' : 'space-y-2'} pt-1 border-t border-ink-light/20`}>
                {!isCompact && (
                  <p className="text-[10px] font-semibold text-mist-dark uppercase tracking-wider">Training Sets</p>
                )}
                <div className={`grid grid-cols-3 ${isCompact ? 'gap-1' : 'gap-1.5'}`}>
                  {sets.map((set) => (
                    <div key={set.num} className={`flex flex-col gap-1 bg-ink-deep/40 rounded-md ${isCompact ? 'p-1' : 'p-1.5'}`}>
                      <span className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} text-mist-dark font-semibold text-center uppercase`}>Set {set.num}</span>
                      <input type="number" placeholder="Weight" value={set.w} onChange={(e) => { set.setW(e.target.value); setValidationErrors(p => ({ ...p, [set.wKey]: false })); }} onWheel={(e) => e.currentTarget.blur()} className={`${inputBaseClass} ${validationErrors[set.wKey] ? inputErrorClass : inputNormalClass} w-full ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`} min="0" max="10000" step="any" />
                      <input type="number" placeholder="Reps" value={set.r} onChange={(e) => { set.setR(e.target.value); setValidationErrors(p => ({ ...p, [set.rKey]: false })); }} onWheel={(e) => e.currentTarget.blur()} className={`${inputBaseClass} ${validationErrors[set.rKey] ? inputErrorClass : inputNormalClass} w-full ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`} min="1" max="500" />
                    </div>
                  ))}
                </div>
                <GlowButton onClick={handleSubmit} disabled={isSubmitting} variant="jade" size="sm" className={isCompact ? "w-full !py-1 !text-[10px] font-semibold" : "w-full !py-1.5 !text-[11px] font-semibold"}>
                  {isSubmitting ? "..." : isCompact ? "✓ Record" : "⚔ Record Session"}
                </GlowButton>
              </div>
            )}

            {/* Mobile notes toggle */}
            {effectiveMobile && !isCompact && !notesAlwaysVisible && (
              <button onClick={() => setShowNotes(!showNotes)} className={`self-start px-2 py-0.5 rounded text-[10px] transition-all duration-200 ${showNotes ? 'text-amber-400 bg-amber-500/10' : 'text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10'}`}>
                {showNotes ? "Hide notes" : "Add notes"}
              </button>
            )}

            {/* Error message */}
            <AnimatePresence>
              {submitMessage?.type === "error" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="text-[11px] text-red-400 px-1">{submitMessage.text}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Notes row — hidden in compact mode unless notesAlwaysVisible on mobile */}
            {((effectiveMobile && notesAlwaysVisible) || (!isCompact && (notesAlwaysVisible || showNotes))) && (
              <div className={`${isCompact ? 'pt-1.5' : 'pt-2'} border-t border-ink-light/20`}>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Session notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputBaseClass} ${inputNormalClass} !text-left !text-[11px] !py-1.5 flex-1 min-w-0`} />
                  {!effectiveMobile && !isCompact && (notesAlwaysVisible || showNotes) && (
                    <GlowButton onClick={handleSubmit} disabled={isSubmitting} variant="jade" size="sm" className="!px-4 !py-1.5 !text-[11px] font-semibold shrink-0">
                      {isSubmitting ? "..." : "Record"}
                    </GlowButton>
                  )}
                </div>
              </div>
            )}

            {/* Training History — hidden in compact mode */}
            <AnimatePresence>
              {!isCompact && showHistory && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="pt-3 border-t border-ink-light/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-semibold text-jade-glow uppercase tracking-wider">Training History — {exerciseDisplayName}</h4>
                      <button onClick={() => setShowHistory(false)} className="p-0.5 text-mist-dark hover:text-cloud-white transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    {historyLoading ? (
                      <div className="text-center py-3"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-jade-glow border-t-transparent rounded-full mx-auto" /></div>
                    ) : historyData.length === 0 ? (
                      <p className="text-[10px] text-mist-dark text-center py-3">No training sessions recorded for this technique yet.</p>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto overflow-x-auto sidebar-scroll">
                        <table className="w-full text-[10px] min-w-[400px]">
                          <thead className="sticky top-0 bg-ink-dark"><tr className="border-b border-ink-light/40 text-mist-dark"><th className="text-left py-1 px-1 font-semibold">Date</th>{(settings.columnOrderGrouped ? ["W1","W2","W3","R1","R2","R3"] : ["W1","R1","W2","R2","W3","R3"]).map(h => <th key={h} className="text-center py-1 px-0.5 font-semibold" style={(settings.columnColorsEnabled ?? true) && h.startsWith('W') ? { color: 'var(--col-weight)' } : (settings.columnColorsEnabled ?? true) && h.startsWith('R') ? { color: 'var(--col-reps)' } : undefined}>{h}</th>)}<th className="text-left py-1 px-1 font-semibold">Notes</th></tr></thead>
                          <tbody>
                            {historyData.map((entry) => {
                              const colTypes = settings.columnOrderGrouped
                                ? ['weight','weight','weight','reps','reps','reps'] as const
                                : ['weight','reps','weight','reps','weight','reps'] as const;
                              const fields = settings.columnOrderGrouped
                                ? [entry.weight1, entry.weight2, entry.weight3, entry.reps1, entry.reps2, entry.reps3]
                                : [entry.weight1, entry.reps1, entry.weight2, entry.reps2, entry.weight3, entry.reps3];
                              return (
                              <tr key={entry.id} className="border-b border-ink-light/20 hover:bg-ink-mid/10">
                                <td className="py-1 px-1 text-mist-light whitespace-nowrap">{formatDateWithPreference(new Date(entry.date), settings.dateFormat || "dd-mmm-yyyy")}</td>
                                {fields.map((v, i) => <td key={i} className="py-1 px-0.5 text-center text-cloud-white" style={(settings.columnColorsEnabled ?? true) && colTypes[i] === 'weight' ? { backgroundColor: 'var(--col-weight-bg)' } : (settings.columnColorsEnabled ?? true) && colTypes[i] === 'reps' ? { backgroundColor: 'var(--col-reps-bg)' } : undefined}>{v != null ? v : "—"}</td>)}
                                <td className="py-1 px-1 text-mist-dark truncate max-w-[80px]" title={entry.notes || ""}>{entry.notes || "—"}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
      /* ═══════════════ Default Style Card ═══════════════ */
      <div 
        className={`relative bg-ink-dark border border-ink-light rounded-lg transition-colors duration-200 hover:border-jade/30 overflow-hidden`}
        style={showIllumination && glowIntensity > 0 ? glowStyle as React.CSSProperties : undefined}
      >
        {/* Success overlay animation */}
        <AnimatePresence>
          {submitMessage?.type === "success" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-green-500/10 border border-green-500/30 rounded-lg z-20 flex items-center justify-center"
            >
              <motion.span 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-green-400 text-xs font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {submitMessage.text}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card content — sizing matches TechniqueManagementDrawer's TechniqueRow */}
        <div className={`${isCompact ? 'p-2.5' : 'p-4'} flex flex-col ${isCompact ? 'gap-1.5' : 'gap-3'}`}>

          {/* ── Header: Technique Identity + Actions ── */}
          <div className="flex items-start justify-between">
            <div className={`flex-1 ${isCompact ? 'space-y-0.5' : 'space-y-1.5'} min-w-0`}>
              <div className="flex items-center gap-1.5">
                <h3 className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold ${showIllumination ? difficultyColorClass : 'text-cloud-white'} truncate transition-colors duration-200 group-hover:brightness-110`}>
                  {exerciseDisplayName}
                </h3>
                {settings.terminologyMode === "fantasy" && exercise.name && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowConventionalName(!showConventionalName); }}
                    className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-200 ${showConventionalName ? 'bg-jade-glow/20 text-jade-glow border border-jade-glow/40' : 'bg-ink-light/30 text-mist-dark hover:text-mist-light hover:bg-ink-light/50 border border-ink-light/40'}`}
                    title="Show conventional name"
                  >
                    i
                  </button>
                )}
                {!isCompact && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleHistoryToggle(); }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-jade-deep/15 border border-jade-glow/20 text-jade-glow/70 hover:text-jade-glow hover:bg-jade-deep/30 hover:border-jade-glow/40 transition-all duration-200 shrink-0"
                    title="View training history"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[9px] font-medium">History</span>
                  </button>
                )}
              </div>
              {showConventionalName && settings.terminologyMode === "fantasy" && exercise.name && (
                <p className="text-[10px] text-mist-mid truncate">Conventional: {exercise.name}</p>
              )}
              {/* Realm + Path badges */}
              {!isCompact && (showRealm || showPath) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {showRealm && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${difficultyColorClass} border border-current/20`}>
                      {exercise.difficulty}
                    </span>
                  )}
                  {showPath && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor} border border-current/20 opacity-80`}>
                      {exercise.type}
                    </span>
                  )}
                  {exercise.targetGroup && (
                    <span className="text-[10px] text-mist-dark">
                      {exercise.targetGroup}
                    </span>
                  )}
                </div>
              )}
              {/* Compact: inline realm/path */}
              {isCompact && (showRealm || showPath) && (
                <div className="flex items-center gap-1.5">
                  {showRealm && (
                    <span className={`text-[9px] font-medium ${difficultyColorClass} opacity-70`}>
                      {exercise.difficulty}
                    </span>
                  )}
                  {showPath && (
                    <span className={`text-[9px] font-medium ${typeColor} opacity-60`}>
                      {exercise.type}
                    </span>
                  )}
                </div>
              )}
              {/* Lore / Story */}
              {!isCompact && loreVisible && showPath && exercise.story && (
                <p className="text-[11px] text-mist-mid leading-relaxed line-clamp-2">
                  {exercise.story}
                </p>
              )}
            </div>

            {/* Top-right actions */}
            <div className={`flex items-center ${isCompact ? 'gap-0.5' : 'gap-1'} shrink-0 ml-2`}>
              {!isCompact && !notesAlwaysVisible && !effectiveMobile && (
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className={`p-1 rounded transition-colors duration-200 ${showNotes ? 'text-amber-400 bg-amber-500/10' : 'text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10'}`}
                  title="Toggle notes"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button
                onClick={onRemove}
                className={`${isCompact ? 'p-0.5' : 'p-1'} rounded text-mist-dark hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200`}
                title="Remove technique"
              >
                <svg className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Set Inputs Section ── */}
          {!effectiveMobile ? (
            /* Desktop: horizontal inline sets */
            <div className={`${isCompact ? 'space-y-1' : 'space-y-2'}`}>
              {!isCompact && (
                <p className="text-[10px] font-semibold text-mist-dark uppercase tracking-wider">Training Sets</p>
              )}
              <div className={`flex items-center ${isCompact ? 'gap-1.5' : 'gap-2'}`}>
                {sets.map((set) => (
                  <div key={set.num} className={`flex items-center gap-1 bg-ink-deep/40 rounded-md ${isCompact ? 'px-1.5 py-1' : 'px-2 py-1.5'} flex-1 min-w-0`} style={{ flexBasis: 0 }}>
                    <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-mist-dark font-semibold shrink-0 uppercase`}>S{set.num}</span>
                    <input
                      type="number"
                      placeholder="Wt"
                      value={set.w}
                      onChange={(e) => { set.setW(e.target.value); setValidationErrors(p => ({ ...p, [set.wKey]: false })); }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={`${inputBaseClass} ${validationErrors[set.wKey] ? inputErrorClass : inputNormalClass} flex-1 min-w-0 ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`}
                      min="0"
                      max="10000"
                      step="any"
                    />
                    <span className={`text-mist-dark ${isCompact ? 'text-[9px]' : 'text-[10px]'} shrink-0`}>&times;</span>
                    <input
                      type="number"
                      placeholder="Reps"
                      value={set.r}
                      onChange={(e) => { set.setR(e.target.value); setValidationErrors(p => ({ ...p, [set.rKey]: false })); }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={`${inputBaseClass} ${validationErrors[set.rKey] ? inputErrorClass : inputNormalClass} flex-1 min-w-0 ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`}
                      min="1"
                      max="500"
                    />
                  </div>
                ))}

                {/* Record button inline when notes are hidden */}
                {(isCompact || !(notesAlwaysVisible || showNotes)) && (
                  <GlowButton
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    variant="jade"
                    size="sm"
                    className={isCompact ? "!px-3 !py-1 !text-[10px] font-semibold shrink-0" : "!px-4 !py-1.5 !text-[11px] font-semibold shrink-0"}
                  >
                    {isSubmitting ? "..." : isCompact ? "✓" : "Record"}
                  </GlowButton>
                )}
              </div>
            </div>
          ) : (
            /* Mobile: stacked set inputs */
            <div className={`${isCompact ? 'space-y-1' : 'space-y-2'}`}>
              {!isCompact && (
                <p className="text-[10px] font-semibold text-mist-dark uppercase tracking-wider">Training Sets</p>
              )}
              <div className={`grid grid-cols-3 ${isCompact ? 'gap-1' : 'gap-1.5'}`}>
                {sets.map((set) => (
                  <div key={set.num} className={`flex flex-col gap-1 bg-ink-deep/40 rounded-md ${isCompact ? 'p-1' : 'p-1.5'}`}>
                    <span className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} text-mist-dark font-semibold text-center uppercase`}>Set {set.num}</span>
                    <input
                      type="number"
                      placeholder="Weight"
                      value={set.w}
                      onChange={(e) => { set.setW(e.target.value); setValidationErrors(p => ({ ...p, [set.wKey]: false })); }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={`${inputBaseClass} ${validationErrors[set.wKey] ? inputErrorClass : inputNormalClass} w-full ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`}
                      min="0"
                      max="10000"
                      step="any"
                    />
                    <input
                      type="number"
                      placeholder="Reps"
                      value={set.r}
                      onChange={(e) => { set.setR(e.target.value); setValidationErrors(p => ({ ...p, [set.rKey]: false })); }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={`${inputBaseClass} ${validationErrors[set.rKey] ? inputErrorClass : inputNormalClass} w-full ${isCompact ? '!px-1 !py-0.5 !text-[10px]' : '!px-1.5 !py-1 !text-[11px]'}`}
                      min="1"
                      max="500"
                    />
                  </div>
                ))}
              </div>
              {/* Mobile record button */}
              <GlowButton
                onClick={handleSubmit}
                disabled={isSubmitting}
                variant="jade"
                size="sm"
                className={isCompact ? "w-full !py-1 !text-[10px] font-semibold" : "w-full !py-1.5 !text-[11px] font-semibold"}
              >
                {isSubmitting ? "..." : isCompact ? "✓ Record" : "⚔ Record Session"}
              </GlowButton>
            </div>
          )}

          {/* Mobile notes toggle */}
          {effectiveMobile && !isCompact && !notesAlwaysVisible && (
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`self-start px-2 py-0.5 rounded text-[10px] transition-all duration-200 ${showNotes ? 'text-amber-400 bg-amber-500/10' : 'text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10'}`}
            >
              {showNotes ? "Hide notes" : "Add notes"}
            </button>
          )}

          {/* Error message — below main row */}
          <AnimatePresence>
            {submitMessage?.type === "error" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="text-[11px] text-red-400 px-1">
                  {submitMessage.text}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notes row — always visible or expandable; on mobile respects notesAlwaysVisible even in compact */}
          {((effectiveMobile && notesAlwaysVisible) || (!isCompact && (notesAlwaysVisible || showNotes))) && (
            <div className={`${isCompact ? 'pt-1.5' : 'pt-2'} border-t border-ink-light/20`}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Session notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputBaseClass} ${inputNormalClass} !text-left !text-[11px] !py-1.5 flex-1 min-w-0`}
                />
                {!effectiveMobile && !isCompact && (notesAlwaysVisible || showNotes) && (
                  <GlowButton
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    variant="jade"
                    size="sm"
                    className="!px-4 !py-1.5 !text-[11px] font-semibold shrink-0"
                  >
                    {isSubmitting ? "..." : "Record"}
                  </GlowButton>
                )}
              </div>
            </div>
          )}

          {/* Training History — below notes, hidden in compact mode */}
          <AnimatePresence>
            {!isCompact && showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-3 border-t border-ink-light/20">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-semibold text-jade-glow uppercase tracking-wider">
                      Training History — {exerciseDisplayName}
                    </h4>
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-0.5 text-mist-dark hover:text-cloud-white transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {historyLoading ? (
                    <div className="text-center py-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-jade-glow border-t-transparent rounded-full mx-auto"
                      />
                    </div>
                  ) : historyData.length === 0 ? (
                    <p className="text-[10px] text-mist-dark text-center py-3">
                      No training sessions recorded for this technique yet.
                    </p>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto overflow-x-auto sidebar-scroll">
                      <table className="w-full text-[10px] min-w-[400px]">
                        <thead className="sticky top-0 bg-ink-dark">
                          <tr className="border-b border-ink-light/40 text-mist-dark">
                            <th className="text-left py-1 px-1 font-semibold">Date</th>
                            {(settings.columnOrderGrouped ? ["W1","W2","W3","R1","R2","R3"] : ["W1","R1","W2","R2","W3","R3"]).map(h => (
                              <th
                                key={h}
                                className="text-center py-1 px-0.5 font-semibold"
                                style={
                                  (settings.columnColorsEnabled ?? true) && h.startsWith('W')
                                    ? { color: 'var(--col-weight)' }
                                    : (settings.columnColorsEnabled ?? true) && h.startsWith('R')
                                      ? { color: 'var(--col-reps)' }
                                      : undefined
                                }
                              >{h}</th>
                            ))}
                            <th className="text-left py-1 px-1 font-semibold">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyData.map((entry) => {
                            const colTypes = settings.columnOrderGrouped
                              ? ['weight','weight','weight','reps','reps','reps'] as const
                              : ['weight','reps','weight','reps','weight','reps'] as const;
                            const fields = settings.columnOrderGrouped
                              ? [entry.weight1, entry.weight2, entry.weight3, entry.reps1, entry.reps2, entry.reps3]
                              : [entry.weight1, entry.reps1, entry.weight2, entry.reps2, entry.weight3, entry.reps3];
                            return (
                            <tr key={entry.id} className="border-b border-ink-light/20 hover:bg-ink-mid/10">
                              <td className="py-1 px-1 text-mist-light whitespace-nowrap">
                                {formatDateWithPreference(new Date(entry.date), settings.dateFormat || "dd-mmm-yyyy")}
                              </td>
                              {fields.map((v, i) => (
                                <td
                                  key={i}
                                  className="py-1 px-0.5 text-center text-cloud-white"
                                  style={
                                    (settings.columnColorsEnabled ?? true) && colTypes[i] === 'weight'
                                      ? { backgroundColor: 'var(--col-weight-bg)' }
                                      : (settings.columnColorsEnabled ?? true) && colTypes[i] === 'reps'
                                        ? { backgroundColor: 'var(--col-reps-bg)' }
                                        : undefined
                                  }
                                >{v != null ? v : "—"}</td>
                              ))}
                              <td className="py-1 px-1 text-mist-dark truncate max-w-[80px]" title={entry.notes || ""}>
                                {entry.notes || "—"}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}
    </motion.div>
  );
}