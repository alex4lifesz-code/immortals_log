"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useIsMobile } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

function formatWorkoutValueChips(log: ProgressionLog): string[] {
  const hasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
  const metricValues = hasHold
    ? [log.holdTime, log.holdTime2, log.holdTime3]
    : [log.weight1, log.weight2, log.weight3];
  const repsValues = [log.reps1, log.reps2, log.reps3];

  const chips = metricValues
    .map((metric, index) => {
      const reps = repsValues[index];
      if (metric == null && reps == null) return null;

      const metricLabel = metric == null
        ? "-"
        : hasHold
          ? `${metric}s`
          : `${metric}kg`;

      return reps != null ? `${metricLabel} x ${reps}` : metricLabel;
    })
    .filter((chip): chip is string => Boolean(chip));

  if (chips.length === 0 && log.reps != null) {
    return [`${log.reps} reps`];
  }

  return chips;
}

function formatRelativeRecentDate(dateLike: string): string {
  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return new Date(timestamp).toLocaleDateString();
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const fourteenDaysMs = 14 * dayMs;

  if (diffMs < hourMs) {
    const mins = Math.max(1, Math.floor(diffMs / minuteMs));
    return `${mins}m ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return `${hours}h ago`;
  }

  if (diffMs < fourteenDaysMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

export default function HistoryPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const [visibleUsers, setVisibleUsers] = useState<Array<{ id: string; name: string; username: string }>>([]);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileExerciseDrawerExerciseId, setMobileExerciseDrawerExerciseId] = useState<string | null>(null);
  const [mobileLastSelectedExerciseId, setMobileLastSelectedExerciseId] = useState<string | null>(null);
  const [mobileLogFabOpen, setMobileLogFabOpen] = useState(false);
  const [mobileLogFabSearchQuery, setMobileLogFabSearchQuery] = useState("");
  const [mobileLogFabCategory, setMobileLogFabCategory] = useState("all");
  const [mobileLogFabSort, setMobileLogFabSort] = useState<"recent" | "oldest" | "name-az">("recent");

  const userId = user?.id ?? "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const rawFriendView = searchParams.get("friendView") || "history";
  const friendView = rawFriendView === "chart" || rawFriendView === "checkin" ? rawFriendView : "history";
  const activeUserId = targetUserId || userId;
  const prefillExerciseId = searchParams.get("prefillExerciseId");
  const prefillExerciseName = searchParams.get("prefillExercise");
  const prefillProgression = searchParams.get("prefillProgression");
  const prefillVariant = searchParams.get("prefillVariant");

  useEffect(() => {
    const hasPrefill = Boolean(prefillExerciseId || prefillExerciseName || prefillProgression || prefillVariant);
    if (!hasPrefill) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("prefillExerciseId");
    params.delete("prefillExercise");
    params.delete("prefillProgression");
    params.delete("prefillVariant");

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, prefillExerciseId, prefillExerciseName, prefillProgression, prefillVariant, router, searchParams]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadUsers = async () => {
      try {
        const data = await api.get<{ users: Array<{ id: string; name: string; username: string }> }>("/api/users/public?scope=community");
        if (!cancelled) {
          setVisibleUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) {
          setVisibleUsers([]);
        }
      }
    };
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }
    setPhysique(loadUserPhysique(activeUserId || userId));
  }, [activeUserId, userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({ logLimit: "200" });
      if (targetUserId) params.set("targetUserId", targetUserId);
      const data = await api.get<{ exercises: ProgressionExercise[] }>(`/api/progressions/history?${params.toString()}`);
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, userId]);

  useEffect(() => {
    setLoading(true);
    void fetchExercises();
  }, [fetchExercises]);

  const orderedVisibleUsers = useMemo(() => {
    if (!userId) return visibleUsers;

    const selfEntry = visibleUsers.find((u) => u.id === userId) ?? {
      id: userId,
      name: user?.name || "Me",
      username: user?.username || "",
    };
    const others = visibleUsers.filter((u) => u.id !== userId);
    return [selfEntry, ...others];
  }, [user?.name, user?.username, userId, visibleUsers]);

  const targetUserDisplayName = useMemo(() => {
    if (!targetUserId) return undefined;
    const target = orderedVisibleUsers.find((u) => u.id === targetUserId);
    if (!target) return undefined;
    return (target.name || target.username || "").trim() || undefined;
  }, [orderedVisibleUsers, targetUserId]);

  const activeUserProfile = useMemo(() => {
    const fallbackName = user?.name || user?.username || "Me";
    const fallbackUsername = user?.username || "me";
    const selected = orderedVisibleUsers.find((u) => u.id === activeUserId)
      ?? (userId ? orderedVisibleUsers.find((u) => u.id === userId) : undefined);

    return {
      id: selected?.id || userId || "",
      name: selected?.name || fallbackName,
      username: selected?.username || fallbackUsername,
    };
  }, [activeUserId, orderedVisibleUsers, user?.name, user?.username, userId]);

  const trainPageTitle = targetUserDisplayName
    ? `${targetUserDisplayName} Train ${friendView === "history" ? "History" : friendView === "chart" ? "Chart" : "Check-in"}`
    : "Train";
  const trainQuickNavItems = [
    { label: "Community Feed", href: DASHBOARD_ROUTES.community },
    { label: "Completionist", href: DASHBOARD_ROUTES.rankUp },
    { label: "Exercise Library", href: DASHBOARD_ROUTES.exercises },
  ] as const;
  const subtitle = targetUserDisplayName
    ? `Review ${targetUserDisplayName}'s training logs and cultivation entries`
    : "Review your training logs and cultivation entries";
  const isFriendTrainOverlay = isMobile && Boolean(targetUserId);

  const handleUserScopeChange = (nextUserId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextUserId || nextUserId === userId) {
      params.delete("targetUserId");
    } else {
      params.set("targetUserId", nextUserId);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const mobileExerciseRows = useMemo(() => {
    const rows: Array<{
      exerciseId: string;
      exerciseName: string;
      date: string;
      progression: string;
      variant: string;
      category: string;
    }> = [];

    for (const exercise of exercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      if (logs.length === 0) continue;

      const latestLog = [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const tierName = exercise.tiers.find((tier) => tier.level === latestLog.level)?.name ?? `Lv ${latestLog.level}`;

      rows.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        date: latestLog.createdAt,
        progression: tierName,
        variant: latestLog.variant?.trim() || "",
        category: (exercise.category || "Uncategorized").trim() || "Uncategorized",
      });
    }

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  }, [exercises]);

  const filteredMobileExerciseRows = useMemo(() => {
    const query = mobileSearchQuery.trim().toLowerCase();
    if (!query) return mobileExerciseRows;
    return mobileExerciseRows.filter((row) => {
      const haystack = `${row.exerciseName} ${row.progression} ${row.variant}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [mobileExerciseRows, mobileSearchQuery]);

  const mobileLogFabRows = useMemo(() => {
    const rows: Array<{
      exerciseId: string;
      exerciseName: string;
      date: string | null;
      progression: string;
      variant: string;
      category: string;
    }> = [];

    for (const exercise of exercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      const latestLog = logs.length > 0
        ? [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : null;

      const progressionLevel = latestLog?.level ?? exercise.userProgress?.[0]?.currentLevel ?? exercise.tiers[0]?.level ?? 1;
      const progressionName = exercise.tiers.find((tier) => tier.level === progressionLevel)?.name ?? `Lv ${progressionLevel}`;

      rows.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        date: latestLog?.createdAt ?? null,
        progression: progressionName,
        variant: latestLog?.variant?.trim() || "",
        category: (exercise.category || "Uncategorized").trim() || "Uncategorized",
      });
    }

    return rows;
  }, [exercises]);

  const mobileFabCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(mobileLogFabRows.map((row) => row.category).filter(Boolean)));
    categories.sort((a, b) => a.localeCompare(b));
    return ["all", ...categories];
  }, [mobileLogFabRows]);

  const filteredMobileLogFabRows = useMemo(() => {
    const query = mobileLogFabSearchQuery.trim().toLowerCase();
    const filtered = mobileLogFabRows.filter((row) => {
      const matchesCategory = mobileLogFabCategory === "all" || row.category === mobileLogFabCategory;
      if (!matchesCategory) return false;
      if (!query) return true;
      const haystack = `${row.exerciseName} ${row.progression} ${row.variant} ${row.category}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered];
    if (mobileLogFabSort === "oldest") {
      sorted.sort((a, b) => {
        const left = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
        const right = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
        if (left === right) return a.exerciseName.localeCompare(b.exerciseName);
        return left - right;
      });
    } else if (mobileLogFabSort === "name-az") {
      sorted.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
    } else {
      sorted.sort((a, b) => {
        const left = a.date ? new Date(a.date).getTime() : Number.NEGATIVE_INFINITY;
        const right = b.date ? new Date(b.date).getTime() : Number.NEGATIVE_INFINITY;
        if (left === right) return a.exerciseName.localeCompare(b.exerciseName);
        return right - left;
      });
    }
    return sorted;
  }, [mobileLogFabRows, mobileLogFabCategory, mobileLogFabSearchQuery, mobileLogFabSort]);

  const selectedMobileExercise = useMemo(() => {
    if (!mobileExerciseDrawerExerciseId) return null;
    return exercises.find((exercise) => exercise.id === mobileExerciseDrawerExerciseId) ?? null;
  }, [exercises, mobileExerciseDrawerExerciseId]);

  const selectedMobileExerciseLogs = useMemo(() => {
    if (!selectedMobileExercise) return [];
    const logs = selectedMobileExercise.userProgress?.[0]?.logs ?? [];
    return [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedMobileExercise]);

  useEffect(() => {
    if (!isMobile && mobileExerciseDrawerExerciseId) {
      setMobileExerciseDrawerExerciseId(null);
    }
  }, [isMobile, mobileExerciseDrawerExerciseId]);

  useEffect(() => {
    if (!isMobile && mobileLogFabOpen) {
      setMobileLogFabOpen(false);
    }
  }, [isMobile, mobileLogFabOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isOpen = Boolean(mobileExerciseDrawerExerciseId);
    window.dispatchEvent(new CustomEvent("train-exercise-history-visibility", { detail: { open: isOpen } }));

    return () => {
      window.dispatchEvent(new CustomEvent("train-exercise-history-visibility", { detail: { open: false } }));
    };
  }, [mobileExerciseDrawerExerciseId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onTrainReset = () => {
      setMobileExerciseDrawerExerciseId(null);
      setMobileLogFabOpen(false);
      setMobileSearchQuery("");
      setMobileLogFabSearchQuery("");
      setMobileLogFabCategory("all");
      setMobileLogFabSort("recent");

      if (targetUserId || searchParams.get("friendView")) {
        router.replace(DASHBOARD_ROUTES.workoutHistory, { scroll: false });
      }
    };

    window.addEventListener("train-reset-view", onTrainReset);
    return () => {
      window.removeEventListener("train-reset-view", onTrainReset);
    };
  }, [router, searchParams, targetUserId]);

  return (
    <PageLayout
      title={trainPageTitle}
      subtitle={isFriendTrainOverlay ? undefined : subtitle}
      mobileContentPaddingClass={isFriendTrainOverlay ? "p-0 pb-0" : "p-2 pb-0"}
    >
      <div className={`nyaa-history-page px-0 ${isFriendTrainOverlay ? "space-y-0" : "space-y-4"}`}>
        {loading ? (
          <GlowCard glow="jade" hoverable={false}>
            <p className="text-sm text-mist-dark text-center py-4">Loading history...</p>
          </GlowCard>
        ) : (
          <>
            {isMobile ? (
              <>
              <motion.section
                  key={isFriendTrainOverlay ? `friend-train-${targetUserId}` : "self-train"}
                  initial={isFriendTrainOverlay ? { x: "100%" } : false}
                  animate={isFriendTrainOverlay ? { x: "0%" } : { x: 0 }}
                  transition={isFriendTrainOverlay ? { duration: 0.26, ease: [0.22, 1, 0.36, 1] } : undefined}
                  className={isFriendTrainOverlay ? "relative z-[72]" : ""}
                  style={isFriendTrainOverlay ? { backgroundColor: "color-mix(in srgb, var(--ink-deep) 98%, var(--ink-mid))", minHeight: "var(--app-viewport-height)" } : undefined}
                >
                  <div
                    className={`border overflow-hidden ${isFriendTrainOverlay ? "rounded-none h-full" : "rounded-tl-2xl"}`}
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
                    }}
                  >
                    <div
                      className={`${isFriendTrainOverlay ? "h-app safe-area-top safe-area-bottom" : "h-[calc(100dvh-5rem)]"} min-h-0 overflow-y-auto scrollbar-hide`}
                      style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto", touchAction: "pan-y" }}
                    >
                      <div className="sticky top-0 z-20 safe-area-top" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                        <div
                          className="px-3 py-2.5"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {isFriendTrainOverlay ? (
                              <button
                                type="button"
                                onClick={() => handleUserScopeChange(userId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                                style={{
                                  color: "var(--mist-light)",
                                  backgroundColor: "transparent",
                                }}
                                aria-label="Back to my train history"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                            ) : null}
                            <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                              {trainPageTitle}
                            </h2>
                          </div>

                          {isFriendTrainOverlay && (
                            <div className="mt-2 rounded-2xl border border-[#3b3f48] bg-[#1e1f22] p-3.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Friend Profile</p>
                                  <p className="mt-0.5 truncate text-[13px] font-semibold text-[#f2f3f5]">{activeUserProfile.name}</p>
                                  <p className="truncate text-[11px] text-[#dbdee1]">@{activeUserProfile.username}</p>
                                  <p className="mt-1 truncate text-[10px] text-[#949ba4]">ID: {activeUserProfile.id || "-"}</p>
                                </div>

                                <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#5865f2]/40 bg-[#5865f2]/15 text-[#c8cdfa]">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
                                  </svg>
                                  <span
                                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border"
                                    style={{ backgroundColor: "#3ba55d", borderColor: "#1e1f22" }}
                                  />
                                </span>
                              </div>
                            </div>
                          )}

                          {friendView === "history" && (
                            <>
                              <input
                                type="text"
                                value={mobileSearchQuery}
                                onChange={(event) => setMobileSearchQuery(event.target.value)}
                                placeholder="Search exercises"
                                className="mt-2 h-8 w-full rounded-md border px-2.5 text-sm outline-none"
                                style={{
                                  borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                  backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                  color: "var(--cloud-white)",
                                }}
                              />

                              {!isFriendTrainOverlay ? (
                                <div className="mt-2 -mx-0.5 overflow-x-auto scrollbar-hide">
                                  <div className="flex min-w-max items-center gap-2 px-0.5 pb-0.5">
                                    {trainQuickNavItems.map((item) => {
                                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                                      return (
                                        <button
                                          key={item.href}
                                          type="button"
                                          onClick={() => router.push(item.href)}
                                          className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                                            isActive
                                              ? "border-[#5865f2]/70 bg-[#5865f2]/18 text-[#f2f3f5]"
                                              : "border-[#3b3f48] bg-[#383a40]/65 text-[#b5bac1] active:text-[#f2f3f5] active:border-[#5865f2]/60"
                                          }`}
                                          aria-current={isActive ? "page" : undefined}
                                        >
                                          {item.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                        <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                      </div>

                      {friendView === "history" ? (
                      <div className={isFriendTrainOverlay ? "pb-2" : "pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"}>
                        {filteredMobileExerciseRows.length === 0 ? (
                          <div
                            className="px-3 py-4 text-center text-xs"
                            style={{
                              color: "var(--text-muted)",
                            }}
                          >
                            No exercises match your search.
                          </div>
                        ) : (
                          filteredMobileExerciseRows.map((row) => {
                            const isPreviouslySelected = row.exerciseId === mobileLastSelectedExerciseId;
                            return (
                            <article
                              key={`mobile-train-row-${row.exerciseId}`}
                              className="mx-1 my-0.5 rounded-md px-3 py-2.5"
                              style={{
                                borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)",
                                border: isPreviouslySelected ? "1px solid color-mix(in srgb, var(--jade-glow) 62%, var(--ink-light))" : undefined,
                                backgroundColor: isPreviouslySelected ? "color-mix(in srgb, var(--jade-glow) 14%, var(--ink-deep))" : "transparent",
                                boxShadow: isPreviouslySelected ? "inset 0 0 0 1px color-mix(in srgb, var(--jade-glow) 20%, transparent), 0 0 14px color-mix(in srgb, var(--jade-glow) 24%, transparent)" : "none",
                                cursor: "pointer",
                              }}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setMobileLastSelectedExerciseId(row.exerciseId);
                                setMobileExerciseDrawerExerciseId(row.exerciseId);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setMobileLastSelectedExerciseId(row.exerciseId);
                                  setMobileExerciseDrawerExerciseId(row.exerciseId);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className="text-sm font-semibold leading-tight"
                                  style={{ color: isPreviouslySelected ? "var(--cloud-white)" : "var(--text-muted)" }}
                                >
                                  {row.exerciseName}
                                </p>
                                  <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                    {formatRelativeRecentDate(row.date)}
                                  </span>
                              </div>
                              <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                                {`Recent: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
                              </p>
                            </article>
                            );
                          })
                        )}
                      </div>
                      ) : (
                        <div className="px-3 py-5">
                          <div className="rounded-2xl border border-[#3b3f48] bg-[#232428] p-4">
                            <p className="text-sm font-semibold text-[#f2f3f5]">
                              {friendView === "chart" ? "Chart" : "Check-in"} coming soon
                            </p>
                            <p className="mt-1 text-xs text-[#949ba4]">
                              UI placeholder ready. Functionality will be added in the next step.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </motion.section>

              <AnimatePresence>
              {!mobileExerciseDrawerExerciseId ? (
                <motion.button
                  key="train-log-fab"
                  type="button"
                  onClick={() => setMobileLogFabOpen(true)}
                  initial={{ opacity: 0, y: 18, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.92 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] right-[max(env(safe-area-inset-right,0px),1rem)] z-[72] flex h-14 w-14 items-center justify-center rounded-full border"
                  style={{
                    borderColor: "color-mix(in srgb, var(--accent) 42%, var(--ink-light))",
                    backgroundColor: "color-mix(in srgb, var(--accent) 64%, var(--ink-mid))",
                    color: "var(--cloud-white)",
                    boxShadow: "0 10px 28px color-mix(in srgb, var(--accent) 30%, transparent)",
                  }}
                  aria-label="Log workout"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </motion.button>
              ) : null}

              {mobileLogFabOpen ? (
                <>
                  <motion.div
                    key="train-log-fab-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed inset-0 z-[236]"
                    style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
                    onClick={() => setMobileLogFabOpen(false)}
                  />
                  <motion.aside
                    key="train-log-fab-sheet"
                    initial={{ y: "100%" }}
                    animate={{ y: "0%" }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed inset-x-0 bottom-0 z-[238] rounded-t-3xl border-t border-x overflow-hidden safe-area-left safe-area-right safe-area-top safe-area-bottom"
                    style={{
                      height: "calc(100dvh - 4.5rem)",
                      borderColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
                    }}
                  >
                    <div className="h-full min-h-0 flex flex-col overflow-hidden">
                      <div className="sticky top-0 z-10 border-b safe-area-top" style={{
                        "--safe-area-top-offset": "10px",
                        borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
                      } as React.CSSProperties}>
                        <div className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                              New Workout Log
                            </h2>
                            <button
                              type="button"
                              onClick={() => setMobileLogFabOpen(false)}
                              className="h-8 w-8 rounded-md border text-sm"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                color: "var(--mist-light)",
                                backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                              }}
                              aria-label="Close workout logger chooser"
                            >
                              x
                            </button>
                          </div>
                        </div>
                        <div className="px-3 py-2.5 border-t" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                          <input
                            type="text"
                            value={mobileLogFabSearchQuery}
                            onChange={(event) => setMobileLogFabSearchQuery(event.target.value)}
                            placeholder="Search exercises"
                            className="h-8 w-full rounded-md border px-2.5 text-sm outline-none"
                            style={{
                              borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                              color: "var(--cloud-white)",
                            }}
                          />
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <select
                              value={mobileLogFabCategory}
                              onChange={(event) => setMobileLogFabCategory(event.target.value)}
                              className="h-8 rounded-md border px-2 text-xs outline-none"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                color: "var(--cloud-white)",
                              }}
                              aria-label="Filter by category"
                            >
                              {mobileFabCategoryOptions.map((category) => (
                                <option key={`mobile-fab-category-${category}`} value={category}>
                                  {category === "all" ? "All categories" : category}
                                </option>
                              ))}
                            </select>
                            <select
                              value={mobileLogFabSort}
                              onChange={(event) => setMobileLogFabSort(event.target.value as "recent" | "oldest" | "name-az")}
                              className="h-8 rounded-md border px-2 text-xs outline-none"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                color: "var(--cloud-white)",
                              }}
                              aria-label="Sort exercises"
                            >
                              <option value="recent">Recent first</option>
                              <option value="oldest">Oldest first</option>
                              <option value="name-az">Name A-Z</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div
                        className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-[max(env(safe-area-inset-bottom,0px),12px)]"
                        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", touchAction: "pan-y" }}
                      >
                        {filteredMobileLogFabRows.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                            No exercises match your search or filters.
                          </div>
                        ) : (
                          filteredMobileLogFabRows.map((row) => (
                            <button
                              key={`mobile-log-fab-row-${row.exerciseId}`}
                              type="button"
                              className="block w-full px-3 py-2.5 text-left"
                              style={{ borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)" }}
                              onClick={() => {
                                const pathId = `${row.exerciseId}-quick`;
                                const href = `/dashboard/train/input/${encodeURIComponent(pathId)}?prefillExerciseId=${encodeURIComponent(row.exerciseId)}&prefillExercise=${encodeURIComponent(row.exerciseName)}&prefillProgression=${encodeURIComponent(row.progression)}&prefillVariant=${encodeURIComponent(row.variant || "")}`;
                                setMobileLogFabOpen(false);
                                router.push(href);
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold leading-tight" style={{ color: row.date ? "var(--cloud-white)" : "var(--text-muted)" }}>
                                  {row.exerciseName}
                                </p>
                                <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  {row.date ? formatRelativeRecentDate(row.date) : "Never"}
                                </span>
                              </div>
                              {row.date ? (
                                <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                                  {`Recent: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
                                </p>
                              ) : null}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.aside>
                </>
              ) : null}

              {mobileExerciseDrawerExerciseId ? (
                <>
                    <motion.div
                      key="mobile-exercise-drawer-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="fixed inset-0 z-[235]"
                      style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 76%, transparent)" }}
                      onClick={() => setMobileExerciseDrawerExerciseId(null)}
                    />
                    <motion.aside
                      key="mobile-exercise-drawer-panel"
                      initial={{ x: "100%" }}
                      animate={{ x: "0%" }}
                      exit={{ x: "100%" }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="fixed inset-y-0 right-0 z-[240] w-full border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                      style={{
                        borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                      }}
                    >
                      <div className="h-full overflow-y-auto scrollbar-hide">
                        <div className="sticky top-0 z-10 border-b px-3 py-2.5 safe-area-top" style={{
                          "--safe-area-top-offset": "10px",
                          borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                        } as React.CSSProperties}>
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => setMobileExerciseDrawerExerciseId(null)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                              style={{
                                color: "var(--mist-light)",
                                backgroundColor: "transparent",
                              }}
                              aria-label="Back to exercise list"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold" style={{ color: "var(--cloud-white)" }}>
                                {selectedMobileExercise?.name || "Exercise"}
                              </h3>
                              <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--mist-light)" }}>
                                Workout History
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          {selectedMobileExerciseLogs.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                              No workout history for this exercise yet.
                            </div>
                          ) : (
                            <>
                              {selectedMobileExerciseLogs.map((log) => {
                              const tierName = selectedMobileExercise?.tiers.find((tier) => tier.level === log.level)?.name ?? `Lv ${log.level}`;
                              const variationValue = log.variant?.trim() || "-";
                              const modValue = log.modifier?.trim() || "-";
                              const notesValue = log.notes?.trim() || "-";
                              const weightValues = [log.weight1, log.weight2, log.weight3]
                                .filter((value): value is number => value != null)
                                .map((value) => `${value} kg`);
                              const repsValues = [log.reps1, log.reps2, log.reps3]
                                .filter((value): value is number => value != null)
                                .map((value) => String(value));
                              const timedValues = [log.holdTime, log.holdTime2, log.holdTime3]
                                .filter((value): value is number => value != null)
                                .map((value) => `${value}s`)
                                .join(", ");
                              const hasWeightValues = weightValues.length > 0;
                              const hasTimedValues = Boolean(timedValues);
                              const repsFallback = log.reps != null ? String(log.reps) : "";
                              const displayedReps = repsValues.length > 0 ? repsValues : repsFallback ? [repsFallback] : [];
                              const alignedMetricRowCount = Math.max(weightValues.length, displayedReps.length, 1);
                              const alignedMetricRows = Array.from({ length: alignedMetricRowCount }, (_, index) => ({
                                weight: weightValues[index] ?? "-",
                                reps: displayedReps[index] ?? "-",
                              }));
                              const leftDetailRows = [
                                { label: "Variation:", value: variationValue, valueColor: "var(--mountain-blue-glow)" },
                                { label: "Mod:", value: modValue, valueColor: "var(--gold-glow)" },
                                { label: "Notes:", value: notesValue, valueColor: "var(--text-secondary)" },
                              ];
                              const alignedDetailRowCount = Math.max(leftDetailRows.length, alignedMetricRows.length);
                              return (
                                <article
                                  key={`mobile-drawer-log-${log.id}`}
                                  className="px-3 py-2.5"
                                  style={{ borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)" }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold leading-tight" style={{ color: "var(--jade-light)" }}>
                                      {tierName}
                                    </p>
                                    <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                      {formatRelativeRecentDate(log.createdAt)}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                    {Array.from({ length: alignedDetailRowCount }, (_, index) => {
                                      const left = leftDetailRows[index];
                                      const metric = alignedMetricRows[index] ?? { weight: "-", reps: "-" };
                                      return (
                                        <div key={`detail-row-${log.id}-${index}`} className="grid grid-cols-2 gap-x-3">
                                          <div className="min-w-0 truncate">
                                            {left ? (
                                              <>
                                                <span style={{ color: "var(--text-muted)" }}>{left.label}</span>{" "}
                                                <span style={{ color: left.valueColor }}>{left.value}</span>
                                              </>
                                            ) : (
                                              <span aria-hidden="true">&nbsp;</span>
                                            )}
                                          </div>
                                          <div className="min-w-0 grid grid-cols-2 gap-x-3">
                                            <span className="truncate" style={{ color: "var(--mountain-blue-glow)" }}>
                                              <span style={{ color: "var(--text-muted)" }}>Weight:</span> {metric.weight}
                                            </span>
                                            <span className="truncate" style={{ color: "var(--forest)" }}>
                                              <span style={{ color: "var(--text-muted)" }}>Reps:</span> {metric.reps}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {hasTimedValues && !hasWeightValues ? (
                                      <div className="grid grid-cols-2 gap-x-3">
                                        <div aria-hidden="true">&nbsp;</div>
                                        <div className="min-w-0 truncate">
                                          <span style={{ color: "var(--mist-light)" }}>Timed:</span>{" "}
                                          <span style={{ color: "var(--text-secondary)" }}>{timedValues}</span>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </article>
                              );
                              })}
                            </>
                          )}
                        </div>
                      </div>
                    </motion.aside>
                </>
              ) : null}
              </AnimatePresence>
              </>
            ) : (
              <>
                <section
                  className="w-full rounded-2xl relative overflow-hidden"
                  style={{
                    border: "1px solid color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                    background: "linear-gradient(160deg, color-mix(in srgb, var(--ink-deep) 96%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 90%, transparent) 100%)",
                    boxShadow: "0 0 0 1px color-mix(in srgb, var(--jade-glow) 10%, transparent), var(--shadow-elev-1)",
                  }}
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 border-b"
                    style={{
                      borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                      backgroundColor: "color-mix(in srgb, var(--jade-glow) 9%, var(--ink-dark))",
                    }}
                  >
                    <span
                      className="text-[11px] font-semibold uppercase tracking-[0.09em] shrink-0"
                      style={{ color: "var(--jade-light)" }}
                    >
                      Friends Scope
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const href = targetUserId
                          ? `${DASHBOARD_ROUTES.trainingLogHistory}?targetUserId=${encodeURIComponent(targetUserId)}`
                          : DASHBOARD_ROUTES.trainingLogHistory;
                        router.push(href);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        color: "var(--cloud-white)",
                        borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                      }}
                    >
                      <span>Open history page</span>
                      <span aria-hidden="true" className="text-[13px] leading-none">↗</span>
                    </button>
                  </div>

                  <div className="px-3 py-3">
                    <div className="space-y-1.5">
                      <label className="block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--jade-light)" }}>
                        View friends
                      </label>
                      <select
                        value={activeUserId || userId}
                        onChange={(event) => handleUserScopeChange(event.target.value)}
                        className="min-w-[240px] rounded-md border px-3 py-2 text-[15px] font-medium outline-none"
                        style={{
                          borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                      >
                        {orderedVisibleUsers.length === 0 ? (
                          <option value={userId}>{user?.name || "Me"}</option>
                        ) : (
                          orderedVisibleUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.id === userId ? `* ${u.name || u.username}` : (u.name || u.username)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                </section>

                <div className="nyaa-history-table-shell">
                  <MemoTrainingLogTable
                    exercises={exercises}
                    physique={physique}
                    onRefresh={fetchExercises}
                    userId={userId}
                    historyTargetUserId={targetUserId || undefined}
                    historyTargetUserName={targetUserDisplayName}
                    prefillExerciseId={prefillExerciseId}
                    prefillExerciseName={prefillExerciseName}
                    prefillProgression={prefillProgression}
                    prefillVariant={prefillVariant}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
