"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import {
  stripBwPercentHint,
  getExerciseCategoryLabel,
} from "@/app/dashboard/workout/utils";

export default function WorkoutHistoryDetailPage() {
  const params = useParams<{ exerciseId: string }>();
  const exerciseId = params?.exerciseId ?? "";
  const { settings } = useDisplaySettings();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<ProgressionExercise | null>(null);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);

  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }
    setPhysique(loadUserPhysique(userId));
  }, [userId]);

  const fetchExercise = useCallback(async () => {
    if (!exerciseId) return;
    setLoading(true);
    try {
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions");
      const match = (data.exercises || []).find((item) => item.id === exerciseId) ?? null;
      setExercise(match);
    } catch (error) {
      console.error("Failed to load workout history detail", error);
      setExercise(null);
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  useEffect(() => {
    void fetchExercise();
  }, [fetchExercise]);

  const exerciseArray = useMemo(() => (exercise ? [exercise] : []), [exercise]);

  const displayName = useMemo(() => {
    if (!exercise) return "Workout";
    return stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode));
  }, [exercise, settings.terminologyMode]);

  const totalLogs = exercise?.userProgress?.[0]?.logs?.length ?? 0;
  const completedLogs = useMemo(() => {
    if (!exercise) return 0;
    return (exercise.userProgress?.[0]?.logs ?? []).filter((log) => log.completed).length;
  }, [exercise]);
  const logsLast7Days = useMemo(() => {
    if (!exercise) return 0;
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return (exercise.userProgress?.[0]?.logs ?? []).filter(
      (log) => now - new Date(log.createdAt).getTime() <= sevenDaysMs,
    ).length;
  }, [exercise]);

  const lastLogDate = useMemo(() => {
    if (!exercise) return null;
    const logs = exercise.userProgress?.[0]?.logs ?? [];
    if (logs.length === 0) return null;
    return logs.reduce((latest, log) =>
      new Date(log.createdAt) > new Date(latest.createdAt) ? log : latest
    ).createdAt;
  }, [exercise]);

  const currentLevel = exercise?.userProgress?.[0]?.currentLevel ?? 0;
  const currentTier = useMemo(() => {
    if (!exercise) return null;
    const tier = exercise.tiers.find((t) => t.level === currentLevel);
    if (tier) return { tierName: tier.name, level: tier.level };
    return null;
  }, [exercise, currentLevel]);

  return (
    <PageLayout
      title={`${displayName} History`}
      subtitle="Compact training record for this workout"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="nyaa-history-page space-y-2 px-0 py-2 sm:py-3">

        {loading ? (
          <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
            Loading workout history...
          </div>
        ) : !exercise ? (
          <div className="rounded-lg border p-5 text-center text-xs" style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "color-mix(in srgb, var(--danger) 6%, transparent)" }}>
            Workout not found.
          </div>
        ) : (
          <>
            {/* Nyaa-style torrent info panel */}
            <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              {/* Title bar */}
              <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
                <Link
                  href={DASHBOARD_ROUTES.workoutHistory}
                  className="text-xs font-bold"
                >
                  {displayName}
                </Link>
              </div>
              {/* Info table */}
              <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
                <tbody>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "30%" }}>Category:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <span style={{ color: getExerciseCategoryLabel(exercise) === "GYM" ? "var(--gold)" : getExerciseCategoryLabel(exercise) === "Yoga" ? "var(--mountain-blue-glow)" : getExerciseCategoryLabel(exercise) === "Cardio" ? "var(--crimson-light)" : "var(--accent)" }}>
                        {getExerciseCategoryLabel(exercise)}
                      </span>
                      {exercise.type ? ` - ${exercise.type}` : ""}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "15%" }}>Last Logged:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {lastLogDate ? new Date(lastLogDate).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "No logs"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Difficulty:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {exercise.difficulty || "—"}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Total Logs:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
                      {totalLogs}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Equipment:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      {exercise.equipmentType || "Bodyweight"}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Last 7 Days:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--gold)" }}>
                      {logsLast7Days}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Current Level:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
                      {currentTier ? `Lv ${currentTier.level} — ${currentTier.tierName}` : `Lv ${currentLevel}`}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Completed:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
                      {completedLogs}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Primary Muscles:</td>
                    <td className="px-2 py-1.5 border-b" colSpan={3} style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {exercise.primaryMuscles || "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Assigned Days:</td>
                    <td className="px-2 py-1.5" colSpan={3} style={{ color: "var(--text-primary)" }}>
                      {exercise.assignedDays || "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="nyaa-history-table-shell">
              <MemoTrainingLogTable
                exercises={exerciseArray}
                physique={physique}
                onRefresh={fetchExercise}
                userId={userId}
                disableExerciseLinks
                hideInputSection
              />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
