"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { api } from "@/lib/api-client";
import { DASHBOARD_ROUTES } from "@/lib/navigation";

type RankUpProgression = {
  exerciseName: string;
  progressionName: string;
  label: string;
  variantName?: string;
  difficulty?: "Beginner" | "Intermediate" | "Advanced";
  notes?: string;
};

type RankUpSkill = {
  id: string;
  name: string;
  summary: string;
  progressions: RankUpProgression[];
};

type ExerciseLibraryResponse = {
  exercises: Array<{
    id: string;
    name: string;
    variations?: Array<{
      id: string;
      name: string;
    }>;
  }>;
};

const RANK_UP_SKILLS: RankUpSkill[] = [
  {
    id: "muscle-up",
    name: "Muscle Up",
    summary: "Build pull power, transition strength, and clean lockout mechanics using canonical progressions.",
    progressions: [
      { exerciseName: "Pull up", progressionName: "Scapular", label: "Pull-up Scapular", variantName: "High", difficulty: "Beginner" },
      { exerciseName: "Pull up", progressionName: "Assisted", label: "Pull-up Assisted", variantName: "Close grip", difficulty: "Beginner" },
      { exerciseName: "Pull up", progressionName: "Standard", label: "Pull-up Standard", variantName: "Chin up", difficulty: "Beginner" },
      { exerciseName: "Pull up", progressionName: "Strict", label: "Pull-up Strict", variantName: "Chest-to-bar", difficulty: "Intermediate" },
      { exerciseName: "Dip", progressionName: "Standard", label: "Dip Standard", variantName: "Straight bar", difficulty: "Intermediate" },
      { exerciseName: "Muscle up", progressionName: "Transition Drill", label: "Muscle up Transition Drill", variantName: "Bar", difficulty: "Intermediate" },
      { exerciseName: "Muscle up", progressionName: "Band Assisted", label: "Muscle up Band Assisted", variantName: "Bar", difficulty: "Intermediate" },
      { exerciseName: "Muscle up", progressionName: "Strict", label: "Muscle up Strict", variantName: "Bar", difficulty: "Advanced" },
    ],
  },
  {
    id: "front-lever",
    name: "Front Lever",
    summary: "Progress from bodyline control to full horizontal hold strength.",
    progressions: [
      { exerciseName: "Hang", progressionName: "Dead", label: "Hang Dead", difficulty: "Beginner" },
      { exerciseName: "Front lever", progressionName: "Tuck Hold", label: "Front Lever Tuck Hold", variantName: "Pulls", difficulty: "Beginner" },
      { exerciseName: "Front lever", progressionName: "Tucked Negative", label: "Front Lever Tucked Negative", variantName: "Raises", difficulty: "Intermediate" },
      { exerciseName: "Front lever", progressionName: "Advanced Tuck Hold", label: "Front Lever Advanced Tuck", variantName: "Pulls", difficulty: "Intermediate" },
      { exerciseName: "Front lever", progressionName: "One Leg Hold", label: "Front Lever One Leg", variantName: "Ice Cream Maker", difficulty: "Intermediate" },
      { exerciseName: "Front lever", progressionName: "Straddle Hold", label: "Front Lever Straddle", variantName: "Raises", difficulty: "Advanced" },
      { exerciseName: "Front lever", progressionName: "Full Hold", label: "Front Lever Full", variantName: "Pulls", difficulty: "Advanced" },
    ],
  },
  {
    id: "handstand-pushup",
    name: "Handstand Push-Up",
    summary: "Layer overhead pressing strength and balance under control.",
    progressions: [
      { exerciseName: "Handstand", progressionName: "Wall Hold", label: "Handstand Wall Hold", variantName: "Tuck", difficulty: "Beginner" },
      { exerciseName: "Push up", progressionName: "Pike", label: "Push-up Pike", variantName: "Pike", difficulty: "Beginner" },
      { exerciseName: "Handstand push up", progressionName: "Pike", label: "HSPU Pike", difficulty: "Beginner" },
      { exerciseName: "Handstand push up", progressionName: "Elevated Pike", label: "HSPU Elevated Pike", difficulty: "Intermediate" },
      { exerciseName: "Handstand push up", progressionName: "Wall", label: "HSPU Wall", variantName: "90 degree", difficulty: "Intermediate" },
      { exerciseName: "Handstand push up", progressionName: "Deficit Wall", label: "HSPU Deficit Wall", difficulty: "Advanced" },
      { exerciseName: "Handstand push up", progressionName: "Freestanding", label: "HSPU Freestanding", variantName: "Weighted", difficulty: "Advanced" },
    ],
  },
];

export default function RankUpPage() {
  const [activeSkillId, setActiveSkillId] = useState(RANK_UP_SKILLS[0]?.id ?? "");
  const [exerciseIdByProgression, setExerciseIdByProgression] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string>("Syncing progression exercises to your library...");

  const activeSkill = useMemo(
    () => RANK_UP_SKILLS.find((skill) => skill.id === activeSkillId) ?? RANK_UP_SKILLS[0],
    [activeSkillId],
  );

  const syncExercises = useCallback(async () => {
    setLoading(true);
    setSyncMessage("Syncing rank-up links with canonical exercise library...");

    try {
      const libraryData = await api.get<ExerciseLibraryResponse>("/api/exercise-library");
      const existingByName = new Map<string, { id: string; name: string; variations: string[] }>();
      for (const exercise of libraryData.exercises || []) {
        existingByName.set(exercise.name.trim().toLowerCase(), {
          id: exercise.id,
          name: exercise.name,
          variations: (exercise.variations ?? []).map((variation) => variation.name),
        });
      }

      const nextMap: Record<string, string> = {};
      let addedVariantCount = 0;
      let missingCount = 0;

      for (const progression of RANK_UP_SKILLS.flatMap((skill) => skill.progressions)) {
        const key = progression.exerciseName.trim().toLowerCase();
        const existing = existingByName.get(key);
        const progressionKey = `${progression.exerciseName}::${progression.progressionName}::${progression.variantName || ""}`;

        if (!existing) {
          missingCount += 1;
          continue;
        }

        if (progression.variantName) {
          const hasVariant = existing.variations.some((variant) => variant.toLowerCase() === progression.variantName?.toLowerCase());
          if (!hasVariant) {
            const nextVariations = [...existing.variations, progression.variantName];
            await api.patch(`/api/exercise-library/${existing.id}`, {
              variations: nextVariations,
            });
            existing.variations = nextVariations;
            addedVariantCount += 1;
          }
        }
        nextMap[progressionKey] = existing.id;
      }

      setExerciseIdByProgression(nextMap);
      if (addedVariantCount > 0 || missingCount > 0) {
        const variantText = addedVariantCount > 0 ? `${addedVariantCount} missing variant${addedVariantCount > 1 ? "s" : ""} added` : "no missing variants";
        const missingText = missingCount > 0 ? `${missingCount} progression step${missingCount > 1 ? "s" : ""} could not be linked` : "all progression steps linked";
        setSyncMessage(`Synced. ${variantText}; ${missingText}.`);
      } else {
        setSyncMessage("Synced. All rank-up steps are linked to canonical exercises.");
      }
    } catch (error) {
      console.error("Failed to sync rank-up exercises", error);
      setSyncMessage("Could not sync rank-up links. You can still navigate to Workout History.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncExercises();
  }, [syncExercises]);

  return (
    <PageLayout title="Rank Up" subtitle="Skill trees that jump you straight into Workout History" mobileContentPaddingClass="p-2 pb-24">
      <div className="nyaa-history-page space-y-2 px-0 py-2 sm:py-3">
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
              Calisthenics Skill Paths
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {syncMessage}
            </p>
          </div>

          <div className="grid gap-2 p-2 md:grid-cols-[260px_minmax(0,1fr)]">
            <div className="border rounded-md p-2" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "var(--text-muted)" }}>
                Skills
              </p>
              <div className="space-y-1">
                {RANK_UP_SKILLS.map((skill) => {
                  const isActive = activeSkill?.id === skill.id;
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => setActiveSkillId(skill.id)}
                      className="w-full text-left rounded-md border px-2 py-2 transition-colors"
                      style={{
                        borderColor: isActive ? "var(--accent)" : "var(--border)",
                        backgroundColor: isActive
                          ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                          : "var(--surface)",
                        color: isActive ? "var(--accent)" : "var(--text-primary)",
                      }}
                    >
                      <div className="text-xs font-semibold">{skill.name}</div>
                      <div className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>{skill.summary}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border rounded-md overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                  {activeSkill?.name} Progressions
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {activeSkill?.progressions.map((progression, index) => {
                  const progressionKey = `${progression.exerciseName}::${progression.progressionName}::${progression.variantName || ""}`;
                  const linkedExerciseId = exerciseIdByProgression[progressionKey] || "";
                  const href = linkedExerciseId
                    ? `${DASHBOARD_ROUTES.workoutHistory}?prefillExerciseId=${encodeURIComponent(linkedExerciseId)}&prefillExercise=${encodeURIComponent(progression.exerciseName)}&prefillProgression=${encodeURIComponent(progression.progressionName)}${progression.variantName ? `&prefillVariant=${encodeURIComponent(progression.variantName)}` : ""}`
                    : `${DASHBOARD_ROUTES.workoutHistory}?prefillExercise=${encodeURIComponent(progression.exerciseName)}&prefillProgression=${encodeURIComponent(progression.progressionName)}${progression.variantName ? `&prefillVariant=${encodeURIComponent(progression.variantName)}` : ""}`;

                  return (
                    <div key={`${progression.label}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2" style={{ backgroundColor: index % 2 === 0 ? "var(--surface)" : "color-mix(in srgb, var(--border) 8%, var(--surface))" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {progression.label}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {progression.exerciseName}
                          {` • ${progression.progressionName}`}
                          {progression.variantName ? ` • ${progression.variantName}` : ""}
                          {` • ${progression.difficulty ?? "Progression"}`}
                        </p>
                      </div>
                      <Link
                        href={href}
                        className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors"
                        style={{
                          borderColor: "var(--accent)",
                          color: "var(--accent)",
                          backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)",
                          opacity: loading ? 0.75 : 1,
                        }}
                      >
                        Open in History
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
