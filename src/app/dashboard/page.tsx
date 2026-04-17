"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { useSortedNavItems } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { ADMIN_NAV_IDS, DASHBOARD_ROUTES } from "@/lib/navigation";
import type { ProgressionExercise } from "./workout/types";

type ProgressionsResponse = {
  exercises?: ProgressionExercise[];
};

type ExercisePreview = {
  id: string;
  displayName: string;
  category: string;
  totalLogs: number;
  lastLogAt: string | null;
  lastLogId: string | null;
};

type PreviewCard = {
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

type CommunityFeedResponse = {
  exercises?: Array<{
    id: string;
    name: string;
    tiers?: Array<{
      level: number;
      name: string;
    }>;
    userProgress?: Array<{
      userId: string;
      user?: {
        id: string;
        name: string;
        username?: string;
      };
      logs?: Array<{
        id: string;
        createdAt: string;
        level: number;
        completed?: boolean;
      }>;
    }>;
  }>;
};

type FriendPayload = {
  friends?: Array<{
    id: string;
    name: string;
    username: string;
    friendCode?: string | null;
  }>;
  incomingRequests?: Array<{ id: string }>;
  outgoingRequests?: Array<{ id: string }>;
};

type CheckInResponse = {
  checkins?: Array<{
    date: string;
    userId: string;
    present: boolean;
    weight?: number | null;
    comment?: string | null;
    user?: {
      id: string;
      name: string;
    };
  }>;
};

const DASHBOARD_HOME_HIDDEN_NAV_IDS = new Set(["settings", "website-information", "admin"]);

function getPrimaryCategory(category: string | null | undefined): string {
  const raw = String(category || "").trim();
  if (!raw) return "Other";
  return raw.split(",")[0]?.trim() || "Other";
}

function formatRelativeRecentDate(dateLike: string | null | undefined): string {
  if (!dateLike) return "Not logged yet";

  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "Not logged yet";

  const diffMs = Math.max(0, Date.now() - timestamp);
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) {
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${mins}m ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return `${hours}h ago`;
  }

  const days = Math.max(1, Math.floor(diffMs / dayMs));
  return `${days}d ago`;
}

function getTodayDateKey(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function buildCommunityPreviewCards(feedData: CommunityFeedResponse | null | undefined, currentUserId?: string): PreviewCard[] {
  const grouped = new Map<string, {
    userName: string;
    lastActiveAt: string;
    logCount: number;
    exerciseNames: Set<string>;
    latestExerciseName: string;
    latestProgressionName: string | null;
  }>();

  for (const exercise of feedData?.exercises ?? []) {
    for (const progress of exercise.userProgress ?? []) {
      if (progress.userId === currentUserId) continue;

      const userName = progress.user?.name?.trim() || progress.user?.username?.trim() || "Unknown";

      for (const log of progress.logs ?? []) {
        const groupKey = `${progress.userId}:${log.createdAt.slice(0, 10)}`;
        const progressionName = exercise.tiers?.find((tier) => tier.level === log.level)?.name ?? null;
        const existing = grouped.get(groupKey) ?? {
          userName,
          lastActiveAt: log.createdAt,
          logCount: 0,
          exerciseNames: new Set<string>(),
          latestExerciseName: exercise.name,
          latestProgressionName: progressionName,
        };

        existing.logCount += 1;
        existing.exerciseNames.add(exercise.name);

        if (new Date(log.createdAt).getTime() >= new Date(existing.lastActiveAt).getTime()) {
          existing.lastActiveAt = log.createdAt;
          existing.latestExerciseName = exercise.name;
          existing.latestProgressionName = progressionName;
        }

        grouped.set(groupKey, existing);
      }
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
    .slice(0, 8)
    .map((group) => ({
      title: group.userName,
      subtitle: `${group.exerciseNames.size} ${group.exerciseNames.size === 1 ? "exercise" : "exercises"} • ${group.logCount} ${group.logCount === 1 ? "entry" : "entries"}`,
      meta: `${group.latestExerciseName}${group.latestProgressionName ? ` • ${group.latestProgressionName}` : ""} • ${formatRelativeRecentDate(group.lastActiveAt)}`,
      href: DASHBOARD_ROUTES.community,
    }));
}

export default function DashboardHomePage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const displayTerminologyMode = !settings.showExerciseForeignLanguage && settings.languageMode === "english"
    ? "normal"
    : settings.terminologyMode;

  const isAdmin = user?.role === "admin";
  const navItems = useSortedNavItems().filter(
    (item) => (isAdmin || !ADMIN_NAV_IDS.has(item.id)) && !DASHBOARD_HOME_HIDDEN_NAV_IDS.has(item.id)
  );

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [communityCards, setCommunityCards] = useState<PreviewCard[]>([]);
  const [friendData, setFriendData] = useState<FriendPayload>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  });
  const [checkinRows, setCheckinRows] = useState<NonNullable<CheckInResponse["checkins"]>>([]);
  const [communityScope, setCommunityScope] = useState<"friends" | "community">("friends");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedScope = localStorage.getItem("community-feed-scope");
    setCommunityScope(savedScope === "community" ? "community" : "friends");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHomeContent = async () => {
      setLoading(true);
      try {
        const [historyResult, feedResult, friendsResult, checkinsResult] = await Promise.allSettled([
          api.get<ProgressionsResponse>("/api/progressions/history?logLimit=20&exerciseLimit=500", { cache: "no-store" }),
          api.get<CommunityFeedResponse>(`/api/feed?scope=${communityScope}`, { cache: "no-store" }),
          api.get<FriendPayload>("/api/friends", { cache: "no-store" }),
          api.get<CheckInResponse>("/api/checkins?scope=friends", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (historyResult.status === "fulfilled") {
          setExercises(Array.isArray(historyResult.value.exercises) ? historyResult.value.exercises : []);
        } else {
          console.error("Failed to load home progression previews:", historyResult.reason);
          setExercises([]);
        }

        if (feedResult.status === "fulfilled") {
          setCommunityCards(buildCommunityPreviewCards(feedResult.value, user?.id));
        } else {
          console.error("Failed to load home community previews:", feedResult.reason);
          setCommunityCards([]);
        }

        if (friendsResult.status === "fulfilled") {
          setFriendData({
            friends: Array.isArray(friendsResult.value.friends) ? friendsResult.value.friends : [],
            incomingRequests: Array.isArray(friendsResult.value.incomingRequests) ? friendsResult.value.incomingRequests : [],
            outgoingRequests: Array.isArray(friendsResult.value.outgoingRequests) ? friendsResult.value.outgoingRequests : [],
          });
        } else {
          console.error("Failed to load home friend previews:", friendsResult.reason);
          setFriendData({ friends: [], incomingRequests: [], outgoingRequests: [] });
        }

        if (checkinsResult.status === "fulfilled") {
          setCheckinRows(Array.isArray(checkinsResult.value.checkins) ? checkinsResult.value.checkins : []);
        } else {
          console.error("Failed to load home check-in previews:", checkinsResult.reason);
          setCheckinRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHomeContent();

    return () => {
      cancelled = true;
    };
  }, [communityScope, user?.id]);

  const exercisePreviews = useMemo<ExercisePreview[]>(() => {
    return exercises
      .map((exercise) => {
        const logs = exercise.userProgress?.flatMap((progress) => progress.logs ?? []) ?? [];
        const latestLog = [...logs].sort((a, b) => {
          const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          if (timeDiff !== 0) return timeDiff;
          return String(b.id).localeCompare(String(a.id));
        })[0] ?? null;

        return {
          id: exercise.id,
          displayName: getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage),
          category: getPrimaryCategory(exercise.category),
          totalLogs: logs.length,
          lastLogAt: latestLog?.createdAt ?? null,
          lastLogId: latestLog?.id ?? null,
        };
      })
      .sort((a, b) => {
        const aTime = a.lastLogAt ? new Date(a.lastLogAt).getTime() : 0;
        const bTime = b.lastLogAt ? new Date(b.lastLogAt).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;

        const idCompare = String(b.lastLogId ?? "").localeCompare(String(a.lastLogId ?? ""));
        if (idCompare !== 0) return idCompare;

        return a.displayName.localeCompare(b.displayName);
      });
  }, [displayTerminologyMode, exercises, settings.showExerciseForeignLanguage]);

  const categoryProgress = useMemo(() => {
    const grouped = new Map<string, { total: number; logged: number }>();

    exercisePreviews.forEach((exercise) => {
      const key = exercise.category || "Other";
      const existing = grouped.get(key) ?? { total: 0, logged: 0 };
      existing.total += 1;
      if (exercise.totalLogs > 0) existing.logged += 1;
      grouped.set(key, existing);
    });

    return Array.from(grouped.entries())
      .map(([category, value]) => ({
        category,
        total: value.total,
        logged: value.logged,
        pct: value.total > 0 ? Math.round((value.logged / value.total) * 100) : 0,
      }))
      .sort((a, b) => b.logged - a.logged || a.category.localeCompare(b.category));
  }, [exercisePreviews]);

  const checkinCards = useMemo<PreviewCard[]>(() => {
    const rows = [...checkinRows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const todayKey = getTodayDateKey(settings.timeZone);
    const presentRows = rows.filter((row) => row.present);
    const todayCount = presentRows.filter((row) => String(row.date).slice(0, 10) === todayKey).length;
    const yourLatest = presentRows.find((row) => row.userId === user?.id);
    const visibleCultivators = new Set(presentRows.map((row) => row.userId)).size;

    const cards: PreviewCard[] = [
      {
        title: todayCount > 0 ? `${todayCount} checked in today` : "No check-ins yet today",
        subtitle: todayCount > 0 ? "Visible attendance from the Check-In page" : "Open Check-In to mark today’s status",
        meta: `${visibleCultivators} cultivators in recent attendance`,
        href: DASHBOARD_ROUTES.checkIn,
      },
    ];

    if (yourLatest) {
      cards.push({
        title: "Your latest check-in",
        subtitle: String(yourLatest.date).slice(0, 10),
        meta: yourLatest.comment?.trim() ? yourLatest.comment.trim().slice(0, 42) : "Attendance recorded",
        href: DASHBOARD_ROUTES.attendance,
      });
    }

    const latestVisible = presentRows.find((row) => row.userId !== user?.id && row.user?.name);
    if (latestVisible?.user?.name) {
      cards.push({
        title: latestVisible.user.name,
        subtitle: "Recent visible attendance",
        meta: `Checked in ${formatRelativeRecentDate(`${String(latestVisible.date).slice(0, 10)}T00:00:00`)}`,
        href: DASHBOARD_ROUTES.checkIn,
      });
    }

    return cards;
  }, [checkinRows, settings.timeZone, user?.id]);

  const friendCards = useMemo<PreviewCard[]>(() => {
    const pendingCount = (friendData.incomingRequests?.length ?? 0) + (friendData.outgoingRequests?.length ?? 0);
    const rowsByUser = new Map<string, NonNullable<CheckInResponse["checkins"]>>();

    for (const row of checkinRows) {
      const existing = rowsByUser.get(row.userId) ?? [];
      existing.push(row);
      rowsByUser.set(row.userId, existing);
    }

    const sortedFriends = [...(friendData.friends ?? [])].sort((left, right) => {
      const leftLatest = (rowsByUser.get(left.id) ?? [])
        .filter((row) => row.present)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.date ?? "";
      const rightLatest = (rowsByUser.get(right.id) ?? [])
        .filter((row) => row.present)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.date ?? "";

      if (leftLatest !== rightLatest) return String(rightLatest).localeCompare(String(leftLatest));
      return left.name.localeCompare(right.name);
    });

    const cards: PreviewCard[] = [
      {
        title: `${friendData.friends?.length ?? 0} friends`,
        subtitle: pendingCount > 0 ? `${pendingCount} pending requests` : "Your cultivation circle",
        meta: pendingCount > 0 ? "Open Friends to review requests" : "Manage your social circle",
        href: DASHBOARD_ROUTES.friends,
      },
      ...sortedFriends.slice(0, 7).map((friend) => {
        const latest = (rowsByUser.get(friend.id) ?? [])
          .filter((row) => row.present)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

        return {
          title: friend.name,
          subtitle: friend.username ? `@${friend.username}` : "Friend",
          meta: latest
            ? `Last check-in ${formatRelativeRecentDate(`${String(latest.date).slice(0, 10)}T00:00:00`)}`
            : "No shared check-ins yet",
          href: DASHBOARD_ROUTES.friends,
        };
      }),
    ];

    return cards;
  }, [checkinRows, friendData]);

  const cardsByNavId = useMemo<Record<string, PreviewCard[]>>(() => {
    const trainCards: PreviewCard[] = exercisePreviews.slice(0, 8).map((exercise) => ({
      title: exercise.displayName,
      subtitle: exercise.category,
      meta: exercise.totalLogs > 0 ? `${exercise.totalLogs} logs • last trained ${formatRelativeRecentDate(exercise.lastLogAt)}` : "Ready to log",
      href: `${DASHBOARD_ROUTES.workoutHistory}/${encodeURIComponent(exercise.id)}?from=exercises`,
    }));

    const historyCards: PreviewCard[] = Array.from(
      new Map(
        exercises
          .flatMap((exercise) => {
            const displayName = getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage);
            const category = getPrimaryCategory(exercise.category);

            return (exercise.userProgress ?? []).flatMap((progress) =>
              (progress.logs ?? []).map((log) => ({
                exerciseId: exercise.id,
                createdAt: log.createdAt,
                card: {
                  title: displayName,
                  subtitle: category,
                  meta: `${exercise.tiers?.find((tier) => tier.level === log.level)?.name ?? `Level ${log.level}`} • ${formatRelativeRecentDate(log.createdAt)}`,
                  href: `${DASHBOARD_ROUTES.workoutHistory}/${encodeURIComponent(exercise.id)}?from=history`,
                },
              }))
            );
          })
          .sort((a, b) => {
            const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (timeDiff !== 0) return timeDiff;
            return b.exerciseId.localeCompare(a.exerciseId);
          })
          .map((item) => [item.exerciseId, item.card] as const)
      ).values()
    ).slice(0, 8);

    const completionistCards: PreviewCard[] = categoryProgress.slice(0, 8).map((category) => ({
      title: category.category,
      subtitle: `${category.logged}/${category.total} progressions logged`,
      meta: `${category.pct}% completion coverage`,
      href: DASHBOARD_ROUTES.rankUp,
    }));

    const libraryCards: PreviewCard[] = categoryProgress.slice(0, 8).map((category) => ({
      title: category.category,
      subtitle: `${category.total} ${category.total === 1 ? "exercise" : "exercises"} in library`,
      meta: `${category.logged} trained so far`,
      href: DASHBOARD_ROUTES.exercises,
    }));

    return {
      dashboard: [
        { title: "Start training", subtitle: "Open the Train flow", meta: "Log your next session", href: DASHBOARD_ROUTES.workoutHistory },
        { title: "Daily check-in", subtitle: "Keep your rhythm going", meta: "Track routine and streaks", href: DASHBOARD_ROUTES.checkIn },
        { title: "Exercise library", subtitle: "Browse your movements", meta: "See progressions and variations", href: DASHBOARD_ROUTES.exercises },
      ],
      newsfeed: communityCards.length > 0
        ? communityCards
        : [
            {
              title: communityScope === "community" ? "Community activity" : "Friends activity",
              subtitle: communityScope === "community" ? "Live updates from visible users" : "Live updates from your circle",
              meta: "Opens the same feed shown in Community",
              href: DASHBOARD_ROUTES.community,
            },
            {
              title: "Scope preview",
              subtitle: communityScope === "community" ? "Currently showing community scope" : "Currently showing friends scope",
              meta: "Switch scope in the Community page",
              href: DASHBOARD_ROUTES.community,
            },
          ],
      history: trainCards.length > 0
        ? trainCards
        : [
            { title: "No exercises yet", subtitle: "Your recent movements will appear here", meta: "Start logging to populate Train", href: DASHBOARD_ROUTES.workoutHistory },
          ],
      "training-log-history": historyCards.length > 0
        ? historyCards
        : [
            { title: "Recent history", subtitle: "Past sessions show up here", meta: "Review your training timeline", href: DASHBOARD_ROUTES.trainingLogHistory },
          ],
      checkin: checkinCards.length > 0
        ? checkinCards
        : [
            { title: "Check in today", subtitle: "Log your daily status", meta: "Routine, consistency, progress", href: DASHBOARD_ROUTES.checkIn },
          ],
      "exercise-db": libraryCards.length > 0
        ? libraryCards
        : [
            { title: "Exercise library", subtitle: "Your movement collection lives here", meta: "Browse by progression and category", href: DASHBOARD_ROUTES.exercises },
          ],
      friends: friendCards.length > 0
        ? friendCards
        : [
            { title: "Friends list", subtitle: "Open your cultivation circle", meta: "Manage connections and requests", href: DASHBOARD_ROUTES.friends },
          ],
      "rank-up": completionistCards.length > 0
        ? completionistCards
        : [
            { title: "Coverage summary", subtitle: "Your logged progressions appear here", meta: "Open Completionist to review", href: DASHBOARD_ROUTES.rankUp },
          ],
    };
  }, [categoryProgress, checkinCards, communityCards, communityScope, displayTerminologyMode, exercisePreviews, exercises, friendCards, settings.showExerciseForeignLanguage]);

  const sections = navItems.map((item) => ({
    item,
    cards: cardsByNavId[item.id] ?? [
      {
        title: item.label,
        subtitle: "Open this page",
        meta: "More content will appear here",
        href: item.path,
      },
    ],
  }));

  return (
    <PageLayout
      title="Home"
      subtitle="Swipeable hub"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">
        {sections.map(({ item, cards }, sectionIndex) => (
          <section key={item.id} className="space-y-2">
            <div className="flex items-center gap-2 px-1 sm:px-2">
              <span className="text-base">{item.icon}</span>
              <Link href={item.path} className="text-base font-semibold text-[#f2f3f5] hover:text-[#8ea1e1] transition-colors">
                {item.label}
              </Link>
            </div>

            <div className="overflow-x-auto scrollbar-hide px-1 py-1 sm:px-2">
              <div className="flex min-w-max gap-2.5 sm:gap-3">
                {cards.map((card, index) => (
                  <motion.div
                    key={`${item.id}-${card.title}-${index}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: sectionIndex * 0.03 + index * 0.02 }}
                    className="shrink-0"
                  >
                    <Link
                      href={card.href}
                      className="group flex min-h-[165px] w-[150px] flex-col justify-between rounded-lg border px-3 py-3.5 transition-all duration-200 hover:border-[#7289da]/55 hover:bg-[#313338] sm:min-h-[180px] sm:w-[165px]"
                      style={{
                        borderColor: "rgba(59, 63, 72, 0.78)",
                        backgroundColor: "rgba(43, 45, 49, 0.88)",
                      }}
                    >
                      <div>
                        <h3 className="text-sm font-semibold leading-snug text-[#f2f3f5]">{card.title}</h3>
                        <p className="mt-1.5 text-[12px] leading-snug text-[#dbdee1]">{card.subtitle}</p>
                      </div>
                      {card.meta ? (
                        <p className="mt-3 text-[11px] leading-snug text-[#949ba4]">{card.meta}</p>
                      ) : null}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
