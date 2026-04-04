"use client";

import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import { parseTips, parseCategoryTags, getWeightedDifficulty, getExerciseIcon } from "@/app/dashboard/workout/utils";
import { EquipmentBadges, LevelStatus } from "@/components/workout/EquipmentBadges";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { getDifficultyColor, getTypeColor } from "@/lib/constants";
import { getDifficultyColorClass } from "@/lib/difficulty-styles";
import { getExerciseDisplayName, getTypeDisplayName, getDifficultyDisplayName, getDifficultyColorKey, getTypeColorKey } from "@/lib/exercise-name";
import { GlowModal } from "@/components/ui/GlowCard";

export function ExerciseInfoModal({
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
  const currentTierName = exercise.tiers.find((tier) => tier.level === currentLevel)?.name?.trim() || "Unassigned progression";

  const modalDiffKey = getWeightedDifficulty(exercise, currentLevel);
  const modalDiffDisplay = getDifficultyDisplayName(exercise, settings.terminologyMode) || modalDiffKey;
  const diffColorClass = getDifficultyColorClass(modalDiffKey);
  const primaryMuscles = exercise.primaryMuscles.split(",").map((m) => m.trim()).filter(Boolean);
  const secondaryMuscles = exercise.secondaryMuscles.split(",").map((m) => m.trim()).filter(Boolean);
  const categoryTags = parseCategoryTags(exercise.category);
  const completionRate = totalTiers > 0 ? Math.round((completedTiers / totalTiers) * 100) : 0;

  return (
    <GlowModal
      isOpen={isOpen}
      onClose={onClose}
      title={getExerciseDisplayName(exercise, settings.terminologyMode)}
      panelClassName="!max-w-3xl"
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-jade/25 bg-gradient-to-br from-ink-mid/70 to-ink-dark/80 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">{getExerciseIcon(getTypeColorKey(exercise))}</span>
                <h3 className="text-sm text-cloud-white font-semibold truncate">{getExerciseDisplayName(exercise, settings.terminologyMode)}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${diffColorClass} bg-ink-dark/50 border border-current/30`}>
                  {modalDiffDisplay}
                </span>
                {exercise.type && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTypeColor(getTypeColorKey(exercise))} bg-ink-dark/40 border border-current/15`}>
                    {getTypeDisplayName(exercise, settings.terminologyMode)}
                  </span>
                )}
                <EquipmentBadges exercise={exercise} />
              </div>
              {isFantasy && exercise.name && exercise.name !== exercise.wuxiaName && (
                <p className="text-[11px] text-mist-mid">{exercise.name}</p>
              )}
              {exercise.story && (
                <p className="text-[11px] text-mist-light/90 leading-relaxed">{exercise.story}</p>
              )}
            </div>
            <div className="shrink-0 min-w-[98px] rounded-lg border border-jade/30 bg-ink-dark/60 px-2 py-1.5 text-center">
              <p className="text-[9px] text-mist-dark uppercase tracking-wider">Completed</p>
              <p className="text-sm text-jade-light font-semibold">{completedTiers}/{totalTiers}</p>
              <p className="text-[10px] text-mist-mid">{completionRate}%</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 p-2.5 space-y-2">
            <p className="text-[10px] text-mist-light uppercase tracking-wider">Muscle Focus</p>
            <div className="flex flex-wrap gap-1">
              {primaryMuscles.map((m) => (
                <span key={`p-${m}`} className="text-[10px] px-2 py-0.5 rounded bg-jade-deep/35 text-jade-light border border-jade/25">{m}</span>
              ))}
              {secondaryMuscles.map((m) => (
                <span key={`s-${m}`} className="text-[10px] px-2 py-0.5 rounded bg-ink-mid/55 text-mist-light border border-ink-light/35">{m}</span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-mist-light uppercase tracking-wider">Progress</p>
              <p className="max-w-[60%] truncate text-[10px] text-mist-mid" title={currentTierName}>{currentTierName}</p>
            </div>
            <div className="h-1.5 bg-ink-mid rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-jade-deep to-jade-glow transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {categoryTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {categoryTags.map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded border border-gold-dim/25 text-gold/90 bg-gold-dim/10">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Progression Tiers</h4>
          <div className="space-y-1.5">
            {exercise.tiers.map((tier) => {
              const isCompleted = logs.some((l) => l.level === tier.level && l.completed);
              const isCurrent = tier.level === currentLevel;
              const weightFromDescription = (tier.description || "").match(/target\s*weight\s*:\s*([^\)]+)/i)?.[1]?.trim();
              const targetRepsLabel = tier.targetReps != null
                ? String(tier.targetReps)
                : (typeof tier.targetRepsText === "string" ? tier.targetRepsText.trim() : "");

              return (
                <div
                  key={tier.id}
                  className={`rounded-lg border px-2.5 py-2 transition-colors ${
                    isCurrent
                      ? "bg-ink-mid/30 border-gold/35"
                      : isCompleted
                        ? "bg-jade-deep/10 border-jade/20"
                        : "bg-ink-dark/35 border-ink-light/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="pt-px">
                      <LevelStatus tierLevel={tier.level} currentLevel={currentLevel} logs={logs} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-medium ${isCompleted ? "text-jade-light" : isCurrent ? "text-gold" : "text-cloud-white"}`}>
                          {getExerciseDisplayName(exercise, settings.terminologyMode)}
                        </span>
                        {(tier.difficulty || tier.wuxiaDifficulty) && (
                          <span className={`text-[9px] px-1.5 py-0 rounded-full ${getDifficultyColor(getDifficultyColorKey(tier))} bg-ink-dark/40 border border-current/15`}>
                            {getDifficultyDisplayName(tier, settings.terminologyMode)}
                          </span>
                        )}
                      </div>
                      {isFantasy && tier.wuxiaName && tier.name !== tier.wuxiaName && (
                        <p className="text-[10px] text-mist-dark">{tier.name}</p>
                      )}
                      {tier.description && <p className="text-[10px] text-mist-mid leading-snug mt-0.5">{tier.description}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {tier.targetHold != null && (
                          <span className="text-[9px] text-mountain-blue-glow bg-mountain-blue/10 border border-mountain-blue/25 rounded px-1.5 py-0.5">Hold {tier.targetHold}s</span>
                        )}
                        {targetRepsLabel && (
                          <span className="text-[9px] text-jade-light bg-jade-deep/20 border border-jade/25 rounded px-1.5 py-0.5">Reps {targetRepsLabel}</span>
                        )}
                        {weightFromDescription && (
                          <span className="text-[9px] text-gold bg-gold-dim/10 border border-gold-dim/30 rounded px-1.5 py-0.5">Weight {weightFromDescription}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {exercise.variations.length > 0 && (
          <section className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Variations</h4>
            <div className="grid grid-cols-1 gap-1.5">
              {exercise.variations.map((v) => (
                <div key={v.id} className="text-[11px] flex items-center gap-1.5 rounded-md border border-ink-light/30 bg-ink-dark/35 px-2 py-1.5">
                  <span className="text-mountain-blue-glow shrink-0">◇</span>
                  <span className="text-cloud-white flex-1 min-w-0 truncate">{getExerciseDisplayName(v, settings.terminologyMode)}</span>
                  {v.difficulty && (
                    <span className={`text-[9px] px-1.5 py-0 rounded-full ${getDifficultyColor(getDifficultyColorKey(v))} bg-ink-dark/40 border border-current/15`}>
                      {getDifficultyDisplayName(v, settings.terminologyMode)}
                    </span>
                  )}
                  {isFantasy && v.wuxiaName && v.name !== v.wuxiaName && (
                    <span className="text-mist-dark text-[10px]">({v.name})</span>
                  )}
                  {v.description && <span className="text-mist-dark text-[10px]">- {v.description}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {exercise.modifiers.length > 0 && (
          <section className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Modifiers</h4>
            <div className="space-y-1">
              {exercise.modifiers.map((m) => (
                <div key={m.id} className="text-[11px] flex items-center gap-1.5 rounded-md border border-ink-light/30 bg-ink-dark/35 px-2 py-1.5">
                  <span className={m.available ? "text-jade-glow" : "text-mist-dark"}>{m.available ? "●" : "○"}</span>
                  <span className="text-cloud-white capitalize flex-1 min-w-0">{m.type}</span>
                  {m.difficultyMod !== 0 && <span className="text-gold text-[9px] font-mono">{m.difficultyMod > 0 ? "+" : ""}{m.difficultyMod}</span>}
                  {m.notes && <span className="text-mist-dark text-[10px]">({m.notes})</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {parseTips(exercise.tips).length > 0 && (
          <section className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Cultivation Tips</h4>
            <ul className="space-y-0.5">
              {parseTips(exercise.tips).map((tip, i) => (
                <li key={i} className="text-[11px] text-mist-mid flex gap-1.5">
                  <span className="text-jade-glow shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </GlowModal>
  );
}
