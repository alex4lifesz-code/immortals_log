"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PageLayout from "@/components/layout/PageLayout";
import PageSkeleton from "@/components/ui/PageSkeleton";
import GlowCard from "@/components/ui/GlowCard";
import ExerciseStatsCarousel from "@/components/dashboard/ExerciseStatsCarousel";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { formatSetValue } from "@/lib/unit-conversion";
import { EmptyFeed } from "@/components/empty-states";

interface UserProfile {
  id: string;
  name: string;
  username?: string;
}

interface ExerciseLog {
  id: string;
  userId: string;
  userName: string;
  exerciseName: string;
  level: number;
  progressionName?: string;
  weight1?: number;
  weight2?: number;
  weight3?: number;
  reps1?: number;
  reps2?: number;
  reps3?: number;
  modifier?: string | null;
  notes?: string;
  createdAt: string;
  completed: boolean;
}

interface MemberStats {
  lastActiveAt: string;
}

interface ExerciseFeedGroup {
  exerciseName: string;
  logs: ExerciseLog[];
  lastActiveAt: string;
}

interface MemberFeed {
  userId: string;
  userName: string;
  dateKey: string;
  logs: ExerciseLog[];
  exerciseGroups: ExerciseFeedGroup[];
  stats: MemberStats;
}

function countLogSets(log: ExerciseLog): number {
  const setPairs: Array<[number | undefined, number | undefined]> = [
    [log.weight1, log.reps1],
    [log.weight2, log.reps2],
    [log.weight3, log.reps3],
  ];

  return setPairs.filter(([, reps]) => reps != null && reps > 0).length;
}

function calculateLogVolume(log: ExerciseLog): number {
  const setPairs: Array<[number | undefined, number | undefined]> = [
    [log.weight1, log.reps1],
    [log.weight2, log.reps2],
    [log.weight3, log.reps3],
  ];

  return setPairs.reduce((total, [weight, reps]) => {
    if (weight == null || reps == null || weight <= 0 || reps <= 0) return total;
    return total + weight * reps;
  }, 0);
}

const ITEMS_PER_PAGE = 7;

export default function CommunityFeedClient() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const weightUnit = settings.defaultWeightUnit ?? "kg";
  const [loading, setLoading] = useState(true);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [allExercises, setAllExercises] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<"category" | "muscle-group">("category");
  const [selectedFilter, setSelectedFilter] = useState<string>("");
  const [scope, setScope] = useState<"friends" | "community">(() => {
    if (typeof window === "undefined") return "friends";
    const saved = localStorage.getItem("community-feed-scope");
    return saved === "community" ? "community" : "friends";
  });
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [expandedMemberGroups, setExpandedMemberGroups] = useState<Record<string, boolean>>({});
  const [expandedExerciseGroups, setExpandedExerciseGroups] = useState<Record<string, boolean>>({});
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("community-feed-scope", scope);
  }, [scope]);

  useEffect(() => {
    const fetchNewsfeed = async () => {
      if (!user) return;

      setLoading(true);

      try {
        const feedData = await api.get<{
          exercises: Array<{
            id: string;
            name: string;
            category: string;
            primaryMuscles?: string;
            tiers?: Array<{
              level: number;
              name: string;
            }>;
            userProgress?: Array<{
              userId: string;
              user?: UserProfile;
              logs: Array<{
                id: string;
                createdAt: string;
                weight1?: number;
                weight2?: number;
                weight3?: number;
                reps1?: number;
                reps2?: number;
                reps3?: number;
                level: number;
                modifier?: string | null;
                notes?: string;
                completed?: boolean;
              }>;
            }>;
          }>;
        }>(`/api/feed?scope=${scope}`);

        setAllExercises(feedData.exercises || []);

        const usersMap: Record<string, UserProfile> = {};
        const allLogs: ExerciseLog[] = [];

        for (const exercise of feedData.exercises || []) {
          for (const progress of exercise.userProgress || []) {
            if (progress.user) {
              usersMap[progress.userId] = progress.user;
            }

            for (const log of progress.logs || []) {
              if (progress.userId !== user.id) {
                allLogs.push({
                  id: log.id,
                  userId: progress.userId,
                  userName: progress.user?.name || usersMap[progress.userId]?.name || "Unknown",
                  exerciseName: exercise.name,
                  level: log.level,
                  progressionName: exercise.tiers?.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`,
                  weight1: log.weight1,
                  weight2: log.weight2,
                  weight3: log.weight3,
                  reps1: log.reps1,
                  reps2: log.reps2,
                  reps3: log.reps3,
                  modifier: log.modifier,
                  notes: log.notes,
                  createdAt: log.createdAt,
                  completed: log.completed || false,
                });
              }
            }
          }
        }

        allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setExerciseLogs(allLogs);
      } catch (err) {
        console.error("Failed to fetch newsfeed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNewsfeed();
  }, [scope, user]);

  const formatDayHeader = (dateKey: string): string => {
    const parsed = new Date(`${dateKey}T00:00:00`);
    return formatDateWithPreference(parsed, dateFormat);
  };

  const handleFilterChange = useCallback((mode: "category" | "muscle-group", filter: string) => {
    setFilterMode(mode);
    setSelectedFilter(filter);
    setDisplayCount(ITEMS_PER_PAGE);
  }, []);

  const toggleMemberGroup = useCallback((memberKey: string) => {
    setExpandedMemberGroups((prev) => ({
      ...prev,
      [memberKey]: !prev[memberKey],
    }));
  }, []);

  const toggleExerciseGroup = useCallback((exerciseKey: string) => {
    setExpandedExerciseGroups((prev) => ({
      ...prev,
      [exerciseKey]: !prev[exerciseKey],
    }));
  }, []);

  const allGroupedByMemberDay = useMemo<MemberFeed[]>(() => {
    const filteredLogs = selectedFilter === ""
      ? exerciseLogs
      : exerciseLogs.filter((log) => {
          const exercise = allExercises.find((e) => e.name === log.exerciseName);
          if (!exercise) return false;

          if (filterMode === "category") {
            return exercise.category === selectedFilter;
          }

          return exercise.primaryMuscles === selectedFilter;
        });

    const grouped: Record<string, ExerciseLog[]> = {};
    for (const log of filteredLogs) {
      const dateKey = log.createdAt.slice(0, 10);
      const groupKey = `${log.userId}:${dateKey}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(log);
    }

    return Object.entries(grouped)
      .map(([groupKey, logs]) => {
        const [userId, dateKey] = groupKey.split(":");
        const lastActiveAt = logs[0]?.createdAt ?? "";

        return {
          userId,
          userName: logs[0]?.userName ?? "Unknown",
          dateKey,
          logs,
          exerciseGroups: Object.entries(
            logs.reduce<Record<string, ExerciseLog[]>>((acc, log) => {
              if (!acc[log.exerciseName]) {
                acc[log.exerciseName] = [];
              }
              acc[log.exerciseName].push(log);
              return acc;
            }, {}),
          )
            .map(([exerciseName, groupedLogs]) => {
              const sortedLogs = [...groupedLogs].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );

              return {
                exerciseName,
                logs: sortedLogs,
                lastActiveAt: sortedLogs[0]?.createdAt ?? "",
              };
            })
            .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()),
          stats: {
            lastActiveAt,
          },
        };
      })
      .sort((a, b) => new Date(b.stats.lastActiveAt).getTime() - new Date(a.stats.lastActiveAt).getTime());
  }, [exerciseLogs, allExercises, selectedFilter, filterMode]);

  const groupedByMemberDay = useMemo(() => {
    return allGroupedByMemberDay.slice(0, displayCount);
  }, [allGroupedByMemberDay, displayCount]);

  const hasMore = displayCount < allGroupedByMemberDay.length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore && hasMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setDisplayCount((prev) => Math.min(prev + ITEMS_PER_PAGE, allGroupedByMemberDay.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { threshold: 0.1 },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [isLoadingMore, hasMore, allGroupedByMemberDay.length]);

  const timeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateWithPreference(date, dateFormat);
  };

  if (!user) return null;

  return (
    <PageLayout
      title="Community Feed"
      mobileContentPaddingClass="p-3 pb-24"
    >
      {loading ? (
        <PageSkeleton statCards={0} wideBlock rows={4} />
      ) : (
        <div className="dashboard-modern-feed">
          {allExercises.length > 0 && (
            <section className="mb-3 sm:mb-4">
              <GlowCard glow="none" hoverable={false} className="dashboard-modern-hero !p-0 overflow-hidden">
                <ExerciseStatsCarousel
                  exercises={allExercises}
                  communityLogs={exerciseLogs}
                  currentUserId={user?.id}
                  scope={scope}
                  onScopeChange={setScope}
                  onFilterChange={handleFilterChange}
                />
              </GlowCard>
            </section>
          )}

          {allGroupedByMemberDay.length === 0 ? (
            selectedFilter !== "" ? (
              <GlowCard glow="none" hoverable={false} className="dashboard-modern-empty mt-8">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-4xl mb-4 opacity-40">🏛️</div>
                  <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-2">The Hall is Silent</h3>
                  <p className="text-sm text-mist-light max-w-sm">
                    {`No activity found for the selected ${filterMode === "category" ? "category" : "muscle group"}.`}
                  </p>
                </div>
              </GlowCard>
            ) : (
              <EmptyFeed />
            )
          ) : (
            <>
              <div className="mt-3 space-y-2.5 sm:mt-4">
                {groupedByMemberDay.map((member, memberIdx) => (
                  <GlowCard
                    key={`${member.userId}-${member.dateKey}`}
                    glow="none"
                    hoverable={false}
                    className="dashboard-modern-member"
                  >
                    {(() => {
                      const memberKey = `${member.userId}-${member.dateKey}`;
                      const isMemberExpanded = Boolean(expandedMemberGroups[memberKey]);

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleMemberGroup(memberKey)}
                            className="dashboard-modern-member-trigger w-full text-left"
                            aria-expanded={isMemberExpanded}
                          >
                            <div className="grid grid-cols-[36px_1fr_auto] sm:grid-cols-[40px_1fr_auto] gap-2 sm:gap-3 items-center">
                              <div className="grid h-9 w-9 place-items-center rounded-md border border-[#3b3f48] bg-[#313338] sm:h-10 sm:w-10">
                                <span className="text-base font-bold text-[#f2f3f5] sm:text-lg">
                                  {member.userName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-[#f2f3f5] sm:text-base">{member.userName}</h3>
                                <p className="truncate text-[10px] text-[#b5bac1] sm:text-xs">
                                  {member.exerciseGroups.length} {member.exerciseGroups.length === 1 ? "exercise" : "exercises"} • {member.logs.length} {member.logs.length === 1 ? "entry" : "entries"} • active {timeAgo(member.stats.lastActiveAt)}
                                </p>
                              </div>
                              <div className="justify-self-end flex flex-col items-end gap-1 shrink-0">
                                <div className="rounded-md border border-[#3b3f48] bg-[#232428] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#b5bac1] whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-[10px]">
                                  {formatDayHeader(member.dateKey)}
                                </div>
                                <span className="text-[10px] text-[#949ba4]">
                                  {isMemberExpanded ? "Hide exercises" : "Show exercises"}
                                </span>
                              </div>
                            </div>
                          </button>

                          {isMemberExpanded && (
                            <div className="flex flex-col gap-1.5 pt-2">
                              {member.exerciseGroups.map((exerciseGroup, exerciseIdx) => {
                                const exerciseKey = `${memberKey}-${exerciseGroup.exerciseName}`;
                                const isExerciseExpanded = Boolean(expandedExerciseGroups[exerciseKey]);

                                return (
                                  <motion.div
                                    key={exerciseKey}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: memberIdx * 0.05 + (exerciseIdx * 0.02) }}
                                    className="dashboard-modern-exercise overflow-hidden px-2.5 py-2 sm:px-3"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleExerciseGroup(exerciseKey)}
                                      className="w-full rounded-md px-1 py-1 text-left transition-colors hover:bg-[#313338]/55"
                                      aria-expanded={isExerciseExpanded}
                                    >
                                      <article
                                        className="rounded-md px-2 py-2"
                                        style={{
                                          borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)",
                                          border: isExerciseExpanded ? "1px solid color-mix(in srgb, var(--jade-glow) 55%, var(--ink-light))" : undefined,
                                          backgroundColor: isExerciseExpanded ? "color-mix(in srgb, var(--jade-glow) 10%, var(--ink-deep))" : "transparent",
                                          boxShadow: isExerciseExpanded ? "inset 0 0 0 1px color-mix(in srgb, var(--jade-glow) 14%, transparent)" : "none",
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-sm font-semibold leading-tight text-[#f2f3f5]">
                                            {exerciseGroup.exerciseName}
                                          </p>
                                          <span className="shrink-0 text-[11px] text-[#949ba4]">
                                            {timeAgo(exerciseGroup.lastActiveAt)}
                                          </span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] italic text-[#949ba4]">
                                          {`Recent: ${exerciseGroup.logs.length} ${exerciseGroup.logs.length === 1 ? "entry" : "entries"} • ${isExerciseExpanded ? "hide logs" : "show logs"}`}
                                        </p>
                                      </article>
                                    </button>

                                    {isExerciseExpanded && (
                                      <div className="mt-1 flex flex-col gap-1.5 pl-2 sm:pl-3">
                                        {exerciseGroup.logs.map((log) => (
                                          <article
                                            key={log.id}
                                            className="dashboard-modern-log px-3 py-2.5 sm:px-3.5"
                                            style={{ borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)" }}
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="text-sm font-semibold leading-tight text-[#8ea1ff]">
                                                {log.progressionName || `Progression ${log.level}`}
                                              </p>
                                              <span className="shrink-0 text-[11px] text-[#949ba4]">
                                                {timeAgo(log.createdAt)}
                                              </span>
                                            </div>
                                            <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-[#dbdee1]">
                                              {[1, 2, 3].map((setNumber) => {
                                                const weight = log[`weight${setNumber}` as keyof ExerciseLog] as number | undefined;
                                                const reps = log[`reps${setNumber}` as keyof ExerciseLog] as number | undefined;
                                                if (weight == null || reps == null) return null;
                                                return (
                                                  <div key={`${log.id}-set-${setNumber}`} className="grid grid-cols-2 gap-x-3">
                                                    <div className="min-w-0 truncate">
                                                      <span className="text-[#949ba4]">Weight {setNumber}:</span>{" "}
                                                      <span className="text-[#33b9ff]">
                                                        {formatSetValue(weight, weight > 0 ? "weighted" : "bodyweight", weightUnit)} {weight > 0 ? (weightUnit === "kg" ? "Kg" : "Lbs") : "seconds"}
                                                      </span>
                                                    </div>
                                                    <div className="min-w-0 truncate">
                                                      <span className="text-[#949ba4]">Reps:</span>{" "}
                                                      <span className="text-[#57f287]">{reps}</span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                              <div className="grid grid-cols-2 gap-x-3">
                                                <div className="min-w-0 truncate">
                                                  <span className="text-[#949ba4]">Notes:</span>{" "}
                                                  <span className="text-[#dbdee1]">{log.notes?.trim() || "-"}</span>
                                                </div>
                                                <div className="min-w-0 truncate">
                                                  <span className="text-[#949ba4]">Mod:</span>{" "}
                                                  <span className="text-[#fee75c]">{log.modifier?.trim() || "None"}</span>
                                                </div>
                                              </div>
                                              <div className="grid grid-cols-2 gap-x-3">
                                                <div className="min-w-0 truncate">
                                                  <span className="text-[#949ba4]">Status:</span>{" "}
                                                  <span className={log.completed ? "text-[#57f287]" : "text-[#b5bac1]"}>
                                                    {log.completed ? "Completed" : "Logged"}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="grid grid-cols-2 gap-x-3">
                                                <div className="min-w-0 truncate">
                                                  <span className="text-[#949ba4]">Sets:</span>{" "}
                                                  <span className="text-[#f2f3f5]">{countLogSets(log)}</span>
                                                </div>
                                                <div className="min-w-0 truncate">
                                                  <span className="text-[#949ba4]">Volume:</span>{" "}
                                                  <span className="text-[#ff7b7d]">{calculateLogVolume(log).toFixed(1)} {weightUnit}-reps</span>
                                                </div>
                                              </div>
                                            </div>
                                          </article>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </GlowCard>
                ))}
              </div>

              <div
                ref={observerTarget}
                className="dashboard-modern-loadmore flex items-center justify-center py-8"
              >
                {isLoadingMore ? (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-jade-glow/60 animate-bounce" />
                    <div className="h-2 w-2 rounded-full bg-jade-glow/60 animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="h-2 w-2 rounded-full bg-jade-glow/60 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <span className="ml-2 text-xs text-mist-light">Loading more activity...</span>
                  </div>
                ) : hasMore ? (
                  <button
                    type="button"
                    onClick={() => setDisplayCount((prev) => Math.min(prev + ITEMS_PER_PAGE, allGroupedByMemberDay.length))}
                    className="dashboard-modern-loadmore-btn rounded-md border border-ink-light/30 bg-ink-dark/60 px-3 py-1.5 text-xs text-jade-glow hover:bg-ink-dark/80 transition-colors"
                  >
                    Load more activity
                  </button>
                ) : allGroupedByMemberDay.length > 0 ? (
                  <div className="text-center">
                    <p className="text-xs text-mist-dark mb-1">No more activity</p>
                    <span className="text-[10px] text-mist-dark/60">You have seen all {allGroupedByMemberDay.length} recent entries</span>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </PageLayout>
  );
}
