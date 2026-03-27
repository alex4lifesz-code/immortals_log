"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import {
  parseCategoryTags,
  formatResistanceBandLabel,
  formatModifierWeightLabel,
  RESISTANCE_BAND_OPTIONS,
  MODIFIER_WEIGHT_OPTIONS,
  parseModifierWithBand,
  buildModifierWithBand,
  isGymCategoryExercise,
  supportsResistanceBandAssistance,
  supportsBodyweightQuickFill,
  getDefaultVariationOptions,
  getWeightedDifficulty,
  getTierInputMode,
} from "@/app/dashboard/workout/utils";
import { EquipmentBadges } from "@/components/workout/EquipmentBadges";
import { getTierGlowFromLogs } from "@/components/workout/TierProgressBar";
import { useDisplaySettings, DISPLAY_DEFAULTS } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import { getTypeColor } from "@/lib/constants";
import { getDifficultyColorClass, getDifficultyGlowStyleScaled } from "@/lib/difficulty-styles";
import { getExerciseDisplayName, getTypeDisplayName, getDifficultyDisplayName, getTypeColorKey } from "@/lib/exercise-name";
import type { UserPhysiqueSettings } from "@/lib/user-physique";

export function InlineLogForm({
  queueItemId,
  exercise,
  selectedLevel,
  onSubmit,
  onChangeLevel,
  onDismiss,
  onViewDetail: _onViewDetail,
  onExit,
  draftStorageKey,
  physique,
  userId,
}: {
  queueItemId: string;
  exercise: ProgressionExercise;
  selectedLevel: number;
  onSubmit: (queueItemId: string, exerciseId: string, level: number, data: {
    weight1?: number; reps1?: number;
    weight2?: number; reps2?: number;
    weight3?: number; reps3?: number;
    holdTime?: number; holdTime2?: number; holdTime3?: number; modifier?: string; resistanceBandKg?: number; variant?: string; notes?: string;
  }) => Promise<void>;
  onChangeLevel: (exerciseId: string, level: number) => void;
  onDismiss: (queueItemId: string) => void;
  onViewDetail: (exerciseId: string) => void;
  onExit?: () => void;
  draftStorageKey?: string | null;
  physique: UserPhysiqueSettings;
  userId: string | null;
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
  const [selectedModifierKg, setSelectedModifierKg] = useState("");
  const [selectedResistanceBand, setSelectedResistanceBand] = useState("");
  const [selectedVariation, setSelectedVariation] = useState("");
  const [autoPopulated, setAutoPopulated] = useState<{ modifierKg: boolean; band: boolean; variation: boolean }>({ modifierKg: false, band: false, variation: false });
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [inputMode, setInputMode] = useState<"weight" | "hold">(() => getTierInputMode(exercise, selectedLevel));
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerElapsedMs, setTimerElapsedMs] = useState(0);
  const [timerTick, setTimerTick] = useState(0);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerTarget, setTimerTarget] = useState<"hold" | "hold2" | "hold3">("hold");
  const [timerReps, setTimerReps] = useState("");
  const [activeMobileSet, setActiveMobileSet] = useState<1 | 2 | 3>(1);
  const [draftReady, setDraftReady] = useState(false);
  const [latestCheckInWeightKg, setLatestCheckInWeightKg] = useState<number | null>(null);
  const prevDraftKeyRef = useRef<string | null>(null);
  const showHold = inputMode === "hold";
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();

  const mode = DISPLAY_DEFAULTS.progressionCardMode;
  const cardStyle = DISPLAY_DEFAULTS.progressionCardStyle;
  const isCompact = DISPLAY_DEFAULTS.progressionCardCompact;
  const glowIntensity = DISPLAY_DEFAULTS.glowIntensityProgressionCards;
  const loreVisible = DISPLAY_DEFAULTS.progressionCardLoreVisible;

  const _showIllumination = mode !== "name-only";
  const _showRealm = mode === "name-illumination-realm" || mode === "name-illumination-realm-path";
  const showPath = mode === "name-illumination-realm-path";
  const isScrollStyle = cardStyle === "scroll-card";

  const _diffColorClass = getDifficultyColorClass(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, undefined));
  const _glowStyle = getDifficultyGlowStyleScaled(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, undefined), glowIntensity);
  const currentDifficulty = getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, undefined);
  const currentDifficultyDisplay = getDifficultyDisplayName(
    { difficulty: currentDifficulty, wuxiaDifficulty: currentDifficulty },
    settings.terminologyMode
  ) || currentDifficulty;
  const displayName = getExerciseDisplayName(exercise, settings.terminologyMode);
  const typeKey = getTypeColorKey(exercise);
  const typeEmoji = typeKey === "Upper Heaven" ? "☁️"
    : typeKey === "Lower Realms" ? "🔥"
    : typeKey === "Heart Meridian" ? "💚"
    : "⭐";
  const isGymExercise = isGymCategoryExercise(exercise);
  const showResistanceBand = supportsResistanceBandAssistance(exercise);
  const showAddedWeight = supportsResistanceBandAssistance(exercise);
  const showBodyweightQuickFill = supportsBodyweightQuickFill(exercise);
  const canUseBwQuickFill = !showHold && showBodyweightQuickFill;
  const availableVariationOptions = useMemo(() => {
    const options = new Set<string>();

    for (const variation of exercise.variations ?? []) {
      const name = String(variation.name || "").trim();
      if (name) options.add(name);
    }

    const logs = exercise.userProgress?.flatMap((up) => up.logs) ?? [];
    for (const log of logs) {
      const variant = String(log.variant || "").trim();
      if (variant) options.add(variant);
    }

    const current = String(selectedVariation || "").trim();
    if (current) options.add(current);

    for (const fallbackOption of getDefaultVariationOptions(exercise)) {
      const value = String(fallbackOption || "").trim();
      if (value) options.add(value);
    }

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [exercise, exercise.variations, exercise.userProgress, selectedVariation]);

  const handleBackNavigation = useCallback(() => {
    if (onExit) {
      onExit();
      return;
    }
    onDismiss(queueItemId);
  }, [onDismiss, onExit, queueItemId]);

  const resetEntryFields = () => {
    setW1("");
    setR1("");
    setW2("");
    setR2("");
    setW3("");
    setR3("");
    setHold("");
    setHold2("");
    setHold3("");
    resetTimer();
    setActiveMobileSet(1);
  };

  const mobileWeightSets = [
    { id: 1 as const, title: "Set 1", primaryLabel: `Weight (${weightUnit})`, primaryValue: w1, setPrimary: setW1, secondaryLabel: "Reps", secondaryValue: r1, setSecondary: setR1 },
    { id: 2 as const, title: "Set 2", primaryLabel: `Weight (${weightUnit})`, primaryValue: w2, setPrimary: setW2, secondaryLabel: "Reps", secondaryValue: r2, setSecondary: setR2 },
    { id: 3 as const, title: "Set 3", primaryLabel: `Weight (${weightUnit})`, primaryValue: w3, setPrimary: setW3, secondaryLabel: "Reps", secondaryValue: r3, setSecondary: setR3 },
  ];

  const mobileHoldSets = [
    { id: 1 as const, title: "Set 1", primaryLabel: "Hold time (sec)", primaryValue: hold, setPrimary: setHold, secondaryLabel: "Work reps", secondaryValue: r1, setSecondary: setR1, timerKey: "hold" as const },
    { id: 2 as const, title: "Set 2", primaryLabel: "Hold time (sec)", primaryValue: hold2, setPrimary: setHold2, secondaryLabel: "Work reps", secondaryValue: r2, setSecondary: setR2, timerKey: "hold2" as const },
    { id: 3 as const, title: "Set 3", primaryLabel: "Hold time (sec)", primaryValue: hold3, setPrimary: setHold3, secondaryLabel: "Work reps", secondaryValue: r3, setSecondary: setR3, timerKey: "hold3" as const },
  ];

  const mobileSetConfigs = showHold ? mobileHoldSets : mobileWeightSets;

  const getMobileSetSummary = (setId: 1 | 2 | 3) => {
    if (showHold) {
      const holdValue = setId === 1 ? hold : setId === 2 ? hold2 : hold3;
      const repsValue = setId === 1 ? r1 : setId === 2 ? r2 : r3;
      return `${holdValue || "-"}s • ${repsValue || "-"} reps`;
    }

    const weightValue = setId === 1 ? w1 : setId === 2 ? w2 : w3;
    const repsValue = setId === 1 ? r1 : setId === 2 ? r2 : r3;
    return `${weightValue || "-"} ${weightUnit} • ${repsValue || "-"} reps`;
  };

  const mobilePanelBorder = `${getTierGlowFromLogs(exercise, physique.bodyWeightKg).glowColor}30`;
  const popupLoggerStyle = DISPLAY_DEFAULTS.popupLoggerStyle;
  const useSetPanelLayout = popupLoggerStyle === "classic";
  const useMinimalLayout = popupLoggerStyle === "minimal";
  const setInputClass = `w-full border bg-ink-dark text-cloud-white outline-none transition-all duration-200 placeholder:text-mist-dark/35 hover:border-jade-glow/40 hover:bg-ink-dark/80 focus:bg-ink-mid/40 focus:border-jade-glow/60 focus:shadow-[var(--glow-subtle)] ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`;

  useEffect(() => {
    setInputMode(getTierInputMode(exercise, selectedLevel));
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerElapsedMs(0);
    setTimerTick(0);
    setActiveMobileSet(1);
  }, [exercise, exercise.id, selectedLevel]);

  useEffect(() => {
    if (!canUseBwQuickFill || !userId) {
      setLatestCheckInWeightKg(null);
      return;
    }

    let cancelled = false;
    fetch("/api/checkins/latest-weight", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json() as { weight?: number | null };
        const parsed = typeof json.weight === "number" && Number.isFinite(json.weight) && json.weight > 0
          ? json.weight
          : null;
        if (!cancelled) setLatestCheckInWeightKg(parsed);
      })
      .catch(() => {
        if (!cancelled) setLatestCheckInWeightKg(null);
      });

    return () => {
      cancelled = true;
    };
  }, [canUseBwQuickFill, userId, exercise.id]);

  useEffect(() => {
    const draftKey = draftStorageKey ?? null;
    if (!draftKey) {
      setDraftReady(true);
      prevDraftKeyRef.current = null;
      return;
    }

    if (prevDraftKeyRef.current === draftKey && draftReady) return;

    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        setW1(typeof draft.w1 === "string" ? draft.w1 : "");
        setR1(typeof draft.r1 === "string" ? draft.r1 : "");
        setW2(typeof draft.w2 === "string" ? draft.w2 : "");
        setR2(typeof draft.r2 === "string" ? draft.r2 : "");
        setW3(typeof draft.w3 === "string" ? draft.w3 : "");
        setR3(typeof draft.r3 === "string" ? draft.r3 : "");
        setHold(typeof draft.hold === "string" ? draft.hold : "");
        setHold2(typeof draft.hold2 === "string" ? draft.hold2 : "");
        setHold3(typeof draft.hold3 === "string" ? draft.hold3 : "");
        setNotes(typeof draft.notes === "string" ? draft.notes : "");
        setSelectedModifierKg(typeof draft.selectedModifierKg === "string" ? draft.selectedModifierKg : "");
        setSelectedResistanceBand(typeof draft.selectedResistanceBand === "string" ? draft.selectedResistanceBand : "");
        setSelectedVariation(typeof draft.selectedVariation === "string" ? draft.selectedVariation : "");
        setWeightUnit(draft.weightUnit === "lbs" ? "lbs" : "kg");
        setInputMode(draft.inputMode === "hold" ? "hold" : "weight");
        setActiveMobileSet(draft.activeMobileSet === 2 || draft.activeMobileSet === 3 ? draft.activeMobileSet : 1);
      }
    } catch {
      // Ignore draft parse/storage errors.
    }

    prevDraftKeyRef.current = draftKey;
    setDraftReady(true);
  }, [draftStorageKey, draftReady]);

  // Pre-fill modifier, band, and variation from latest log when no draft values exist
  useEffect(() => {
    if (!draftReady) return;
    if (selectedModifierKg || selectedResistanceBand || selectedVariation) return;

    const logs = exercise.userProgress?.flatMap((up) => up.logs) ?? [];
    if (logs.length === 0) return;

    const sortedLogs = [...logs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latestLog = sortedLogs[0];
    if (!latestLog) return;

    const { resistanceBandKg, modifierWeightKg } = parseModifierWithBand(latestLog.modifier);
    const autoFlags = { modifierKg: false, band: false, variation: false };
    if (modifierWeightKg != null) { setSelectedModifierKg(String(modifierWeightKg)); autoFlags.modifierKg = true; }
    if (resistanceBandKg != null) { setSelectedResistanceBand(String(resistanceBandKg)); autoFlags.band = true; }
    if (latestLog.variant) { setSelectedVariation(latestLog.variant); autoFlags.variation = true; }
    if (autoFlags.modifierKg || autoFlags.band || autoFlags.variation) {
      setAutoPopulated(autoFlags);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, exercise.id]);

  useEffect(() => {
    if (!draftStorageKey || !draftReady) return;

    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          w1, r1, w2, r2, w3, r3, hold, hold2, hold3, notes,
          selectedModifierKg, selectedResistanceBand, selectedVariation,
          weightUnit, inputMode, activeMobileSet,
        })
      );
    } catch {
      // Ignore draft persistence failures.
    }
  }, [
    draftStorageKey, draftReady,
    w1, r1, w2, r2, w3, r3, hold, hold2, hold3, notes,
    selectedModifierKg, selectedResistanceBand, selectedVariation,
    weightUnit, inputMode, activeMobileSet,
  ]);

  useEffect(() => {
    if (!timerRunning || !showTimerModal) return;
    const id = window.setInterval(() => setTimerTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [showTimerModal, timerRunning]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleBackNavigation();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleBackNavigation]);

  useEffect(() => {
    const onPopState = () => {
      handleBackNavigation();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [handleBackNavigation]);

  const liveTimerMs = timerElapsedMs + (timerRunning && timerStartedAt ? (timerTick - timerStartedAt) : 0);
  const liveTimerSeconds = Math.max(0, Math.round(liveTimerMs / 1000));
  const timerMinutes = Math.floor(liveTimerSeconds / 60).toString().padStart(2, "0");
  const timerSeconds = (liveTimerSeconds % 60).toString().padStart(2, "0");
  const timerMillis = Math.max(0, Math.floor(liveTimerMs % 1000)).toString().padStart(3, "0");

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerElapsedMs(0);
    setTimerTick(0);
  };

  const getNextTimerTarget = (): "hold" | "hold2" | "hold3" => {
    if (!hold) return "hold";
    if (!hold2) return "hold2";
    return "hold3";
  };

  const closeTimerModal = () => {
    resetTimer();
    setShowTimerModal(false);
    setTimerTarget(getNextTimerTarget());
    setTimerReps("");
  };

  const handleTimerButton = () => {
    if (!timerRunning) {
      setTimerStartedAt(Date.now());
      setTimerTick(Date.now());
      setTimerRunning(true);
      return;
    }

    const now = Date.now();
    const totalMs = timerElapsedMs + (timerStartedAt ? now - timerStartedAt : 0);
    const seconds = Math.max(1, Math.round(totalMs / 1000));
    setTimerElapsedMs(totalMs);
    setTimerStartedAt(null);
    setTimerRunning(false);

    if (timerTarget === "hold") {
      setHold(String(seconds));
      if (timerReps.trim()) setR1(timerReps.trim());
      setTimerTarget("hold2");
    } else if (timerTarget === "hold2") {
      setHold2(String(seconds));
      if (timerReps.trim()) setR2(timerReps.trim());
      setTimerTarget("hold3");
    } else {
      setHold3(String(seconds));
      if (timerReps.trim()) setR3(timerReps.trim());
      setTimerTarget("hold3");
    }

    resetTimer();
    setTimerReps("");
    if (shakeError) setShakeError(false);
  };

  const handleSubmit = async () => {
    const primaryMissing = showHold ? (!hold && !r1) : (!w1 && !r1);
    if (primaryMissing) {
      setShakeError(true);
      return;
    }
    const hasData = w1 || r1 || w2 || r2 || w3 || r3 || hold || hold2 || hold3 || notes || selectedModifierKg || selectedResistanceBand || selectedVariation;
    if (!hasData) return;
    setSubmitting(true);
    setSaved(false);
    try {
      const toKg = (v: string): number => {
        const n = parseFloat(v);
        return weightUnit === "lbs" ? Math.round(n * 453.592) / 1000 : n;
      };
      const resistanceBandKg = selectedResistanceBand ? parseFloat(selectedResistanceBand) : undefined;
      const modifierWeightKg = selectedModifierKg ? parseFloat(selectedModifierKg) : undefined;
      await onSubmit(queueItemId, exercise.id, selectedLevel, {
        weight1: w1 ? toKg(w1) : undefined,
        reps1: r1 ? parseInt(r1) : undefined,
        weight2: w2 ? toKg(w2) : undefined,
        reps2: r2 ? parseInt(r2) : undefined,
        weight3: w3 ? toKg(w3) : undefined,
        reps3: r3 ? parseInt(r3) : undefined,
        holdTime: hold ? parseInt(hold) : undefined,
        holdTime2: hold2 ? parseInt(hold2) : undefined,
        holdTime3: hold3 ? parseInt(hold3) : undefined,
        modifier: buildModifierWithBand(null, resistanceBandKg, selectedLevel, modifierWeightKg) ?? undefined,
        resistanceBandKg: resistanceBandKg ?? undefined,
        variant: selectedVariation || undefined,
        notes: notes || undefined,
      });
      resetEntryFields();
      setNotes("");
      setSelectedModifierKg("");
      setSelectedResistanceBand("");
      setSelectedVariation("");
      if (draftStorageKey) {
        try {
          sessionStorage.removeItem(draftStorageKey);
        } catch {
          // Ignore draft cleanup failures.
        }
      }

      if (onExit) {
        onExit();
      } else {
        onDismiss(queueItemId);
      }

      setSaved(true);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const _tierName = getWeightedDifficulty(exercise, selectedLevel);
  const tierGlow = getTierGlowFromLogs(exercise, physique.bodyWeightKg);
  const diffStyle = { glowColor: tierGlow.glowColor };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div
        className={`relative overflow-hidden border-2 rounded-2xl rounded-tr-[26px] rounded-bl-[26px] ${isCompact ? 'p-2' : 'p-3'}`}
        style={{
          background: 'var(--ink-deep)',
          borderColor: `${diffStyle.glowColor}d0`,
          boxShadow: `0 0 20px ${diffStyle.glowColor}88, 0 0 40px ${diffStyle.glowColor}50, 0 0 70px ${diffStyle.glowColor}22, inset 0 0 16px ${diffStyle.glowColor}25, inset 0 0 0 1px ${diffStyle.glowColor}35, inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 7%, transparent)`,
        }}
      >
        {/* Tier accent stripe */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
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
            {showPath && exercise.type && (
              <span className={`text-[9px] font-medium px-1.5 py-0 rounded-full ${getTypeColor(typeKey)} bg-ink-dark/40 border border-current/15 shrink-0`}>
                {getTypeDisplayName(exercise, settings.terminologyMode)}
              </span>
            )}
            {showPath && <EquipmentBadges exercise={exercise} />}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleBackNavigation}
              className="text-mist-dark/60 hover:text-crimson-light transition-colors text-sm px-1.5 py-0.5 rounded hover:bg-crimson-deep/10"
              title="Back"
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

        {useSetPanelLayout ? (
          <div className={`pl-2 ${isMobile ? "space-y-3" : "space-y-2"}`}>
            <div className="grid gap-2">
              {/* Category & Type info */}
              <div className={`flex items-center gap-2 border border-ink-light/20 bg-ink-mid/15 ${isMobile ? "rounded-xl px-3 py-2" : "rounded-lg px-2.5 py-1.5"}`}>
                <span className={`${isMobile ? "text-[11px]" : "text-[10px]"} text-mist-light`}>
                  {parseCategoryTags(exercise.category)[0] || "Exercise"} • {exercise.weighted ? "Weighted" : exercise.bodyweight ? "Bodyweight" : "Timed"}
                </span>
              </div>

              <div className={`grid gap-2 ${showHold ? "grid-cols-1" : "grid-cols-2"}`}>
                {!showHold && (
                  <div className={`flex overflow-hidden border border-ink-light/30 ${isMobile ? "rounded-xl" : "rounded-lg"}`}>
                    <button
                      onClick={() => setWeightUnit("kg")}
                      className={`flex-1 font-semibold transition-all duration-200 border-r border-ink-light/30 ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                        weightUnit === "kg"
                          ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[var(--glow-subtle)]"
                          : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                      }`}
                    >
                      KG
                    </button>
                    <button
                      onClick={() => setWeightUnit("lbs")}
                      className={`flex-1 font-semibold transition-all duration-200 ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                        weightUnit === "lbs"
                          ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[var(--glow-subtle)]"
                          : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                      }`}
                    >
                      LBS
                    </button>
                  </div>
                )}

                <div className={`flex overflow-hidden border border-ink-light/30 ${isMobile ? "rounded-xl" : "rounded-lg"}`}>
                  <button
                    onClick={() => { setInputMode("weight"); resetEntryFields(); }}
                    className={`flex-1 font-semibold transition-all duration-200 border-r ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                      inputMode === "weight"
                        ? "bg-jade-deep/55 text-cloud-white border-jade/40 shadow-[var(--glow-subtle)]"
                        : "bg-ink-mid/60 text-mist-light border-ink-light/30 hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    Weight
                  </button>
                  <button
                    onClick={() => { setInputMode("hold"); resetEntryFields(); }}
                    className={`flex-1 font-semibold transition-all duration-200 ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                      inputMode === "hold"
                        ? "bg-mountain-blue/30 text-cloud-white shadow-[var(--glow-blue)]"
                        : "bg-ink-mid/60 text-mist-light hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    Hold
                  </button>
                </div>
              </div>

            </div>

            {(showAddedWeight || showResistanceBand || availableVariationOptions.length > 0) && (
              <div className="grid gap-2">
                {showAddedWeight && (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">
                      Added Weight{autoPopulated.modifierKg && <span className="text-gold/70 ml-0.5" title="Pre-filled from last session">*</span>}
                    </span>
                    <select
                      value={selectedModifierKg}
                      onChange={(e) => { setSelectedModifierKg(e.target.value); setAutoPopulated(prev => ({ ...prev, modifierKg: false })); }}
                      className={`w-full border border-ink-light/20 bg-ink-dark text-gold outline-none focus:border-gold/40 transition-colors cursor-pointer ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
                    >
                      <option value="">No added weight</option>
                      {MODIFIER_WEIGHT_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          {formatModifierWeightLabel(kg)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {showResistanceBand && (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">
                      Resistance band{autoPopulated.band && <span className="text-mountain-blue-glow/70 ml-0.5" title="Pre-filled from last session">*</span>}
                    </span>
                    <select
                      value={selectedResistanceBand}
                      onChange={(e) => { setSelectedResistanceBand(e.target.value); setAutoPopulated(prev => ({ ...prev, band: false })); }}
                      className={`w-full border border-ink-light/20 bg-ink-dark text-mountain-blue-glow outline-none focus:border-mountain-blue-glow/40 transition-colors cursor-pointer ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
                    >
                      <option value="">No resistance band</option>
                      {RESISTANCE_BAND_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          Resistance band {formatResistanceBandLabel(kg)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {availableVariationOptions.length > 0 && (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">
                      Variation{autoPopulated.variation && <span className="text-crimson-light/70 ml-0.5" title="Pre-filled from last session">*</span>}
                    </span>
                    <select
                      value={selectedVariation}
                      onChange={(e) => { setSelectedVariation(e.target.value); setAutoPopulated(prev => ({ ...prev, variation: false })); }}
                      className={`w-full border border-ink-light/20 bg-ink-dark text-crimson-light outline-none focus:border-crimson/40 transition-colors cursor-pointer ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
                    >
                      <option value="">No variation</option>
                      {availableVariationOptions.map((variationName) => (
                        <option key={variationName} value={variationName}>
                          {variationName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            <div
              className={isMobile ? "space-y-2" : "grid gap-2"}
              style={isMobile ? undefined : { gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
            >
              {mobileSetConfigs.map((setConfig) => {
                const isOpen = isMobile ? activeMobileSet === setConfig.id : true;
                return (
                  <div
                    key={setConfig.id}
                    className={`overflow-hidden border bg-ink-dark/55 ${isMobile ? "rounded-2xl" : "rounded-xl"}`}
                    style={{
                      borderColor: isOpen ? `${diffStyle.glowColor}55` : mobilePanelBorder,
                      boxShadow: isOpen ? `0 0 18px ${diffStyle.glowColor}22` : "none",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isMobile) setActiveMobileSet(setConfig.id);
                      }}
                      className={`flex w-full items-center justify-between gap-3 text-left ${isMobile ? "px-3 py-3" : "px-2.5 py-2"}`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist-dark">{setConfig.title}</div>
                        <div className={`mt-1 font-medium text-cloud-white ${isMobile ? "text-sm" : "text-xs"}`}>{getMobileSetSummary(setConfig.id)}</div>
                      </div>
                      {isMobile && (
                        <span className="text-lg leading-none" style={{ color: diffStyle.glowColor }}>
                          {isOpen ? "−" : "+"}
                        </span>
                      )}
                    </button>

                    {isOpen && (
                      <div className={`border-t ${isMobile ? "space-y-3 px-3 py-3" : "space-y-2 px-2.5 py-2"}`} style={{ borderColor: `${diffStyle.glowColor}22` }}>
                        {showHold && "timerKey" in setConfig && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowTimerModal(true);
                              setTimerTarget(setConfig.timerKey as "hold" | "hold2" | "hold3");
                              setTimerReps("");
                              resetTimer();
                            }}
                            className={`w-full border font-bold text-cloud-white transition-all ${isMobile ? "rounded-xl px-3 py-2.5 text-[11px]" : "rounded-lg px-2.5 py-2 text-[10px]"}`}
                            style={{
                              background: "var(--timed-accent-soft)",
                              borderColor: "var(--timed-accent-border)",
                              boxShadow: `0 0 10px ${diffStyle.glowColor}33`,
                            }}
                          >
                            Use Timer for {setConfig.title.replace("Set", "T")}
                          </button>
                        )}

                        <div className={`grid grid-cols-2 ${isMobile ? "gap-2" : "gap-1.5"}`}>
                          <label className="block space-y-1">
                            <div className="flex items-center justify-between min-h-[18px]">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">{setConfig.primaryLabel}</span>
                              {canUseBwQuickFill && latestCheckInWeightKg != null && (
                                <button
                                  type="button"
                                  onClick={() => setConfig.setPrimary(String(latestCheckInWeightKg))}
                                  className="text-[9px] font-bold px-2 py-1 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[var(--glow-jade)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                                  title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}
                                >
                                  BW
                                </button>
                              )}
                            </div>
                            <input
                              type="number"
                              min="0"
                              step={showHold ? undefined : "0.5"}
                              max={showHold ? undefined : undefined}
                              value={setConfig.primaryValue}
                              onChange={(e) => {
                                setConfig.setPrimary(e.target.value);
                                if (shakeError && setConfig.id === 1) setShakeError(false);
                              }}
                              placeholder={showHold ? "sec" : "0.0"}
                              className={`${setInputClass}${shakeError && setConfig.id === 1 ? ' animate-shake' : ''}`}
                              style={{
                                borderColor: shakeError && setConfig.id === 1
                                  ? "var(--state-error-border)"
                                  : showHold
                                    ? "color-mix(in srgb, var(--mountain-blue-glow) 45%, transparent)"
                                    : `${diffStyle.glowColor}55`,
                              }}
                            />
                          </label>

                          <label className="block space-y-1">
                            <div className="flex items-center justify-between min-h-[18px]">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">{setConfig.secondaryLabel}</span>
                              <span className="invisible text-[9px] font-bold px-2 py-1">BW</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={setConfig.secondaryValue}
                              onChange={(e) => {
                                setConfig.setSecondary(e.target.value);
                                if (shakeError && setConfig.id === 1) setShakeError(false);
                              }}
                              placeholder="reps"
                              className={`${setInputClass}${shakeError && setConfig.id === 1 ? ' animate-shake' : ''}`}
                              style={{ borderColor: shakeError && setConfig.id === 1 ? "var(--state-error-border)" : "color-mix(in srgb, var(--gold) 35%, transparent)" }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Session notes, cues, or pain markers..."
                rows={isMobile ? 3 : 2}
                className={`w-full border border-ink-light/20 bg-ink-dark text-cloud-white outline-none transition-all duration-200 placeholder:text-mist-dark/40 focus:border-mist-mid/30 focus:bg-ink-mid/30 ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
              />
            </label>

            <div className="flex flex-col gap-2 pt-1">
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="self-end text-xs font-medium"
                  style={{ color: diffStyle.glowColor }}
                >
                  ✦ Saved
                </motion.span>
              )}

              <div className={`grid gap-2 ${showHold ? "grid-cols-2" : "grid-cols-1"}`}>
                {showHold && (
                  <button
                    type="button"
                    onClick={() => { setShowTimerModal(true); setTimerTarget(getNextTimerTarget()); setTimerReps(""); resetTimer(); }}
                    className={`border font-bold text-cloud-white transition-all ${isMobile ? "rounded-xl px-3 py-3 text-[11px]" : "rounded-lg px-2.5 py-2 text-[10px]"}`}
                    style={{
                      background: "var(--timed-accent-soft)",
                      borderColor: "var(--timed-accent-border)",
                      boxShadow: `0 0 12px ${diffStyle.glowColor}44`,
                    }}
                    title="Open compact hold timer"
                  >
                    Start Timer
                  </button>
                )}

                <motion.button
                  onClick={handleSubmit}
                  disabled={submitting}
                  animate={saved ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                  whileTap={!submitting ? { scale: 0.98 } : {}}
                  transition={{ duration: 0.3 }}
                  className={`w-full font-semibold disabled:opacity-40 cursor-pointer ${isMobile ? "rounded-xl px-4 py-3 text-sm" : "rounded-lg px-3 py-2 text-xs"}`}
                  style={{
                    background: saved ? `${diffStyle.glowColor}30` : `${diffStyle.glowColor}18`,
                    border: `1px solid ${saved ? `${diffStyle.glowColor}60` : `${diffStyle.glowColor}35`}`,
                    color: diffStyle.glowColor,
                    transition: 'background 0.3s, border-color 0.3s',
                  }}
                >
                  {submitting ? "Saving…" : saved ? "✦ Logged!" : "Log Training Data"}
                </motion.button>
              </div>
            </div>
          </div>
        ) : useMinimalLayout ? (
          /* ── Minimal Layout: Vertical stacked sets ── */
          <div className="pl-2 space-y-2">
            <div className="flex items-center gap-2 border border-ink-light/20 bg-ink-mid/15 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] text-mist-light">
                {parseCategoryTags(exercise.category)[0] || "Exercise"} • {exercise.weighted ? "Weighted" : exercise.bodyweight ? "Bodyweight" : "Timed"}
              </span>
            </div>

            <div className="flex gap-2">
              {!showHold && (
                <div className="flex rounded-lg overflow-hidden border border-ink-light/30 flex-1">
                  <button onClick={() => setWeightUnit("kg")} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all ${weightUnit === "kg" ? "bg-jade-deep/70 text-cloud-white" : "bg-ink-mid/55 text-mist-light"}`}>KG</button>
                  <button onClick={() => setWeightUnit("lbs")} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all border-l border-ink-light/30 ${weightUnit === "lbs" ? "bg-jade-deep/70 text-cloud-white" : "bg-ink-mid/55 text-mist-light"}`}>LBS</button>
                </div>
              )}
              <div className="flex rounded-lg overflow-hidden border border-ink-light/30 flex-1">
                <button onClick={() => { setInputMode("weight"); resetEntryFields(); }} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all ${inputMode === "weight" ? "bg-jade-deep/55 text-cloud-white" : "bg-ink-mid/60 text-mist-light"}`}>Weight</button>
                <button onClick={() => { setInputMode("hold"); resetEntryFields(); }} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all border-l border-ink-light/30 ${inputMode === "hold" ? "bg-mountain-blue/30 text-cloud-white" : "bg-ink-mid/60 text-mist-light"}`}>Hold</button>
              </div>
            </div>

            {[
              { id: 1, vLabel: showHold ? "T1" : "W1", rLabel: "R1", vGet: showHold ? hold : w1, vSet: showHold ? setHold : setW1, rGet: r1, rSet: setR1 },
              { id: 2, vLabel: showHold ? "T2" : "W2", rLabel: "R2", vGet: showHold ? hold2 : w2, vSet: showHold ? setHold2 : setW2, rGet: r2, rSet: setR2 },
              { id: 3, vLabel: showHold ? "T3" : "W3", rLabel: "R3", vGet: showHold ? hold3 : w3, vSet: showHold ? setHold3 : setW3, rGet: r3, rSet: setR3 },
            ].map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold w-5 text-right" style={{ color: diffStyle.glowColor }}>{s.vLabel}</span>
                <input
                  type="number" min="0" step={showHold ? undefined : "0.5"}
                  value={s.vGet} onChange={(e) => { s.vSet(e.target.value); if (shakeError && s.id === 1) setShakeError(false); }}
                  placeholder={showHold ? "sec" : "0.0"}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs text-center outline-none bg-ink-dark border text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40${shakeError && s.id === 1 ? " animate-shake" : ""}`}
                  style={{ borderColor: shakeError && s.id === 1 ? "var(--state-error-border)" : showHold ? "color-mix(in srgb, var(--mountain-blue-glow) 30%, transparent)" : `${diffStyle.glowColor}40` }}
                />
                {canUseBwQuickFill && latestCheckInWeightKg != null && (
                  <button
                    type="button"
                    onClick={() => s.vSet(String(latestCheckInWeightKg))}
                    className="text-[9px] font-bold px-2 py-1 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[var(--glow-jade)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150 shrink-0"
                    title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}
                  >
                    BW
                  </button>
                )}
                <span className="text-[10px] font-bold w-5 text-right text-gold/80">{s.rLabel}</span>
                <input
                  type="number" min="0" max="500"
                  value={s.rGet} onChange={(e) => { s.rSet(e.target.value); if (shakeError && s.id === 1) setShakeError(false); }}
                  placeholder="—"
                  className={`w-16 rounded-lg px-2 py-2 text-xs text-center outline-none bg-ink-dark border text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError && s.id === 1 ? " animate-shake" : ""}`}
                  style={{ borderColor: shakeError && s.id === 1 ? "var(--state-error-border)" : "color-mix(in srgb, var(--gold) 20%, transparent)" }}
                />
              </div>
            ))}

            {(showAddedWeight || showResistanceBand || availableVariationOptions.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {showAddedWeight && (
                  <select value={selectedModifierKg} onChange={(e) => setSelectedModifierKg(e.target.value)} className="bg-ink-dark border border-ink-light/20 rounded-lg px-2 py-1.5 text-[10px] text-gold outline-none cursor-pointer">
                    <option value="">+Wt: none</option>
                    {MODIFIER_WEIGHT_OPTIONS.map((kg) => <option key={kg} value={String(kg)}>{formatModifierWeightLabel(kg)}</option>)}
                  </select>
                )}
                {showResistanceBand && (
                  <select value={selectedResistanceBand} onChange={(e) => setSelectedResistanceBand(e.target.value)} className="bg-ink-dark border border-ink-light/20 rounded-lg px-2 py-1.5 text-[10px] text-mountain-blue-glow outline-none cursor-pointer">
                    <option value="">Band: none</option>
                    {RESISTANCE_BAND_OPTIONS.map((kg) => <option key={kg} value={String(kg)}>{kg}kg</option>)}
                  </select>
                )}
                {availableVariationOptions.length > 0 && (
                  <select value={selectedVariation} onChange={(e) => setSelectedVariation(e.target.value)} className="bg-ink-dark border border-ink-light/20 rounded-lg px-2 py-1.5 text-[10px] text-crimson-light outline-none cursor-pointer">
                    <option value="">Var: none</option>
                    {availableVariationOptions.map((variationName) => <option key={variationName} value={variationName}>{variationName}</option>)}
                  </select>
                )}
              </div>
            )}

            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..."
              className="w-full rounded-lg px-2.5 py-2 text-xs outline-none bg-ink-dark border border-ink-light/20 text-cloud-white placeholder:text-mist-dark/40 focus:border-mist-mid/30" />

            <div className="flex gap-2">
              {showHold && (
                <button type="button" onClick={() => { setShowTimerModal(true); setTimerTarget(getNextTimerTarget()); setTimerReps(""); resetTimer(); }}
                  className="flex-1 py-2 rounded-lg border text-[10px] font-bold text-cloud-white transition-all"
                  style={{ background: "var(--timed-accent-soft)", borderColor: "var(--timed-accent-border)" }}>
                  Timer
                </button>
              )}
              <motion.button onClick={handleSubmit} disabled={submitting}
                whileTap={!submitting ? { scale: 0.97 } : {}}
                className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 cursor-pointer"
                style={{ background: `${diffStyle.glowColor}18`, border: `1px solid ${diffStyle.glowColor}35`, color: diffStyle.glowColor }}>
                {submitting ? "Saving…" : saved ? "✦ Logged!" : "Log Set"}
              </motion.button>
            </div>
          </div>
        ) : (
          <>
            {/* Controls row: Category info + Modifiers */}
            <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
              <div className="flex items-center gap-2 border border-ink-light/20 bg-ink-mid/15 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] text-mist-light">
                  {parseCategoryTags(exercise.category)[0] || "Exercise"} • {exercise.weighted ? "Weighted" : exercise.bodyweight ? "Bodyweight" : "Timed"}
                </span>
              </div>
              <div className="flex-1" />

              {!showHold && (
                <div className="flex rounded-md overflow-hidden border border-ink-light/30">
                  <button
                    onClick={() => setWeightUnit("kg")}
                    className={`px-2 py-1 text-[10px] font-semibold transition-all duration-200 border-r border-ink-light/30 ${
                      weightUnit === "kg"
                        ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[var(--glow-subtle)]"
                        : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    kg
                  </button>
                  <button
                    onClick={() => setWeightUnit("lbs")}
                    className={`px-2 py-1 text-[10px] font-semibold transition-all duration-200 ${
                      weightUnit === "lbs"
                        ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[var(--glow-subtle)]"
                        : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    lbs
                  </button>
                </div>
              )}

              <div className="flex rounded-md overflow-hidden border border-ink-light/30">
                <button
                  onClick={() => { setInputMode("weight"); resetEntryFields(); }}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 border-r ${
                    inputMode === "weight"
                      ? "bg-jade-deep/55 text-cloud-white border-jade/40 shadow-[var(--glow-subtle)]"
                      : "bg-ink-mid/60 text-mist-light border-ink-light/30 hover:bg-ink-mid/80 hover:text-cloud-white"
                  }`}
                >
                  Weight
                </button>
                <button
                  onClick={() => { setInputMode("hold"); resetEntryFields(); }}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 ${
                    inputMode === "hold"
                      ? "bg-mountain-blue/30 text-cloud-white shadow-[var(--glow-blue)]"
                      : "bg-ink-mid/60 text-mist-light hover:bg-ink-mid/80 hover:text-cloud-white"
                  }`}
                >
                  Hold
                </button>
              </div>

            </div>

            {(showAddedWeight || showResistanceBand || availableVariationOptions.length > 0) && (
              <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
                {showAddedWeight && (
                  <div className="relative">
                    <select
                      value={selectedModifierKg}
                      onChange={(e) => { setSelectedModifierKg(e.target.value); setAutoPopulated(prev => ({ ...prev, modifierKg: false })); }}
                      className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-gold outline-none focus:border-gold/40 transition-colors cursor-pointer"
                    >
                      <option value="">No added weight</option>
                      {MODIFIER_WEIGHT_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          {formatModifierWeightLabel(kg)}
                        </option>
                      ))}
                    </select>
                    {autoPopulated.modifierKg && <span className="absolute -top-1.5 -right-1 text-[10px] text-gold/70" title="Pre-filled from last session">*</span>}
                  </div>
                )}
                {showResistanceBand && (
                  <div className="relative">
                    <select
                      value={selectedResistanceBand}
                      onChange={(e) => { setSelectedResistanceBand(e.target.value); setAutoPopulated(prev => ({ ...prev, band: false })); }}
                      className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-mountain-blue-glow outline-none focus:border-mountain-blue-glow/40 transition-colors cursor-pointer"
                    >
                      <option value="">No resistance band</option>
                      {RESISTANCE_BAND_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          Resistance band {formatResistanceBandLabel(kg)}
                        </option>
                      ))}
                    </select>
                    {autoPopulated.band && <span className="absolute -top-1.5 -right-1 text-[10px] text-mountain-blue-glow/70" title="Pre-filled from last session">*</span>}
                  </div>
                )}
                {availableVariationOptions.length > 0 && (
                  <div className="relative">
                    <select
                      value={selectedVariation}
                      onChange={(e) => { setSelectedVariation(e.target.value); setAutoPopulated(prev => ({ ...prev, variation: false })); }}
                      className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-crimson-light outline-none focus:border-crimson/40 transition-colors cursor-pointer"
                    >
                      <option value="">No variation</option>
                      {availableVariationOptions.map((variationName) => (
                        <option key={variationName} value={variationName}>
                          {variationName}
                      </option>
                    ))}
                  </select>
                    {autoPopulated.variation && <span className="absolute -top-1.5 -right-1 text-[10px] text-crimson-light/70" title="Pre-filled from last session">*</span>}
                  </div>
                )}
              </div>
            )}

            <div className="pl-2">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, 1fr) 1.5fr" }}>
                {!showHold ? (
                  <>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>W1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>R1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>W2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>R2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>W3</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>R3</div>
                  </>
                ) : (
                  <>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>T1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>W1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>T2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>W2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>T3</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>W3</div>
                  </>
                )}
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold text-mist-dark/50 pb-0.5">Notes</div>

                {canUseBwQuickFill && latestCheckInWeightKg != null && (
                  <>
                    <button type="button" onClick={() => setW1(String(latestCheckInWeightKg))}
                      className="text-[9px] font-bold px-1 py-0.5 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[var(--glow-jade)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                      title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}>BW</button>
                    <div />
                    <button type="button" onClick={() => setW2(String(latestCheckInWeightKg))}
                      className="text-[9px] font-bold px-1 py-0.5 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[var(--glow-jade)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                      title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}>BW</button>
                    <div />
                    <button type="button" onClick={() => setW3(String(latestCheckInWeightKg))}
                      className="text-[9px] font-bold px-1 py-0.5 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[var(--glow-jade)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                      title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}>BW</button>
                    <div />
                    <div />
                  </>
                )}

                {!showHold ? (
                  <>
                    <input type="number" min="0" step="0.5" value={w1} onChange={(e) => { setW1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={{ borderColor: shakeError ? 'var(--state-error-border)' : `${diffStyle.glowColor}40` }} />
                    <input type="number" min="0" max="500" value={r1} onChange={(e) => { setR1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={{ borderColor: shakeError ? 'var(--state-error-border)' : 'color-mix(in srgb, var(--gold) 15%, transparent)' }} />
                    <input type="number" min="0" step="0.5" value={w2} onChange={(e) => setW2(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40"
                      style={{ borderColor: `${diffStyle.glowColor}40` }} />
                    <input type="number" min="0" max="500" value={r2} onChange={(e) => setR2(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'color-mix(in srgb, var(--gold) 15%, transparent)' }} />
                    <input type="number" min="0" step="0.5" value={w3} onChange={(e) => setW3(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40"
                      style={{ borderColor: `${diffStyle.glowColor}40` }} />
                    <input type="number" min="0" max="500" value={r3} onChange={(e) => setR3(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'color-mix(in srgb, var(--gold) 15%, transparent)' }} />
                  </>
                ) : (
                  <>
                    <input type="number" min="0" value={hold} onChange={(e) => { setHold(e.target.value); if (shakeError) setShakeError(false); }} placeholder="s"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-mountain-blue/20 text-cloud-white placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={shakeError ? { borderColor: 'var(--state-error-border)' } : undefined} />
                    <input type="number" min="0" max="500" value={r1} onChange={(e) => { setR1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={{ borderColor: shakeError ? 'var(--state-error-border)' : 'color-mix(in srgb, var(--gold) 15%, transparent)' }} />
                    <input type="number" min="0" value={hold2} onChange={(e) => setHold2(e.target.value)} placeholder="s"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-mountain-blue/20 text-cloud-white placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40" />
                    <input type="number" min="0" max="500" value={r2} onChange={(e) => setR2(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'color-mix(in srgb, var(--gold) 15%, transparent)' }} />
                    <input type="number" min="0" value={hold3} onChange={(e) => setHold3(e.target.value)} placeholder="s"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-mountain-blue/20 text-cloud-white placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40" />
                    <input type="number" min="0" max="500" value={r3} onChange={(e) => setR3(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'color-mix(in srgb, var(--gold) 15%, transparent)' }} />
                  </>
                )}
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..."
                  className="w-full rounded-md px-1.5 py-1.5 text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/20 text-cloud-white placeholder:text-mist-dark/40 focus:border-mist-mid/30 focus:bg-ink-mid/30" />
              </div>
            </div>

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
              {showHold && (
                <button
                  type="button"
                  onClick={() => { setShowTimerModal(true); setTimerTarget(getNextTimerTarget()); setTimerReps(""); resetTimer(); }}
                  className="px-3 py-1.5 text-[10px] font-bold rounded-md border text-cloud-white bg-mountain-blue/35 hover:bg-mountain-blue/45 border-mountain-blue-glow/70 shadow-[var(--glow-blue)] hover:shadow-[var(--glow-blue)] transition-all"
                  style={{ boxShadow: `0 0 10px ${diffStyle.glowColor}66, inset 0 0 0 1px ${diffStyle.glowColor}40` }}
                  title="Open compact hold timer"
                >
                  Start Timer
                </button>
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
          </>
        )}

        {showTimerModal && showHold && (
          <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-[2px] p-2" onClick={closeTimerModal}>
            <div
              className="w-full max-w-[300px] rounded-lg border bg-ink-deep/95 p-3"
              style={{
                borderColor: `${diffStyle.glowColor}80`,
                boxShadow: `0 0 20px ${diffStyle.glowColor}40, var(--shadow-elev-2), inset 0 0 0 1px ${diffStyle.glowColor}20`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: diffStyle.glowColor }}>Hold Timer</p>
                <button
                  type="button"
                  onClick={closeTimerModal}
                  className="text-mist-dark hover:text-mist-light text-xs px-1"
                  title="Close timer"
                >
                  ✕
                </button>
              </div>

              <div className="flex rounded-md border overflow-hidden mb-2" style={{ borderColor: `${diffStyle.glowColor}55` }}>
                {([
                  { key: "hold", label: "T1", rep: "R1" },
                  { key: "hold2", label: "T2", rep: "R2" },
                  { key: "hold3", label: "T3", rep: "R3" },
                ] as const).map((slot, idx) => (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => setTimerTarget(slot.key)}
                    className={`flex-1 py-1 text-[10px] font-semibold text-center ${idx > 0 ? "border-l border-ink-light/30" : ""}`}
                    style={slot.key === timerTarget ? {
                      background: `${diffStyle.glowColor}2e`,
                      color: diffStyle.glowColor,
                    } : { color: "var(--mist-dark)" }}
                  >
                    <div>{slot.label}</div>
                    <div className="text-[9px] opacity-80">
                      {slot.key === "hold"
                        ? `${hold || "-"}s${r1 ? ` • ${r1}r` : ""}`
                        : slot.key === "hold2"
                          ? `${hold2 || "-"}s${r2 ? ` • ${r2}r` : ""}`
                          : `${hold3 || "-"}s${r3 ? ` • ${r3}r` : ""}`}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mb-2">
                <span className="block text-center sm:text-left text-[12px] font-mono font-semibold mb-2" style={{ color: diffStyle.glowColor }}>{timerMinutes}:{timerSeconds}.{timerMillis}</span>
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-mist-dark block mb-1">
                  Reps for {timerTarget === "hold" ? "R1" : timerTarget === "hold2" ? "R2" : "R3"} (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={timerReps}
                  onChange={(e) => setTimerReps(e.target.value)}
                  placeholder="—"
                  className="w-full rounded border border-ink-light/30 bg-ink-dark px-2 py-1 text-xs text-gold outline-none focus:border-gold/50"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetTimer}
                  className="flex-1 py-1 rounded border border-ink-light/30 text-[10px] text-mist-dark hover:text-mist-light"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleTimerButton}
                  className={`flex-1 py-1 rounded border text-[10px] font-semibold transition-all ${timerRunning ? "text-crimson-light border-crimson/50 bg-crimson-deep/20 shadow-[var(--glow-crimson)]" : ""}`}
                  style={!timerRunning ? {
                    borderColor: `${diffStyle.glowColor}88`,
                    background: `${diffStyle.glowColor}26`,
                    color: diffStyle.glowColor,
                  } : undefined}
                >
                  {timerRunning ? "Stop Timer" : "Start Timer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
