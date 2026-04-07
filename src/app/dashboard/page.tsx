"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PageLayout from "@/components/layout/PageLayout";
import PageSkeleton from "@/components/ui/PageSkeleton";
import GlowCard from "@/components/ui/GlowCard";
import ExerciseStatsCarousel from "@/components/dashboard/ExerciseStatsCarousel";
import ExerciseImageBox from "@/components/exercise/ExerciseImageBox";
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
  weight1?: number;
  weight2?: number;
  weight3?: number;
  reps1?: number;
  reps2?: number;
  reps3?: number;
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

export default function DashboardNewsfeedPage() {
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
        // Fetch community feed with all users' progress
        const feedData = await api.get<{
          exercises: Array<{
            id: string;
            name: string;
            category: string;
            primaryMuscles?: string;
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
                notes?: string;
                completed?: boolean;
              }>;
            }>;
          }>;
        }>(`/api/feed?scope=${scope}`);

        // Store all exercises for the carousel
        setAllExercises(feedData.exercises || []);

        // Build users map and flatten all logs from all exercises
        const usersMap: Record<string, UserProfile> = {};
        const allLogs: ExerciseLog[] = [];
        
        for (const exercise of feedData.exercises || []) {
          for (const progress of exercise.userProgress || []) {
            // Store user info if available
            if (progress.user) {
              usersMap[progress.userId] = progress.user;
            }

            for (const log of progress.logs || []) {
              // Exclude current user's logs from newsfeed
              if (progress.userId !== user.id) {
                allLogs.push({
                  id: log.id,
                  userId: progress.userId,
                  userName: progress.user?.name || usersMap[progress.userId]?.name || "Unknown",
                  exerciseName: exercise.name,
                  level: log.level,
                  weight1: log.weight1,
                  weight2: log.weight2,
                  weight3: log.weight3,
                  reps1: log.reps1,
                  reps2: log.reps2,
                  reps3: log.reps3,
                  notes: log.notes,
                  createdAt: log.createdAt,
                  completed: log.completed || false,
                });
              }
            }
          }
        }

        // Sort by most recent first
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
    setDisplayCount(ITEMS_PER_PAGE); // Reset to first page when filter changes
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
    // First filter the logs based on the selected category/muscle group
    const filteredLogs = selectedFilter === ""
      ? exerciseLogs
      : exerciseLogs.filter((log) => {
          const exercise = allExercises.find((e) => e.name === log.exerciseName);
          if (!exercise) return false;
          
          if (filterMode === "category") {
            return exercise.category === selectedFilter;
          } else {
            return exercise.primaryMuscles === selectedFilter;
          }
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
            }, {})
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

  // Paginated feed data
  const groupedByMemberDay = useMemo(() => {
    return allGroupedByMemberDay.slice(0, displayCount);
  }, [allGroupedByMemberDay, displayCount]);
  const hasMore = displayCount < allGroupedByMemberDay.length;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore && hasMore) {
          setIsLoadingMore(true);
          // Simulate loading delay for smooth UX
          setTimeout(() => {
            setDisplayCount((prev) => Math.min(prev + ITEMS_PER_PAGE, allGroupedByMemberDay.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { threshold: 0.1 }
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
          {/* Carousel at the top */}
          {allExercises.length > 0 && (
            <GlowCard glow="jade" hoverable={false} className="dashboard-modern-hero !p-0 overflow-hidden">
              <ExerciseStatsCarousel 
                exercises={allExercises} 
                communityLogs={exerciseLogs}
                currentUserId={user?.id}
                scope={scope}
                onScopeChange={setScope}
                onFilterChange={handleFilterChange}
              />
            </GlowCard>
          )}

          {/* Community feed */}
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
              <div className="space-y-6 mt-6 sm:mt-8">
                {groupedByMemberDay.map((member, memberIdx) => (
                  <GlowCard
                    key={`${member.userId}-${member.dateKey}`}
                    glow="jade"
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
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-jade-glow/15 border border-ink-light/30 grid place-items-center">
                                <span className="text-base sm:text-lg font-bold text-jade-light">
                                  {member.userName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-cloud-white text-sm sm:text-base truncate">{member.userName}</h3>
                                <p className="text-[10px] sm:text-xs text-mist-dark truncate">
                                  {member.exerciseGroups.length} {member.exerciseGroups.length === 1 ? "exercise" : "exercises"} • {member.logs.length} {member.logs.length === 1 ? "entry" : "entries"} • active {timeAgo(member.stats.lastActiveAt)}
                                </p>
                              </div>
                              <div className="justify-self-end flex flex-col items-end gap-1 shrink-0">
                                <div className="rounded-full border border-ink-light/30 bg-ink-dark px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-jade-glow whitespace-nowrap">
                                  {formatDayHeader(member.dateKey)}
                                </div>
                                <span className="text-[10px] text-mist-dark">
                                  {isMemberExpanded ? "Hide exercises" : "Show exercises"}
                                </span>
                              </div>
                            </div>
                          </button>

                          {isMemberExpanded && (
                            <div className="flex flex-col gap-2.5 pt-1.5">
                              {member.exerciseGroups.map((exerciseGroup, exerciseIdx) => {
                                const exerciseKey = `${memberKey}-${exerciseGroup.exerciseName}`;
                                const isExerciseExpanded = Boolean(expandedExerciseGroups[exerciseKey]);

                                return (
                                  <motion.div
                                    key={exerciseKey}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: memberIdx * 0.05 + (exerciseIdx * 0.02) }}
                                    className="dashboard-modern-exercise rounded-lg border border-ink-light/30 p-2.5 sm:p-3 bg-ink-deep/40 overflow-hidden"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleExerciseGroup(exerciseKey)}
                                      className="w-full text-left"
                                      aria-expanded={isExerciseExpanded}
                                    >
                                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <ExerciseImageBox className="h-8 w-8 sm:h-9 sm:w-9" compact />
                                          <div className="min-w-0">
                                            <h4 className="truncate font-semibold text-jade-light text-sm sm:text-base">
                                              {exerciseGroup.exerciseName}
                                            </h4>
                                            <p className="text-[10px] text-mist-dark">
                                              {exerciseGroup.logs.length} {exerciseGroup.logs.length === 1 ? "entry" : "entries"} • latest {timeAgo(exerciseGroup.lastActiveAt)}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="shrink-0 text-[10px] text-mist-dark whitespace-nowrap">
                                          {isExerciseExpanded ? "Hide logs" : "Show logs"}
                                        </span>
                                      </div>
                                    </button>

                                    {isExerciseExpanded && (
                                      <div className="mt-2.5 flex flex-col gap-2.5 pl-2 sm:pl-3 border-l border-ink-light/30">
                                        {exerciseGroup.logs.map((log) => (
                                          <div
                                            key={log.id}
                                            className="dashboard-modern-log rounded-lg border border-ink-light/30 p-3 sm:p-4 bg-ink-dark/50 hover:border-ink-light/50 hover:bg-ink-dark/70 transition-all duration-200"
                                          >
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                              <span className="text-xs text-jade-light font-semibold">Log Entry</span>
                                              <span className="shrink-0 text-xs text-mist-dark whitespace-nowrap">
                                                {timeAgo(log.createdAt)}
                                              </span>
                                            </div>

                                            <div className="space-y-1.5 mb-2">
                                              {log.weight1 != null && log.reps1 != null && (
                                                <div className="flex items-center gap-2 text-[10px] sm:text-[11px]">
                                                  <span className="inline-block px-1.5 py-0.5 rounded bg-jade-deep/20 text-jade-light font-medium text-[10px] sm:text-[11px]">
                                                    Set 1
                                                  </span>
                                                  <span className="text-cloud-white">
                                                    {formatSetValue(log.weight1, log.weight1 > 0 ? "weighted" : "bodyweight", weightUnit)} {log.weight1 > 0 ? (weightUnit === "kg" ? "Kg" : "Lbs") : "seconds"} × {log.reps1} Reps
                                                  </span>
                                                </div>
                                              )}
                                              {log.weight2 != null && log.reps2 != null && (
                                                <div className="flex items-center gap-2 text-[10px] sm:text-[11px]">
                                                  <span className="inline-block px-1.5 py-0.5 rounded bg-jade-deep/20 text-jade-light font-medium text-[10px] sm:text-[11px]">
                                                    Set 2
                                                  </span>
                                                  <span className="text-cloud-white">
                                                    {formatSetValue(log.weight2, log.weight2 > 0 ? "weighted" : "bodyweight", weightUnit)} {log.weight2 > 0 ? (weightUnit === "kg" ? "Kg" : "Lbs") : "seconds"} × {log.reps2} Reps
                                                  </span>
                                                </div>
                                              )}
                                              {log.weight3 != null && log.reps3 != null && (
                                                <div className="flex items-center gap-2 text-[10px] sm:text-[11px]">
                                                  <span className="inline-block px-1.5 py-0.5 rounded bg-jade-deep/20 text-jade-light font-medium text-[10px] sm:text-[11px]">
                                                    Set 3
                                                  </span>
                                                  <span className="text-cloud-white">
                                                    {formatSetValue(log.weight3, log.weight3 > 0 ? "weighted" : "bodyweight", weightUnit)} {log.weight3 > 0 ? (weightUnit === "kg" ? "Kg" : "Lbs") : "seconds"} × {log.reps3} Reps
                                                  </span>
                                                </div>
                                              )}
                                            </div>

                                            {log.notes && (
                                              <div className="text-[10px] sm:text-xs text-mist-light italic pt-2 border-t border-ink-light/50 mb-2">
                                                💭 "{log.notes}"
                                              </div>
                                            )}

                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 mt-2 pt-2 border-t border-ink-light/50">
                                              <span className="text-[10px] text-mist-dark">Level {log.level} • Sets {countLogSets(log)} • Volume {calculateLogVolume(log).toFixed(1)} {weightUnit}-reps</span>
                                              {log.completed && (
                                                <span className="text-jade-light font-semibold text-xs">✦ Completed</span>
                                              )}
                                            </div>
                                          </div>
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

              {/* Infinite scroll observer target */}
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
