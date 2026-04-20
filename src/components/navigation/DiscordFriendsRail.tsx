"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { api } from "@/lib/api-client";
import { useIsMobile } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import type { ProgressionExercise, ProgressionLog } from "@/app/dashboard/workout/types";

interface FriendsPayload {
  friends?: Array<{
    id: string;
    name: string;
    username?: string | null;
    createdAt?: string | Date | null;
    updatedAt?: string | Date | null;
    sessionCount?: number | null;
    checkInCount?: number | null;
    lastWorkoutAt?: string | Date | null;
    lastCheckInAt?: string | Date | null;
    lastActivityAt?: string | Date | null;
    lastActivityLabel?: string | null;
  }>;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatRelativeRecentDate(dateLike: string): string {
  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "just now";

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

function getRecentExerciseTextColor(dateLike: string | null | undefined, isSelected = false): string {
  const defaultColor = isSelected ? "var(--cloud-white)" : "var(--text-muted)";
  if (!dateLike) return defaultColor;

  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return defaultColor;

  const diffMs = Math.max(0, Date.now() - timestamp);
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs <= 7 * dayMs) {
    return isSelected
      ? "color-mix(in srgb, var(--cultivator-amber) 58%, white 42%)"
      : "color-mix(in srgb, var(--cultivator-amber) 68%, white 32%)";
  }

  if (diffMs <= 14 * dayMs) {
    return isSelected
      ? "color-mix(in srgb, var(--cultivator-amber) 68%, var(--mist-light) 32%)"
      : "color-mix(in srgb, var(--cultivator-amber) 58%, var(--mist-dark) 42%)";
  }

  return defaultColor;
}

function getWorkoutMetricRows(log: ProgressionLog): Array<{ weight: string; reps: string }> {
  const hasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
  const primaryRows = (hasHold
    ? [log.holdTime, log.holdTime2, log.holdTime3]
    : [log.weight1, log.weight2, log.weight3]
  ).map((metric, index) => {
    const reps = [log.reps1, log.reps2, log.reps3][index];
    if (metric == null && reps == null) return null;
    return {
      weight: metric == null ? "-" : hasHold ? `${metric}s` : `${metric} kg`,
      reps: reps == null ? "-" : String(reps),
    };
  }).filter((row): row is { weight: string; reps: string } => Boolean(row));

  const extraRows = Array.isArray(log.dynamicSetRows) ? log.dynamicSetRows : [];
  const rows = [...primaryRows, ...extraRows].filter((row) => row.weight !== "-" || row.reps !== "-");
  return rows.length > 0 ? rows : [{ weight: "-", reps: "-" }];
}

function DiscordFriendsRail({ incomingFriendRequestCount = 0 }: { incomingFriendRequestCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const isActive = pathname === DASHBOARD_ROUTES.friends || pathname?.startsWith(`${DASHBOARD_ROUTES.friends}/`);
  const drawerFriendId = searchParams.get("friendDrawerId") || "";
  const rawFriendView = searchParams.get("friendView") || "";
  const selectedFriendExerciseId = searchParams.get("friendExerciseId") || "";
  const friendViewMode = rawFriendView === "history" || rawFriendView === "chart" || rawFriendView === "checkin" || rawFriendView === "chat" ? rawFriendView : "";
  const targetViewUserId = searchParams.get("targetUserId") || "";
  const [friends, setFriends] = useState<Array<{
    id: string;
    name: string;
    username?: string;
    createdAt?: string;
    updatedAt?: string;
    sessionCount?: number;
    checkInCount?: number;
    lastWorkoutAt?: string;
    lastCheckInAt?: string;
    lastActivityAt?: string;
    lastActivityLabel?: string;
  }>>([]);
  const [friendActionsOpen, setFriendActionsOpen] = useState(false);
  const [activeFriend, setActiveFriend] = useState<{
    id: string;
    name: string;
    username?: string;
    createdAt?: string;
    updatedAt?: string;
    sessionCount?: number;
    checkInCount?: number;
    lastWorkoutAt?: string;
    lastCheckInAt?: string;
    lastActivityAt?: string;
    lastActivityLabel?: string;
  } | null>(null);
  const [friendHistoryExercises, setFriendHistoryExercises] = useState<ProgressionExercise[]>([]);
  const [friendHistoryLoading, setFriendHistoryLoading] = useState(false);
  const [friendHistorySearchOpen, setFriendHistorySearchOpen] = useState(false);
  const [friendHistorySearchQuery, setFriendHistorySearchQuery] = useState("");
  const [friendHistoryFilterOpen, setFriendHistoryFilterOpen] = useState(false);
  const [friendHistorySort, setFriendHistorySort] = useState<"recent" | "oldest" | "name-az">("recent");
  const [friendHistoryRecency, setFriendHistoryRecency] = useState<"all" | "7d" | "30d">("all");
  const [friendExerciseSearchOpen, setFriendExerciseSearchOpen] = useState(false);
  const [friendExerciseSearchQuery, setFriendExerciseSearchQuery] = useState("");
  const [friendExerciseFilterOpen, setFriendExerciseFilterOpen] = useState(false);
  const [friendExerciseProgressionFilter, setFriendExerciseProgressionFilter] = useState("all");
  const [friendExerciseVariantFilter, setFriendExerciseVariantFilter] = useState("all");
  const [friendExerciseWeightFilter, setFriendExerciseWeightFilter] = useState<"all" | "weighted" | "bodyweight">("all");
  const [friendExerciseRepsFilter, setFriendExerciseRepsFilter] = useState<"all" | "1-5" | "6-10" | "11+">("all");
  const [friendExerciseSort, setFriendExerciseSort] = useState<"recent" | "oldest" | "progression-asc" | "progression-desc">("recent");
  const railWidthPx = isMobile ? 64 : 76;
  const friendHistorySearchInputRef = useRef<HTMLInputElement | null>(null);
  const friendExerciseSearchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !friendHistorySearchOpen) return;
    const frame = window.requestAnimationFrame(() => {
      friendHistorySearchInputRef.current?.focus();
      friendHistorySearchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [friendHistorySearchOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !friendExerciseSearchOpen) return;
    const frame = window.requestAnimationFrame(() => {
      friendExerciseSearchInputRef.current?.focus();
      friendExerciseSearchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [friendExerciseSearchOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadFriends = async () => {
      try {
        const payload = await api.get<FriendsPayload>("/api/friends", { cache: "no-store" });
        if (cancelled) return;

        const normalized = Array.isArray(payload.friends)
          ? payload.friends
              .filter((friend) => typeof friend?.id === "string")
              .map((friend) => ({
                id: friend.id,
                name: (friend.name || friend.username || "Friend").trim() || "Friend",
                username: (friend.username || "").trim() || undefined,
                createdAt: friend.createdAt ? new Date(friend.createdAt).toISOString() : undefined,
                updatedAt: friend.updatedAt ? new Date(friend.updatedAt).toISOString() : undefined,
                sessionCount: typeof friend.sessionCount === "number" ? friend.sessionCount : 0,
                checkInCount: typeof friend.checkInCount === "number" ? friend.checkInCount : 0,
                lastWorkoutAt: friend.lastWorkoutAt ? new Date(friend.lastWorkoutAt).toISOString() : undefined,
                lastCheckInAt: friend.lastCheckInAt ? new Date(friend.lastCheckInAt).toISOString() : undefined,
                lastActivityAt: friend.lastActivityAt ? new Date(friend.lastActivityAt).toISOString() : undefined,
                lastActivityLabel: typeof friend.lastActivityLabel === "string" ? friend.lastActivityLabel.trim() || undefined : undefined,
              }))
          : [];

        setFriends(normalized);
      } catch {
        if (!cancelled) setFriends([]);
      }
    };

    void loadFriends();

    return () => {
      cancelled = true;
    };
  }, []);

  const railUsers = useMemo(() => {
    return friends
      .filter((friend) => friend.id !== user?.id)
      .slice(0, 6)
      .map((friend) => ({ ...friend, isMe: false }));
  }, [friends, user?.id]);

  const setDrawerQueryState = (
    friendId: string | null,
    options: { view?: "history" | "chart" | "checkin" | "chat" | null; exerciseId?: string | null; mode?: "push" | "replace" } = {},
  ) => {
    const { view = null, exerciseId = null, mode = "replace" } = options;
    const params = new URLSearchParams(searchParams.toString());
    if (friendId) {
      params.set("friendDrawerId", friendId);
    } else {
      params.delete("friendDrawerId");
    }

    if (view) {
      params.set("friendView", view);
    } else {
      params.delete("friendView");
    }

    if (exerciseId) {
      params.set("friendExerciseId", exerciseId);
    } else {
      params.delete("friendExerciseId");
    }

    params.delete("targetUserId");

    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;

    if (mode === "push") {
      router.push(href, { scroll: false });
    } else {
      router.replace(href, { scroll: false });
    }
  };

  const closeFriendPanels = (resetTrainView = true) => {
    setFriendActionsOpen(false);
    setActiveFriend(null);
    setDrawerQueryState(null, { mode: "replace" });
    if (resetTrainView && typeof window !== "undefined") {
      window.dispatchEvent(new Event("train-reset-view"));
    }
  };

  useEffect(() => {
    if (!drawerFriendId) {
      setFriendActionsOpen(false);
      setActiveFriend(null);
      return;
    }

    const matchedFriend = railUsers.find((friend) => !friend.isMe && friend.id === drawerFriendId);
    if (!matchedFriend) return;

    setActiveFriend((current) => {
      if (
        current?.id === matchedFriend.id
        && current?.name === matchedFriend.name
        && current?.username === ("username" in matchedFriend ? matchedFriend.username : undefined)
        && current?.createdAt === ("createdAt" in matchedFriend ? matchedFriend.createdAt : undefined)
        && current?.updatedAt === ("updatedAt" in matchedFriend ? matchedFriend.updatedAt : undefined)
        && current?.sessionCount === ("sessionCount" in matchedFriend ? matchedFriend.sessionCount : undefined)
        && current?.checkInCount === ("checkInCount" in matchedFriend ? matchedFriend.checkInCount : undefined)
        && current?.lastWorkoutAt === ("lastWorkoutAt" in matchedFriend ? matchedFriend.lastWorkoutAt : undefined)
        && current?.lastCheckInAt === ("lastCheckInAt" in matchedFriend ? matchedFriend.lastCheckInAt : undefined)
        && current?.lastActivityAt === ("lastActivityAt" in matchedFriend ? matchedFriend.lastActivityAt : undefined)
        && current?.lastActivityLabel === ("lastActivityLabel" in matchedFriend ? matchedFriend.lastActivityLabel : undefined)
      ) {
        return current;
      }

      return {
        id: matchedFriend.id,
        name: matchedFriend.name,
        username: "username" in matchedFriend ? matchedFriend.username : undefined,
        createdAt: "createdAt" in matchedFriend ? matchedFriend.createdAt : undefined,
        updatedAt: "updatedAt" in matchedFriend ? matchedFriend.updatedAt : undefined,
        sessionCount: "sessionCount" in matchedFriend ? matchedFriend.sessionCount : undefined,
        checkInCount: "checkInCount" in matchedFriend ? matchedFriend.checkInCount : undefined,
        lastWorkoutAt: "lastWorkoutAt" in matchedFriend ? matchedFriend.lastWorkoutAt : undefined,
        lastCheckInAt: "lastCheckInAt" in matchedFriend ? matchedFriend.lastCheckInAt : undefined,
        lastActivityAt: "lastActivityAt" in matchedFriend ? matchedFriend.lastActivityAt : undefined,
        lastActivityLabel: "lastActivityLabel" in matchedFriend ? matchedFriend.lastActivityLabel : undefined,
      };
    });
    setFriendActionsOpen(!friendViewMode && !targetViewUserId);
  }, [drawerFriendId, friendViewMode, railUsers, targetViewUserId]);

  useEffect(() => {
    if (friendViewMode !== "history" || !activeFriend?.id) {
      setFriendHistoryExercises([]);
      setFriendHistoryLoading(false);
      return;
    }

    let cancelled = false;

    const loadFriendHistory = async () => {
      setFriendHistoryLoading(true);
      try {
        const params = new URLSearchParams({ targetUserId: activeFriend.id, logLimit: "200" });
        const payload = await api.get<{ exercises: ProgressionExercise[] }>(`/api/progressions/history?${params.toString()}`);
        if (!cancelled) {
          setFriendHistoryExercises(Array.isArray(payload.exercises) ? payload.exercises : []);
        }
      } catch {
        if (!cancelled) {
          setFriendHistoryExercises([]);
        }
      } finally {
        if (!cancelled) {
          setFriendHistoryLoading(false);
        }
      }
    };

    void loadFriendHistory();

    return () => {
      cancelled = true;
    };
  }, [activeFriend?.id, friendViewMode]);

  const friendHistoryRows = useMemo(() => {
    const rows: Array<{ exerciseId: string; exerciseName: string; date: string; progression: string; variant: string }> = [];

    for (const exercise of friendHistoryExercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      if (logs.length === 0) continue;

      const latestLog = [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const tierName = exercise.tiers.find((tier) => tier.level === latestLog.level)?.name ?? `Progression ${latestLog.level}`;

      rows.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        date: latestLog.createdAt,
        progression: tierName,
        variant: latestLog.variant?.trim() || "",
      });
    }

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  }, [friendHistoryExercises]);

  const filteredFriendHistoryRows = useMemo(() => {
    const query = friendHistorySearchQuery.trim().toLowerCase();
    const dayMs = 24 * 60 * 60 * 1000;

    const filtered = friendHistoryRows.filter((row) => {
      const matchesQuery = !query || `${row.exerciseName} ${row.progression} ${row.variant}`.toLowerCase().includes(query);
      if (!matchesQuery) return false;

      if (friendHistoryRecency === "all") return true;
      const ageMs = Date.now() - new Date(row.date).getTime();
      if (!Number.isFinite(ageMs)) return false;
      if (friendHistoryRecency === "7d") return ageMs <= 7 * dayMs;
      if (friendHistoryRecency === "30d") return ageMs <= 30 * dayMs;
      return true;
    });

    const sorted = [...filtered];
    if (friendHistorySort === "oldest") {
      sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (friendHistorySort === "name-az") {
      sorted.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
    } else {
      sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return sorted;
  }, [friendHistoryRecency, friendHistoryRows, friendHistorySearchQuery, friendHistorySort]);

  const selectedFriendExercise = useMemo(() => {
    if (!selectedFriendExerciseId) return null;
    return friendHistoryExercises.find((exercise) => exercise.id === selectedFriendExerciseId) ?? null;
  }, [friendHistoryExercises, selectedFriendExerciseId]);

  const selectedFriendExerciseLogs = useMemo(() => {
    const logs = selectedFriendExercise?.userProgress?.[0]?.logs ?? [];
    return [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedFriendExercise]);

  const friendExerciseProgressionOptions = useMemo(() => {
    return Array.from(
      new Set(
        selectedFriendExerciseLogs.map((log) => selectedFriendExercise?.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [selectedFriendExercise, selectedFriendExerciseLogs]);

  const friendExerciseVariantOptions = useMemo(() => {
    return Array.from(new Set(selectedFriendExerciseLogs.map((log) => log.variant?.trim() || "-"))).sort((a, b) => a.localeCompare(b));
  }, [selectedFriendExerciseLogs]);

  const filteredSelectedFriendExerciseLogs = useMemo(() => {
    const query = friendExerciseSearchQuery.trim().toLowerCase();
    const filtered = selectedFriendExerciseLogs.filter((log) => {
      const progressionName = selectedFriendExercise?.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`;
      const variationValue = log.variant?.trim() || "-";
      const metricRows = getWorkoutMetricRows(log);
      const hasWeightedValue = metricRows.some((row) => row.weight !== "-" && !row.weight.endsWith("s"));
      const reps = metricRows
        .map((row) => Number.parseInt(row.reps, 10))
        .filter((value): value is number => Number.isFinite(value) && value > 0);
      const maxReps = reps.length > 0 ? Math.max(...reps) : null;

      const matchesQuery = !query || `${progressionName} ${variationValue} ${log.modifier || ""} ${log.notes || ""}`.toLowerCase().includes(query);
      const matchesProgression = friendExerciseProgressionFilter === "all" || progressionName === friendExerciseProgressionFilter;
      const matchesVariant = friendExerciseVariantFilter === "all" || variationValue === friendExerciseVariantFilter;
      const matchesWeight = friendExerciseWeightFilter === "all"
        || (friendExerciseWeightFilter === "weighted" && hasWeightedValue)
        || (friendExerciseWeightFilter === "bodyweight" && !hasWeightedValue);
      const matchesReps = friendExerciseRepsFilter === "all"
        || (friendExerciseRepsFilter === "1-5" && maxReps != null && maxReps >= 1 && maxReps <= 5)
        || (friendExerciseRepsFilter === "6-10" && maxReps != null && maxReps >= 6 && maxReps <= 10)
        || (friendExerciseRepsFilter === "11+" && maxReps != null && maxReps >= 11);

      return matchesQuery && matchesProgression && matchesVariant && matchesWeight && matchesReps;
    });

    const sorted = [...filtered];
    if (friendExerciseSort === "oldest") {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (friendExerciseSort === "progression-asc") {
      sorted.sort((a, b) => a.level - b.level || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (friendExerciseSort === "progression-desc") {
      sorted.sort((a, b) => b.level - a.level || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return sorted;
  }, [friendExerciseProgressionFilter, friendExerciseRepsFilter, friendExerciseSearchQuery, friendExerciseSort, friendExerciseVariantFilter, friendExerciseWeightFilter, selectedFriendExercise, selectedFriendExerciseLogs]);

  useEffect(() => {
    setFriendHistorySearchOpen(false);
    setFriendHistorySearchQuery("");
    setFriendHistoryFilterOpen(false);
    setFriendHistorySort("recent");
    setFriendHistoryRecency("all");
  }, [activeFriend?.id]);

  useEffect(() => {
    setFriendExerciseSearchOpen(false);
    setFriendExerciseSearchQuery("");
    setFriendExerciseFilterOpen(false);
    setFriendExerciseProgressionFilter("all");
    setFriendExerciseVariantFilter("all");
    setFriendExerciseWeightFilter("all");
    setFriendExerciseRepsFilter("all");
    setFriendExerciseSort("recent");
  }, [selectedFriendExerciseId]);

  const selectedRailFriendId = drawerFriendId || activeFriend?.id || "";
  const hasFriendDrawerOpen = Boolean(selectedRailFriendId && (friendActionsOpen || friendViewMode || targetViewUserId));
  const isFriendsHomeActive = isActive && !hasFriendDrawerOpen;

  const selectedActivityMeta = useMemo(() => {
    const latestKnownActivity = [activeFriend?.lastActivityAt, activeFriend?.lastWorkoutAt, activeFriend?.lastCheckInAt]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    const navigationLabel = activeFriend?.lastActivityLabel?.trim();
    const navigationValue = activeFriend?.lastActivityAt
      ? `${navigationLabel ? `${navigationLabel} • ` : ""}${formatRelativeRecentDate(activeFriend.lastActivityAt)}`
      : "-";

    if (friendViewMode === "history") {
      return { label: "Last History", value: activeFriend?.lastWorkoutAt ? formatRelativeRecentDate(activeFriend.lastWorkoutAt) : navigationValue };
    }
    if (friendViewMode === "chart") {
      return { label: "Last Chart", value: activeFriend?.lastWorkoutAt ? formatRelativeRecentDate(activeFriend.lastWorkoutAt) : navigationValue };
    }
    if (friendViewMode === "checkin") {
      return { label: "Last Check-In", value: activeFriend?.lastCheckInAt ? formatRelativeRecentDate(activeFriend.lastCheckInAt) : navigationValue };
    }
    if (friendViewMode === "chat") {
      return { label: "Last Chat", value: navigationValue };
    }

    return { label: "Last Activity", value: latestKnownActivity ? (activeFriend?.lastActivityAt === latestKnownActivity ? navigationValue : formatRelativeRecentDate(latestKnownActivity)) : "-" };
  }, [activeFriend?.lastActivityAt, activeFriend?.lastActivityLabel, activeFriend?.lastCheckInAt, activeFriend?.lastWorkoutAt, friendViewMode]);

  const friendActionItems = useMemo(() => ([
    {
      id: "history" as const,
      label: "History",
      hint: activeFriend?.lastWorkoutAt ? `Last workout ${formatRelativeRecentDate(activeFriend.lastWorkoutAt)}` : "No workout history yet",
    },
    {
      id: "chart" as const,
      label: "Chart",
      hint: activeFriend?.lastWorkoutAt ? `Uses workout data from ${formatRelativeRecentDate(activeFriend.lastWorkoutAt)}` : "No chart data yet",
    },
    {
      id: "checkin" as const,
      label: "Check-In",
      hint: activeFriend?.lastCheckInAt ? `Last check-in ${formatRelativeRecentDate(activeFriend.lastCheckInAt)}` : "No check-ins yet",
    },
    {
      id: "chat" as const,
      label: "Chat",
      hint: activeFriend?.lastActivityAt
        ? `${activeFriend?.lastActivityLabel || "Last seen"} • ${formatRelativeRecentDate(activeFriend.lastActivityAt)}`
        : "Coming soon",
    },
  ]), [activeFriend?.lastActivityAt, activeFriend?.lastActivityLabel, activeFriend?.lastCheckInAt, activeFriend?.lastWorkoutAt]);

  return (
    <>
      <aside
        className="flex h-full w-[64px] md:w-[76px] shrink-0"
        style={{
          borderRightWidth: 0,
          borderRightColor: "transparent",
          background: "var(--sidebar-canvas-bg)",
        }}
      >
        <div className="flex h-full w-full flex-col items-center gap-3 px-2 pt-[calc(env(safe-area-inset-top,0px)+2.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] md:pb-3">
          <div className="flex w-full items-center justify-center">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                closeFriendPanels(false);
                router.push(DASHBOARD_ROUTES.friends);
              }}
              aria-current={isFriendsHomeActive ? "page" : undefined}
              aria-label="Friends"
              className="relative mx-auto flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-2xl border transition-colors duration-150"
              style={{
                borderColor: isFriendsHomeActive
                  ? "color-mix(in srgb, var(--accent) 62%, transparent)"
                  : "color-mix(in srgb, var(--sidebar-canvas-border) 92%, transparent)",
                backgroundColor: isFriendsHomeActive
                  ? "var(--jade)"
                  : "color-mix(in srgb, var(--surface-hover) 92%, var(--surface))",
                color: isFriendsHomeActive ? "var(--pure-white)" : "var(--mist-light)",
                boxShadow: isFriendsHomeActive
                  ? "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 10px 22px color-mix(in srgb, var(--accent) 28%, transparent)"
                  : "none",
              }}
              title="Friends"
            >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 100-8 4 4 0 000 8M8 12a4 4 0 100-8 4 4 0 000 8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 20a6 6 0 0112 0M14 20a6 6 0 018 0" />
            </svg>

            {incomingFriendRequestCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{ backgroundColor: "var(--danger)", color: "var(--pure-white)" }}
              >
                {incomingFriendRequestCount > 99 ? "99+" : incomingFriendRequestCount}
              </span>
            )}

              {isFriendsHomeActive && (
                <span
                  className="pointer-events-none absolute -left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                  style={{ backgroundColor: "var(--cloud-white)" }}
                />
              )}
            </motion.button>
          </div>

          <div className="flex w-full items-center justify-center">
            <div className="h-px w-8" style={{ backgroundColor: "color-mix(in srgb, var(--sidebar-canvas-border) 88%, transparent)" }} />
          </div>

          <div data-mobile-scroll-container="true" className="flex w-full min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
            {railUsers.map((friend) => {
              const isSelected = selectedRailFriendId === friend.id && hasFriendDrawerOpen;

              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => {
                    if (friend.isMe) {
                      closeFriendPanels(false);
                      router.push(DASHBOARD_ROUTES.workoutHistory);
                      return;
                    }

                    if (friendActionsOpen && activeFriend?.id === friend.id) {
                      closeFriendPanels(false);
                      return;
                    }

                    setActiveFriend({
                      id: friend.id,
                      name: friend.name,
                      username: "username" in friend ? friend.username : undefined,
                      createdAt: "createdAt" in friend ? friend.createdAt : undefined,
                      updatedAt: "updatedAt" in friend ? friend.updatedAt : undefined,
                      sessionCount: "sessionCount" in friend ? friend.sessionCount : undefined,
                      checkInCount: "checkInCount" in friend ? friend.checkInCount : undefined,
                    });
                    setFriendActionsOpen(true);
                    setDrawerQueryState(friend.id, { mode: "push" });
                  }}
                  className="group relative flex h-12 w-12 items-center justify-center text-center transition-all duration-150 md:h-14 md:w-14"
                  style={{
                    borderColor: "transparent",
                    backgroundColor: "transparent",
                    boxShadow: "none",
                  }}
                  title={friend.name}
                  aria-label={`Open ${friend.name} actions`}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <span
                      className="pointer-events-none absolute -left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                      style={{ backgroundColor: "var(--cloud-white)" }}
                    />
                  )}

                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full border font-semibold transition-all duration-150 md:h-11 md:w-11"
                    style={{
                      color: "var(--cloud-white)",
                      fontSize: "10px",
                      borderColor: isSelected
                        ? "color-mix(in srgb, var(--accent) 72%, transparent)"
                        : "color-mix(in srgb, var(--sidebar-canvas-border) 88%, transparent)",
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--accent) 30%, var(--surface))"
                        : "color-mix(in srgb, var(--surface-hover) 92%, var(--surface))",
                      boxShadow: isSelected
                        ? "0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent)"
                        : "none",
                    }}
                  >
                    {initials(friend.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {(friendActionsOpen || Boolean(friendViewMode)) && activeFriend && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-y-0 right-0 z-[69]"
              style={{
                left: `${railWidthPx}px`,
                backgroundColor: "color-mix(in srgb, var(--void-black) 76%, transparent)",
              }}
              onClick={() => closeFriendPanels(false)}
            />

            {friendActionsOpen && (
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: "0%" }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 right-0 z-[71] border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                style={{
                  left: `${railWidthPx}px`,
                  borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                }}
              >
                <div
                  className="h-full border overflow-hidden"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
                  }}
                >
                  <div
                    data-mobile-scroll-container="true"
                    className="h-full overflow-y-auto scrollbar-hide pb-[calc(var(--mobile-nav-offset)+max(env(safe-area-inset-bottom,0px),12px))]"
                    style={{ overscrollBehavior: "contain" }}
                  >
                    <div className="sticky top-0 z-20" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                      <div className="px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              closeFriendPanels(false);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                            style={{
                              color: "var(--mist-light)",
                              backgroundColor: "transparent",
                            }}
                            aria-label="Back from friend drawer"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                            {`${activeFriend.name} Train`}
                          </h2>
                        </div>
                      </div>
                      <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                    </div>

                    <div>
                      <div
                        className="mx-1 mt-1 mb-1.5 rounded-md border px-2.5 py-2"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                          backgroundColor: "rgba(35, 36, 40, 0.32)",
                        }}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Friend Profile</p>
                            <p className="truncate text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{activeFriend.name}</p>
                            <p className="truncate text-[10px]" style={{ color: "var(--text-secondary)" }}>@{activeFriend.username || activeFriend.name.toLowerCase().replace(/\s+/g, "")}</p>
                          </div>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--forest)" }} />
                        </div>

                        <div className="space-y-1 text-[10px]">
                          {[
                            { label: "Sessions", value: String(activeFriend.sessionCount ?? 0) },
                            { label: "Check-Ins", value: String(activeFriend.checkInCount ?? 0) },
                            { label: "Member Since", value: activeFriend.createdAt ? new Date(activeFriend.createdAt).toLocaleDateString() : "-" },
                            { label: selectedActivityMeta.label, value: selectedActivityMeta.value },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between gap-3 rounded-sm px-1.5 py-1"
                              style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
                            >
                              <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                              <span className="truncate text-right font-semibold" style={{ color: "var(--text-primary)" }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {friendActionItems.map((item) => (
                        <article
                          key={item.id}
                          className="mx-1 my-0.5 rounded-md px-3 py-2.5"
                          style={{
                            borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)",
                            cursor: "pointer",
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setDrawerQueryState(activeFriend.id, { view: item.id as "history" | "chart" | "checkin" | "chat", mode: "push" });
                            setFriendActionsOpen(false);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setDrawerQueryState(activeFriend.id, { view: item.id as "history" | "chart" | "checkin" | "chat", mode: "push" });
                              setFriendActionsOpen(false);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-muted)" }}>
                              {item.label}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                            {item.hint}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}

            {friendViewMode && (
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: "0%" }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 right-0 z-[72] border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                style={{
                  left: `${railWidthPx}px`,
                  borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                }}
              >
                <div
                  className="h-full border overflow-hidden"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
                  }}
                >
                  <div
                    data-mobile-scroll-container="true"
                    className="h-full overflow-y-auto scrollbar-hide pb-[calc(var(--mobile-nav-offset)+max(env(safe-area-inset-bottom,0px),12px))]"
                    style={{ overscrollBehavior: "contain" }}
                  >
                    <div className="sticky top-0 z-20" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                      <div className="px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => setDrawerQueryState(activeFriend.id, { mode: "replace" })}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                              style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                              aria-label="Back to friend drawer"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                              {`${activeFriend.name} ${friendViewMode === "history" ? "History" : friendViewMode === "chart" ? "Chart" : friendViewMode === "chat" ? "Chat" : "Check-in"}`}
                            </h2>
                          </div>

                          {friendViewMode === "history" ? (
                            <div className="flex items-center gap-3 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setFriendHistorySearchOpen((prev) => !prev)}
                                className="inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                                aria-label={friendHistorySearchOpen ? "Close exercise search" : "Open exercise search"}
                                aria-expanded={friendHistorySearchOpen}
                              >
                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFriendHistoryFilterOpen(true)}
                                className="relative inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                                aria-label="Open exercise filters"
                              >
                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                                </svg>
                                {(friendHistorySort !== "recent" || friendHistoryRecency !== "all") ? (
                                  <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full bg-[#5865f2]" />
                                ) : null}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <AnimatePresence initial={false}>
                          {friendViewMode === "history" && friendHistorySearchOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0, y: -6 }}
                              animate={{ height: "auto", opacity: 1, y: 0 }}
                              exit={{ height: 0, opacity: 0, y: -6 }}
                              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <input
                                ref={friendHistorySearchInputRef}
                                autoFocus
                                type="text"
                                value={friendHistorySearchQuery}
                                onChange={(event) => setFriendHistorySearchQuery(event.target.value)}
                                placeholder="Search exercises"
                                className="mt-2 h-8 w-full rounded-md border px-2.5 text-sm outline-none"
                                style={{
                                  borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                  backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                  color: "var(--cloud-white)",
                                }}
                              />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                      <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                    </div>

                    {friendViewMode === "history" ? (
                      friendHistoryLoading ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          Loading history...
                        </div>
                      ) : friendHistoryRows.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          No exercises logged yet.
                        </div>
                      ) : filteredFriendHistoryRows.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          No exercises match your search or filters.
                        </div>
                      ) : (
                        <div className="pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
                          {filteredFriendHistoryRows.map((row) => (
                            <button
                              key={`friend-history-row-${row.exerciseId}`}
                              type="button"
                              onClick={() => setDrawerQueryState(activeFriend.id, { view: "history", exerciseId: row.exerciseId, mode: "push" })}
                              className="mx-1 my-0.5 block w-[calc(100%-0.5rem)] rounded-md px-3 py-2.5 text-left"
                              style={{
                                borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold leading-tight" style={{ color: getRecentExerciseTextColor(row.date) }}>
                                  {row.exerciseName}
                                </p>
                                <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  {formatRelativeRecentDate(row.date)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-start justify-between gap-2">
                                <p className="min-w-0 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                                  {`Recent: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
                                </p>
                                <span className="shrink-0 text-[12px]" style={{ color: "var(--mist-light)" }}>
                                  ›
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="px-3 py-5">
                        <div className="rounded-2xl border border-[#3b3f48] bg-[#232428] p-4">
                          <p className="text-sm font-semibold text-[#f2f3f5]">
                            {friendViewMode === "chart" ? "Chart" : friendViewMode === "chat" ? "Chat" : "Check-in"} coming soon
                          </p>
                          <p className="mt-1 text-xs text-[#949ba4]">
                            This now opens as a dedicated drawer instead of switching the page.
                          </p>
                        </div>
                      </div>
                    )}

                    <AnimatePresence>
                      {friendViewMode === "history" && friendHistoryFilterOpen ? (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[72]"
                            style={{ left: `${railWidthPx}px`, backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
                            onClick={() => setFriendHistoryFilterOpen(false)}
                          />
                          <motion.aside
                            initial={{ x: "100%" }}
                            animate={{ x: "0%" }}
                            exit={{ x: "100%" }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed inset-y-0 right-0 z-[73] w-[min(320px,88vw)] border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                            style={{
                              borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
                            }}
                          >
                            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                              <div className="border-b px-3 py-2.5" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                                <div className="flex items-center justify-between gap-2">
                                  <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                                    Exercise Filters
                                  </h2>
                                  <button
                                    type="button"
                                    onClick={() => setFriendHistoryFilterOpen(false)}
                                    className="h-8 w-8 rounded-md border text-sm"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      color: "var(--mist-light)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                                    }}
                                    aria-label="Close exercise filters"
                                  >
                                    x
                                  </button>
                                </div>
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Sort</label>
                                  <select
                                    value={friendHistorySort}
                                    onChange={(event) => setFriendHistorySort(event.target.value as "recent" | "oldest" | "name-az")}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                      color: "var(--cloud-white)",
                                    }}
                                  >
                                    <option value="recent">Recent first</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="name-az">Name A-Z</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Updated</label>
                                  <select
                                    value={friendHistoryRecency}
                                    onChange={(event) => setFriendHistoryRecency(event.target.value as "all" | "7d" | "30d")}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                      color: "var(--cloud-white)",
                                    }}
                                  >
                                    <option value="all">All time</option>
                                    <option value="7d">Last 7 days</option>
                                    <option value="30d">Last 30 days</option>
                                  </select>
                                </div>
                              </div>

                              <div className="border-t px-3 py-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFriendHistorySort("recent");
                                    setFriendHistoryRecency("all");
                                    setFriendHistoryFilterOpen(false);
                                  }}
                                  className="w-full rounded-md border px-3 py-2 text-sm font-semibold"
                                  style={{
                                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                    color: "var(--mist-light)",
                                  }}
                                >
                                  Clear filters
                                </button>
                              </div>
                            </div>
                          </motion.aside>
                        </>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.aside>
            )}

            {friendViewMode === "history" && selectedFriendExercise && (
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: "0%" }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 right-0 z-[73] border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                style={{
                  left: `${railWidthPx}px`,
                  borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                }}
              >
                <div
                  className="h-full border overflow-hidden"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
                  }}
                >
                  <div
                    data-mobile-scroll-container="true"
                    className="h-full overflow-y-auto scrollbar-hide overflow-x-hidden pb-[calc(var(--mobile-nav-offset)+max(env(safe-area-inset-bottom,0px),12px))]"
                    style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto", touchAction: "pan-y" }}
                  >
                    <div
                      className="sticky top-0 z-10 border-b px-3 py-2.5"
                      style={{
                        borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setDrawerQueryState(activeFriend.id, { view: "history", exerciseId: null, mode: "replace" })}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                            style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                            aria-label="Back to friend history"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold" style={{ color: getRecentExerciseTextColor(selectedFriendExerciseLogs[0]?.createdAt, true) }}>
                              {selectedFriendExercise.name || "Exercise"}
                            </h3>
                            <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--mist-light)" }}>
                              Workout History
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setFriendExerciseSearchOpen((prev) => !prev)}
                            className="inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                            aria-label={friendExerciseSearchOpen ? "Close log search" : "Open log search"}
                            aria-expanded={friendExerciseSearchOpen}
                          >
                            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFriendExerciseFilterOpen(true)}
                            className="relative inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                            aria-label="Open log filters"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                            </svg>
                            {(friendExerciseProgressionFilter !== "all" || friendExerciseVariantFilter !== "all" || friendExerciseWeightFilter !== "all" || friendExerciseRepsFilter !== "all" || friendExerciseSort !== "recent") ? (
                              <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full bg-[#5865f2]" />
                            ) : null}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {friendExerciseSearchOpen ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0, y: -6 }}
                            animate={{ height: "auto", opacity: 1, y: 0 }}
                            exit={{ height: 0, opacity: 0, y: -6 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <input
                              ref={friendExerciseSearchInputRef}
                              autoFocus
                              type="text"
                              value={friendExerciseSearchQuery}
                              onChange={(event) => setFriendExerciseSearchQuery(event.target.value)}
                              placeholder="Search logs"
                              className="mt-2 h-8 w-full rounded-md border px-2.5 text-sm outline-none"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                color: "var(--cloud-white)",
                              }}
                            />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence>
                      {friendExerciseFilterOpen ? (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[74]"
                            style={{ left: `${railWidthPx}px`, backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
                            onClick={() => setFriendExerciseFilterOpen(false)}
                          />
                          <motion.aside
                            initial={{ x: "100%" }}
                            animate={{ x: "0%" }}
                            exit={{ x: "100%" }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed inset-y-0 right-0 z-[75] w-[min(320px,88vw)] border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                            style={{
                              borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
                            }}
                          >
                            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                              <div className="border-b px-3 py-2.5" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                                <div className="flex items-center justify-between gap-2">
                                  <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                                    Log Filters
                                  </h2>
                                  <button
                                    type="button"
                                    onClick={() => setFriendExerciseFilterOpen(false)}
                                    className="h-8 w-8 rounded-md border text-sm"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      color: "var(--mist-light)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                                    }}
                                    aria-label="Close log filters"
                                  >
                                    x
                                  </button>
                                </div>
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Progression</label>
                                  <select
                                    value={friendExerciseProgressionFilter}
                                    onChange={(event) => setFriendExerciseProgressionFilter(event.target.value)}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                      color: "var(--cloud-white)",
                                    }}
                                  >
                                    <option value="all">All progressions</option>
                                    {friendExerciseProgressionOptions.map((progressionName) => (
                                      <option key={`friend-progression-${progressionName}`} value={progressionName}>{progressionName}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Variation</label>
                                  <select
                                    value={friendExerciseVariantFilter}
                                    onChange={(event) => setFriendExerciseVariantFilter(event.target.value)}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                      color: "var(--cloud-white)",
                                    }}
                                  >
                                    <option value="all">All variations</option>
                                    {friendExerciseVariantOptions.map((variant) => (
                                      <option key={`friend-variant-${variant}`} value={variant}>{variant === "-" ? "No variation" : variant}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Weight</label>
                                  <select
                                    value={friendExerciseWeightFilter}
                                    onChange={(event) => setFriendExerciseWeightFilter(event.target.value as "all" | "weighted" | "bodyweight")}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                      color: "var(--cloud-white)",
                                    }}
                                  >
                                    <option value="all">All loads</option>
                                    <option value="weighted">Weighted</option>
                                    <option value="bodyweight">Bodyweight</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Reps</label>
                                  <select
                                    value={friendExerciseRepsFilter}
                                    onChange={(event) => setFriendExerciseRepsFilter(event.target.value as "all" | "1-5" | "6-10" | "11+")}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                      color: "var(--cloud-white)",
                                    }}
                                  >
                                    <option value="all">All rep ranges</option>
                                    <option value="1-5">1–5 reps</option>
                                    <option value="6-10">6–10 reps</option>
                                    <option value="11+">11+ reps</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Sort</label>
                                  <select
                                    value={friendExerciseSort}
                                    onChange={(event) => setFriendExerciseSort(event.target.value as "recent" | "oldest" | "progression-asc" | "progression-desc")}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                      color: "var(--cloud-white)",
                                    }}
                                  >
                                    <option value="recent">Recent first</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="progression-asc">Progression ascending</option>
                                    <option value="progression-desc">Progression descending</option>
                                  </select>
                                </div>
                              </div>

                              <div className="border-t px-3 py-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFriendExerciseProgressionFilter("all");
                                    setFriendExerciseVariantFilter("all");
                                    setFriendExerciseWeightFilter("all");
                                    setFriendExerciseRepsFilter("all");
                                    setFriendExerciseSort("recent");
                                    setFriendExerciseFilterOpen(false);
                                  }}
                                  className="w-full rounded-md border px-3 py-2 text-sm font-semibold"
                                  style={{
                                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                    color: "var(--mist-light)",
                                  }}
                                >
                                  Clear filters
                                </button>
                              </div>
                            </div>
                          </motion.aside>
                        </>
                      ) : null}
                    </AnimatePresence>

                    <div>
                      {selectedFriendExerciseLogs.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          No workout history for this exercise yet.
                        </div>
                      ) : filteredSelectedFriendExerciseLogs.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          No logs match your search or filters.
                        </div>
                      ) : (
                        <>
                          {filteredSelectedFriendExerciseLogs.map((log) => {
                            const tierName = selectedFriendExercise.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`;
                            const variationValue = log.variant?.trim() || "-";
                            const modValue = log.modifier?.trim() || "-";
                            const notesValue = log.notes?.trim() || "-";
                            const alignedMetricRows = getWorkoutMetricRows(log);
                            const leftDetailRows = [
                              { label: "Variation:", value: variationValue, valueColor: "var(--mountain-blue-glow)" },
                              { label: "Mod:", value: modValue, valueColor: "var(--gold-glow)" },
                              { label: "Notes:", value: notesValue, valueColor: "var(--text-secondary)" },
                            ];
                            const alignedDetailRowCount = Math.max(leftDetailRows.length, alignedMetricRows.length);

                            return (
                              <article
                                key={`friend-exercise-log-${log.id}`}
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
                                      <div key={`friend-detail-row-${log.id}-${index}`} className="grid grid-cols-2 gap-x-3">
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
                                          {metric.weight !== "-" ? (
                                            <span className="truncate" style={{ color: "var(--mountain-blue-glow)" }}>
                                              <span style={{ color: "var(--text-muted)" }}>Weight:</span> {metric.weight}
                                            </span>
                                          ) : (
                                            <span aria-hidden="true" />
                                          )}
                                          {metric.reps !== "-" ? (
                                            <span className="truncate" style={{ color: "var(--forest)" }}>
                                              <span style={{ color: "var(--text-muted)" }}>Reps:</span> {metric.reps}
                                            </span>
                                          ) : (
                                            <span aria-hidden="true" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </article>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(DiscordFriendsRail);
