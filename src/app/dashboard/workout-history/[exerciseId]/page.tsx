"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import { kgToLbs } from "@/lib/unit-conversion";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import {
  stripBwPercentHint,
  getExerciseCategoryLabel,
} from "@/app/dashboard/workout/utils";

export default function WorkoutHistoryDetailPage() {
  const params = useParams<{ exerciseId: string }>();
  const searchParams = useSearchParams();
  const exerciseId = params?.exerciseId ?? "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const source = searchParams.get("from") || "";
  const fromHistoryPage = source === "history";
  const { settings } = useDisplaySettings();
  const isMobile = useIsMobile();
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
      const params = new URLSearchParams();
      if (targetUserId) params.set("targetUserId", targetUserId);
      const endpoint = params.toString()
        ? `/api/progressions/${encodeURIComponent(exerciseId)}?${params.toString()}`
        : `/api/progressions/${encodeURIComponent(exerciseId)}`;
      const data = await api.get<{ exercise: ProgressionExercise }>(endpoint);
      setExercise(data.exercise ?? null);
    } catch (error) {
      console.error("Failed to load workout history detail", error);
      setExercise(null);
    } finally {
      setLoading(false);
    }
  }, [exerciseId, targetUserId]);

  useEffect(() => {
    void fetchExercise();
  }, [fetchExercise]);

  const selectedTierLevel = useMemo(() => {
    const parsed = Number(searchParams.get("progressionLevel"));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const selectedTierName = useMemo(() => {
    if (!exercise || selectedTierLevel == null) return null;
    return exercise.tiers.find((tier) => tier.level === selectedTierLevel)?.name ?? null;
  }, [exercise, selectedTierLevel]);

  const filteredLogs = useMemo(() => {
    if (!exercise) return [];
    const logs = exercise.userProgress?.[0]?.logs ?? [];
    if (selectedTierLevel == null) return logs;
    return logs.filter((log) => Number(log.level) === selectedTierLevel);
  }, [exercise, selectedTierLevel]);

  const exerciseArray = useMemo(() => {
    if (!exercise) return [];
    if (selectedTierLevel == null) return [exercise];
    const baseProgress = exercise.userProgress?.[0];
    return [
      {
        ...exercise,
        userProgress: [
          {
            id: baseProgress?.id ?? `${exercise.id}-filtered`,
            currentLevel: selectedTierLevel,
            logs: filteredLogs,
          },
        ],
      },
    ];
  }, [exercise, filteredLogs, selectedTierLevel]);

  const displayName = useMemo(() => {
    if (!exercise) return "Workout";
    return stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode, settings.showExerciseForeignLanguage));
  }, [exercise, settings.terminologyMode]);

  const totalLogs = filteredLogs.length;
  const completedLogs = useMemo(() => {
    return filteredLogs.filter((log) => log.completed).length;
  }, [filteredLogs]);
  const logsLast7Days = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return filteredLogs.filter(
      (log) => now - new Date(log.createdAt).getTime() <= sevenDaysMs,
    ).length;
  }, [filteredLogs]);

  const lastLogDate = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    return filteredLogs.reduce((latest, log) =>
      new Date(log.createdAt) > new Date(latest.createdAt) ? log : latest
    ).createdAt;
  }, [filteredLogs]);

  const currentLevel = exercise?.userProgress?.[0]?.currentLevel ?? 0;
  const currentTier = useMemo(() => {
    if (!exercise) return null;
    const tier = exercise.tiers.find((t) => t.level === currentLevel);
    if (tier) return { tierName: tier.name, level: tier.level };
    return null;
  }, [exercise, currentLevel]);

  const categoryLabel = useMemo(() => {
    if (!exercise) return "Other";
    return getExerciseCategoryLabel(exercise);
  }, [exercise]);

  const categoryColor = useMemo(() => {
    if (categoryLabel === "GYM") return "var(--category-gym)";
    if (categoryLabel === "Yoga") return "var(--category-yoga)";
    if (categoryLabel === "Cardio") return "var(--category-cardio)";
    return "var(--category-cali)";
  }, [categoryLabel]);

  const completionRate = useMemo(() => {
    if (totalLogs === 0) return 0;
    return Math.round((completedLogs / totalLogs) * 100);
  }, [completedLogs, totalLogs]);

  const logsLast30Days = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return filteredLogs.filter(
      (log) => now - new Date(log.createdAt).getTime() <= thirtyDaysMs,
    ).length;
  }, [filteredLogs]);

  const averageWeightDisplay = useMemo(() => {
    const weights = filteredLogs.flatMap((log) => [log.weight1, log.weight2, log.weight3]).filter((value): value is number => value != null);
    if (weights.length === 0) return "-";
    const avgKg = weights.reduce((sum, value) => sum + value, 0) / weights.length;
    const unit = (settings.defaultWeightUnit ?? "kg") === "lbs" ? "lbs" : "kg";
    const displayValue = unit === "lbs" ? kgToLbs(avgKg) : avgKg;
    return `${displayValue.toFixed(1)} ${unit}`;
  }, [filteredLogs, settings.defaultWeightUnit]);

  const averageRepsDisplay = useMemo(() => {
    const reps = filteredLogs.flatMap((log) => [log.reps1, log.reps2, log.reps3]).filter((value): value is number => value != null);
    if (reps.length === 0) return "-";
    const avg = reps.reduce((sum, value) => sum + value, 0) / reps.length;
    return avg.toFixed(1);
  }, [filteredLogs]);

  const lastLoggedDisplay = useMemo(() => {
    if (!lastLogDate) return "No logs yet";
    return new Date(lastLogDate)
      .toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .replace(",", "");
  }, [lastLogDate]);

  const backHref = useMemo(() => {
    const base = fromHistoryPage ? DASHBOARD_ROUTES.trainingLogHistory : DASHBOARD_ROUTES.workoutHistory;
    if (!targetUserId) return base;
    return `${base}?targetUserId=${encodeURIComponent(targetUserId)}`;
  }, [fromHistoryPage, targetUserId]);

  const backLabel = fromHistoryPage ? "Back to History" : "Back to Train";

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
            {targetUserId && (
              <div
                className="rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))",
                  backgroundColor: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
                  color: "var(--text-secondary)",
                }}
              >
                You are currently viewing this user&apos;s filtered history for this exercise.
              </div>
            )}

            <GlowCard glow="jade" hoverable={false} className="!p-0 overflow-hidden">
            <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <div className="px-3 py-2 border-b" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={backHref}
                      className="text-[11px] font-semibold text-jade-glow"
                    >
                      {backLabel}
                    </Link>
                    <p className="truncate text-xs font-bold" style={{ color: "var(--text-primary)" }}>{displayName}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Exercise snapshot</p>
                  </div>
                  <span
                    className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: categoryColor,
                      borderColor: `color-mix(in srgb, ${categoryColor} 55%, var(--border))`,
                      backgroundColor: `color-mix(in srgb, ${categoryColor} 13%, transparent)`,
                    }}
                  >
                    {categoryLabel}
                  </span>
                </div>
              </div>

              <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
                <tbody>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "30%" }}>Current Progression:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
                      {currentTier?.tierName || "Unassigned progression"}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "15%" }}>Last Logged:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {lastLoggedDisplay}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Total Logs:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
                      {totalLogs}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Completion:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--gold)" }}>
                      {completionRate}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Average Weight:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--col-weight)" }}>
                      {averageWeightDisplay}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Average Reps:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--col-reps)" }}>
                      {averageRepsDisplay}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Difficulty / Equipment:</td>
                    <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {exercise.difficulty || "-"} / {exercise.equipmentType || "Bodyweight"}
                    </td>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Activity:</td>
                    <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {logsLast7Days} (7d) • {logsLast30Days} (30d)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Primary Muscles:</td>
                    <td className="px-2 py-1.5 border-b" colSpan={3} style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {exercise.primaryMuscles || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Assigned Days:</td>
                    <td className="px-2 py-1.5" colSpan={3} style={{ color: "var(--text-primary)" }}>
                      {exercise.assignedDays || "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </GlowCard>

            <GlowCard glow="jade" hoverable={false} className="!p-0 overflow-hidden">
            <div className="nyaa-history-table-shell">
              {selectedTierLevel != null ? (
                <div className="mb-2 border px-2 py-1 text-[11px]" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--accent) 8%, var(--surface))", color: "var(--text-secondary)" }}>
                  Filtered to progression: <span style={{ color: "var(--accent)" }}>{selectedTierName || `Level ${selectedTierLevel}`}</span>
                </div>
              ) : null}
              <MemoTrainingLogTable
                exercises={exerciseArray}
                physique={physique}
                onRefresh={fetchExercise}
                userId={userId}
                historyTargetUserId={targetUserId || undefined}
                trainingLogTitleOverride={`Training Log - ${displayName}`}
                disableExerciseLinks
                hideInputSection
                forceDesktopTableOnMobile={isMobile}
              />
            </div>
            </GlowCard>
          </>
        )}
      </div>
    </PageLayout>
  );
}
