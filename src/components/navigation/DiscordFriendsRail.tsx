"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { api } from "@/lib/api-client";
import { useIsMobile } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { formatDateLocal, formatDateWithPreference } from "@/lib/constants";
import { translateEnglishToLanguage } from "@/lib/language";
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

interface PublicUsersPayload {
  users?: Array<{
    id: string;
    name: string;
    username?: string | null;
    createdAt?: string | Date | null;
  }>;
}

const APP_EXERCISE_LIBRARY_USERNAME = "__app_exercise_library__";
const NON_MUTUAL_VISIBILITY_KEY = "circle-show-non-mutual-users";
const NON_MUTUAL_VISIBILITY_EVENT = "circle-non-mutual-visibility-changed";

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function toPossessive(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Friend's";
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

function formatRelativeRecentDate(
  dateLike: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy" = "dd-mmm-yyyy",
  timeZone?: string,
): string {
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

  return formatDateWithPreference(new Date(timestamp), dateFormat, timeZone);
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
      ? "color-mix(in srgb, var(--accent) 60%, var(--cloud-white) 40%)"
      : "color-mix(in srgb, var(--accent) 72%, var(--cloud-white) 28%)";
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

type FriendViewMode = "" | "history" | "chart" | "checkin" | "chat";

function DiscordFriendsRail({
  incomingFriendRequestCount = 0,
  onDrawerOpenChange,
}: {
  incomingFriendRequestCount?: number;
  onDrawerOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const lt = useCallback((text: string) => translateEnglishToLanguage(text, settings.languageMode), [settings.languageMode]);
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const timeZone = settings.timeZone;
  const isAdmin = user?.role === "admin";

  const isActive = pathname === DASHBOARD_ROUTES.circle || pathname?.startsWith(`${DASHBOARD_ROUTES.circle}/`);
  const [drawerFriendId, setDrawerFriendId] = useState("");
  const [friendViewMode, setFriendViewMode] = useState<FriendViewMode>("");
  const [selectedFriendExerciseId, setSelectedFriendExerciseId] = useState("");
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
  const [communityUsers, setCommunityUsers] = useState<Array<{
    id: string;
    name: string;
    username?: string;
    createdAt?: string;
  }>>([]);
  const [showNonMutualInRail, setShowNonMutualInRail] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(NON_MUTUAL_VISIBILITY_KEY) === "1";
  });

  useEffect(() => {
    // Prevent non-admin users from enabling this mode via persisted client state.
    if (isAdmin || !showNonMutualInRail) return;
    setShowNonMutualInRail(false);
  }, [isAdmin, showNonMutualInRail]);
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
  const [friendOverviewStats, setFriendOverviewStats] = useState<{
    latestWeight: number | null;
    todayCheckedIn: boolean;
    todayWeight: number | null;
  }>({
    latestWeight: null,
    todayCheckedIn: false,
    todayWeight: null,
  });
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
    if (typeof window === "undefined") return;

    const syncNonMutualVisibility = () => {
      if (!isAdmin) {
        setShowNonMutualInRail(false);
        return;
      }
      setShowNonMutualInRail(window.localStorage.getItem(NON_MUTUAL_VISIBILITY_KEY) === "1");
    };

    syncNonMutualVisibility();
    window.addEventListener(NON_MUTUAL_VISIBILITY_EVENT, syncNonMutualVisibility);
    window.addEventListener("storage", syncNonMutualVisibility);
    return () => {
      window.removeEventListener(NON_MUTUAL_VISIBILITY_EVENT, syncNonMutualVisibility);
      window.removeEventListener("storage", syncNonMutualVisibility);
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;

    const loadFriends = async () => {
      try {
        const [payload, communityPayload] = await Promise.all([
          api.get<FriendsPayload>("/api/friends", { cache: "no-store" }),
          isAdmin
            ? api
                .get<PublicUsersPayload>("/api/users/public?scope=community", { cache: "no-store" })
                .catch(() => ({ users: [] as PublicUsersPayload["users"] }))
            : Promise.resolve({ users: [] as PublicUsersPayload["users"] }),
        ]);
        if (cancelled) return;

        const normalized = Array.isArray(payload.friends)
          ? payload.friends
              .filter((friend) => typeof friend?.id === "string")
              .filter((friend) => (friend.username || "").trim().toLowerCase() !== APP_EXERCISE_LIBRARY_USERNAME)
              .map((friend) => ({
                id: friend.id,
                name: (friend.name || friend.username || lt("Friend")).trim() || lt("Friend"),
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

        const normalizedCommunity = Array.isArray(communityPayload.users)
          ? communityPayload.users
              .filter((member) => typeof member?.id === "string")
              .filter((member) => (member.username || "").trim().toLowerCase() !== APP_EXERCISE_LIBRARY_USERNAME)
              .map((member) => ({
                id: member.id,
                name: (member.name || member.username || lt("Friend")).trim() || lt("Friend"),
                username: (member.username || "").trim() || undefined,
                createdAt: member.createdAt ? new Date(member.createdAt).toISOString() : undefined,
              }))
          : [];

        setFriends(normalized);
        setCommunityUsers(normalizedCommunity);
      } catch {
        if (!cancelled) {
          setFriends([]);
          setCommunityUsers([]);
        }
      }
    };

    void loadFriends();

    return () => {
      cancelled = true;
    };
  }, [lt]);

  const selectableFriends = useMemo(
    () => friends.filter((friend) => friend.id !== user?.id),
    [friends, user?.id]
  );

  const nonMutualRailUsers = useMemo(() => {
    if (!isAdmin || !showNonMutualInRail) return [];
    const mutualIds = new Set(selectableFriends.map((friend) => friend.id));
    return communityUsers
      .filter((member) => member.id !== user?.id)
      .filter((member) => !mutualIds.has(member.id))
      .slice(0, 6)
      .map((member) => ({
        ...member,
        isMutual: false,
      }));
  }, [communityUsers, isAdmin, selectableFriends, showNonMutualInRail, user?.id]);

  const mutualRailUsers = useMemo(() => {
    return selectableFriends
      .slice(0, 6)
      .map((friend) => ({ ...friend, isMutual: true }));
  }, [selectableFriends]);

  const railDrawerUsers = useMemo(
    () => [...mutualRailUsers, ...nonMutualRailUsers],
    [mutualRailUsers, nonMutualRailUsers]
  );

  const setDrawerState = (
    friendId: string | null,
    options: { view?: FriendViewMode | null; exerciseId?: string | null } = {},
  ) => {
    const { view = null, exerciseId = null } = options;
    setDrawerFriendId(friendId || "");
    setFriendViewMode(view || "");
    setSelectedFriendExerciseId(exerciseId || "");
  };

  const closeFriendPanels = (resetTrainView = true) => {
    setFriendActionsOpen(false);
    setActiveFriend(null);
    setDrawerState(null);
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

    const matchedFriend = railDrawerUsers.find((friend) => friend.id === drawerFriendId);
    if (!matchedFriend) {
      setFriendActionsOpen(false);
      setActiveFriend(null);
      setDrawerState(null);
      return;
    }

    const normalizedMatchedFriend = {
      id: matchedFriend.id,
      name: matchedFriend.name,
      username: typeof matchedFriend.username === "string" ? matchedFriend.username : undefined,
      createdAt: typeof matchedFriend.createdAt === "string" ? matchedFriend.createdAt : undefined,
      updatedAt: typeof (matchedFriend as { updatedAt?: unknown }).updatedAt === "string"
        ? (matchedFriend as { updatedAt?: string }).updatedAt
        : undefined,
      sessionCount: typeof (matchedFriend as { sessionCount?: unknown }).sessionCount === "number"
        ? (matchedFriend as { sessionCount?: number }).sessionCount
        : undefined,
      checkInCount: typeof (matchedFriend as { checkInCount?: unknown }).checkInCount === "number"
        ? (matchedFriend as { checkInCount?: number }).checkInCount
        : undefined,
      lastWorkoutAt: typeof (matchedFriend as { lastWorkoutAt?: unknown }).lastWorkoutAt === "string"
        ? (matchedFriend as { lastWorkoutAt?: string }).lastWorkoutAt
        : undefined,
      lastCheckInAt: typeof (matchedFriend as { lastCheckInAt?: unknown }).lastCheckInAt === "string"
        ? (matchedFriend as { lastCheckInAt?: string }).lastCheckInAt
        : undefined,
      lastActivityAt: typeof (matchedFriend as { lastActivityAt?: unknown }).lastActivityAt === "string"
        ? (matchedFriend as { lastActivityAt?: string }).lastActivityAt
        : undefined,
      lastActivityLabel: typeof (matchedFriend as { lastActivityLabel?: unknown }).lastActivityLabel === "string"
        ? (matchedFriend as { lastActivityLabel?: string }).lastActivityLabel
        : undefined,
    };

    setActiveFriend(normalizedMatchedFriend);
    setFriendActionsOpen(!friendViewMode);
  }, [drawerFriendId, friendViewMode, railDrawerUsers]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOpenFriendDrawer = (event: Event) => {
      const customEvent = event as CustomEvent<{
        friendId?: string;
        view?: FriendViewMode | null;
        exerciseId?: string | null;
      }>;
      const friendId = (customEvent.detail?.friendId || "").trim();
      if (!friendId) return;

      const targetFriend = railDrawerUsers.find((friend) => friend.id === friendId);
      if (!targetFriend) return;

      const view = customEvent.detail?.view ?? null;
      const exerciseId = customEvent.detail?.exerciseId ?? null;
      setDrawerState(friendId, { view, exerciseId });
      setFriendActionsOpen(!view);
    };

    window.addEventListener("circle-open-friend-drawer", onOpenFriendDrawer as EventListener);
    return () => {
      window.removeEventListener("circle-open-friend-drawer", onOpenFriendDrawer as EventListener);
    };
  }, [railDrawerUsers]);

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

  useEffect(() => {
    if (!activeFriend?.id) {
      setFriendOverviewStats({
        latestWeight: null,
        todayCheckedIn: false,
        todayWeight: null,
      });
      return;
    }

    let cancelled = false;

    const loadFriendOverviewStats = async () => {
      try {
        const scope = isAdmin ? "community" : "friends";
        const payload = await api.get<{ checkins: Array<{ date: string; userId: string; present: boolean; weight?: number | null }> }>(`/api/checkins?scope=${scope}`, { cache: "no-store" });
        if (cancelled) return;

        const todayKey = formatDateLocal(new Date(), timeZone);
        const rows = (payload.checkins || []).filter((row) => row.userId === activeFriend.id);

        let latestWeight: number | null = null;
        let todayWeight: number | null = null;
        let todayCheckedIn = false;

        const sortedByDateDesc = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const row of sortedByDateDesc) {
          const dayKey = row.date?.split("T")[0] || "";
          const weightValue = row.weight == null ? null : Number(row.weight);
          const hasWeight = weightValue != null && Number.isFinite(weightValue) && weightValue > 0;

          if (latestWeight == null && hasWeight) {
            latestWeight = weightValue;
          }

          if (dayKey === todayKey) {
            todayCheckedIn = todayCheckedIn || Boolean(row.present);
            if (todayWeight == null && hasWeight) {
              todayWeight = weightValue;
            }
          }
        }

        setFriendOverviewStats({
          latestWeight,
          todayCheckedIn,
          todayWeight,
        });
      } catch {
        if (!cancelled) {
          setFriendOverviewStats({
            latestWeight: null,
            todayCheckedIn: false,
            todayWeight: null,
          });
        }
      }
    };

    void loadFriendOverviewStats();

    return () => {
      cancelled = true;
    };
  }, [activeFriend?.id, isAdmin, timeZone]);

  const friendHistoryRows = useMemo(() => {
    const rows: Array<{ exerciseId: string; exerciseName: string; date: string; progression: string; variant: string; recent24hCount: number }> = [];

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const exercise of friendHistoryExercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      if (logs.length === 0) continue;

      const latestLog = [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const tierName = exercise.tiers.find((tier) => tier.level === latestLog.level)?.name ?? `Progression ${latestLog.level}`;

      const recent24hCount = logs.reduce((count, log) => {
        const ts = new Date(log.createdAt).getTime();
        return Number.isFinite(ts) && now - ts <= dayMs ? count + 1 : count;
      }, 0);

      rows.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        date: latestLog.createdAt,
        progression: tierName,
        variant: latestLog.variant?.trim() || "",
        recent24hCount,
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
  const hasFriendDrawerOpen = Boolean(friendActionsOpen || friendViewMode || drawerFriendId || activeFriend?.id);
  const isFriendsHomeActive = isActive && !hasFriendDrawerOpen;

  const openRailUserDrawer = (friend: {
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
  }) => {
    if (friendActionsOpen && activeFriend?.id === friend.id) {
      closeFriendPanels(false);
      return;
    }

    setActiveFriend({
      id: friend.id,
      name: friend.name,
      username: friend.username,
      createdAt: friend.createdAt,
      updatedAt: friend.updatedAt,
      sessionCount: friend.sessionCount,
      checkInCount: friend.checkInCount,
      lastWorkoutAt: friend.lastWorkoutAt,
      lastCheckInAt: friend.lastCheckInAt,
      lastActivityAt: friend.lastActivityAt,
      lastActivityLabel: friend.lastActivityLabel,
    });
    setFriendActionsOpen(true);
    setDrawerState(friend.id);
  };

  useEffect(() => {
    onDrawerOpenChange?.(hasFriendDrawerOpen);
  }, [hasFriendDrawerOpen, onDrawerOpenChange]);

  const selectedActivityMeta = useMemo(() => {
    const latestKnownActivity = [activeFriend?.lastActivityAt, activeFriend?.lastWorkoutAt, activeFriend?.lastCheckInAt]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    const navigationLabel = activeFriend?.lastActivityLabel?.trim();
    const navigationValue = activeFriend?.lastActivityAt
      ? `${navigationLabel ? `${navigationLabel} • ` : ""}${formatRelativeRecentDate(activeFriend.lastActivityAt, dateFormat, timeZone)}`
      : "-";

    if (friendViewMode === "history") {
      return { label: lt("Last History"), value: activeFriend?.lastWorkoutAt ? formatRelativeRecentDate(activeFriend.lastWorkoutAt, dateFormat, timeZone) : navigationValue };
    }
    if (friendViewMode === "chart") {
      return { label: lt("Last Chart"), value: activeFriend?.lastWorkoutAt ? formatRelativeRecentDate(activeFriend.lastWorkoutAt, dateFormat, timeZone) : navigationValue };
    }
    if (friendViewMode === "checkin") {
      return { label: lt("Last Check-In"), value: activeFriend?.lastCheckInAt ? formatRelativeRecentDate(activeFriend.lastCheckInAt, dateFormat, timeZone) : navigationValue };
    }
    if (friendViewMode === "chat") {
      return { label: lt("Last Chat"), value: navigationValue };
    }

    return { label: lt("Last Activity"), value: latestKnownActivity ? (activeFriend?.lastActivityAt === latestKnownActivity ? navigationValue : formatRelativeRecentDate(latestKnownActivity, dateFormat, timeZone)) : "-" };
  }, [activeFriend?.lastActivityAt, activeFriend?.lastActivityLabel, activeFriend?.lastCheckInAt, activeFriend?.lastWorkoutAt, dateFormat, friendViewMode, lt, timeZone]);

  const friendActionItems = useMemo(() => ([
    {
      id: "history" as const,
      label: lt("History"),
      hint: activeFriend?.lastWorkoutAt ? `${lt("Last workout")} ${formatRelativeRecentDate(activeFriend.lastWorkoutAt, dateFormat, timeZone)}` : lt("No workout history yet"),
    },
    {
      id: "chart" as const,
      label: lt("Chart"),
      hint: activeFriend?.lastWorkoutAt ? `${lt("Uses workout data from")} ${formatRelativeRecentDate(activeFriend.lastWorkoutAt, dateFormat, timeZone)}` : lt("No chart data yet"),
    },
    {
      id: "checkin" as const,
      label: lt("Check-In"),
      hint: activeFriend?.lastCheckInAt ? `${lt("Last check-in")} ${formatRelativeRecentDate(activeFriend.lastCheckInAt, dateFormat, timeZone)}` : lt("No check-ins yet"),
    },
    {
      id: "chat" as const,
      label: lt("Chat"),
      hint: activeFriend?.lastActivityAt
        ? `${activeFriend?.lastActivityLabel || lt("Last seen")} • ${formatRelativeRecentDate(activeFriend.lastActivityAt, dateFormat, timeZone)}`
        : lt("Coming soon"),
    },
  ]), [activeFriend?.lastActivityAt, activeFriend?.lastActivityLabel, activeFriend?.lastCheckInAt, activeFriend?.lastWorkoutAt, dateFormat, lt, timeZone]);

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
                router.push("/dashboard/circle?tab=members");
              }}
              aria-current={isFriendsHomeActive ? "page" : undefined}
              aria-label={lt("Circle members")}
              className="relative mx-auto flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-2xl border transition-colors duration-150"
              style={{
                borderColor: isFriendsHomeActive
                  ? "color-mix(in srgb, var(--accent) 62%, transparent)"
                  : "transparent",
                backgroundColor: isFriendsHomeActive
                  ? "var(--jade)"
                  : "color-mix(in srgb, var(--surface-hover) 92%, var(--surface))",
                color: isFriendsHomeActive ? "var(--pure-white)" : "var(--mist-light)",
                boxShadow: isFriendsHomeActive
                  ? "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 10px 22px color-mix(in srgb, var(--accent) 28%, transparent)"
                  : "none",
              }}
              title={lt("Circle members")}
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
            {mutualRailUsers.map((friend) => {
              const isSelected = selectedRailFriendId === friend.id && hasFriendDrawerOpen;

              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => openRailUserDrawer(friend)}
                  className="group relative flex h-12 w-12 items-center justify-center text-center transition-all duration-150 md:h-14 md:w-14"
                  style={{
                    borderColor: "transparent",
                    backgroundColor: "transparent",
                    boxShadow: "none",
                  }}
                  title={friend.name}
                  aria-label={lt("Open friend actions")}
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
                        : "transparent",
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

            {mutualRailUsers.length > 0 && nonMutualRailUsers.length > 0 && (
              <div className="my-1 flex w-full items-center justify-center gap-1.5 px-2">
                <div className="h-px flex-1" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }} />
                <span className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                  {lt("Non-mutual")}
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }} />
              </div>
            )}

            {nonMutualRailUsers.map((friend) => (
              <button
                key={friend.id}
                type="button"
                onClick={() => openRailUserDrawer(friend)}
                className="group relative flex h-12 w-12 items-center justify-center text-center transition-all duration-150 md:h-14 md:w-14"
                style={{
                  borderColor: "transparent",
                  backgroundColor: "transparent",
                  boxShadow: "none",
                }}
                title={`${friend.name} (${lt("Not mutual")})`}
                aria-label={lt("Open friend actions")}
              >
                {selectedRailFriendId === friend.id && hasFriendDrawerOpen && (
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
                    borderColor: selectedRailFriendId === friend.id && hasFriendDrawerOpen
                      ? "color-mix(in srgb, var(--accent) 72%, transparent)"
                      : "color-mix(in srgb, var(--ink-light) 52%, transparent)",
                    backgroundColor: selectedRailFriendId === friend.id && hasFriendDrawerOpen
                      ? "color-mix(in srgb, var(--accent) 30%, var(--surface))"
                      : "color-mix(in srgb, var(--surface-hover) 72%, var(--surface))",
                    opacity: selectedRailFriendId === friend.id && hasFriendDrawerOpen ? 1 : 0.85,
                  }}
                >
                  {initials(friend.name)}
                </span>
              </button>
            ))}
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
                className="fixed inset-y-0 right-0 z-[71] overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                style={{
                  left: `${railWidthPx}px`,
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                }}
              >
                <div
                  className="h-full overflow-hidden"
                  style={{
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
                            aria-label={lt("Back from friend drawer")}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                            {`${lt("Your Friend")} ${activeFriend.name}`}
                          </h2>
                        </div>
                      </div>
                      <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                    </div>

                    <div>
                      <article
                        className="mx-1 my-0.5 rounded-md px-3 py-2.5"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary)" }}>
                          {lt("Friend Overview")}
                        </p>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{lt("Sessions")}</p>
                            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{activeFriend.sessionCount ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{lt("Check-ins")}</p>
                            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{activeFriend.checkInCount ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{lt("Weight")}</p>
                            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                              {friendOverviewStats.latestWeight != null ? `${friendOverviewStats.latestWeight} kg` : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{lt("Today")}</p>
                            <p className="text-xs font-semibold" style={{ color: friendOverviewStats.todayCheckedIn ? "var(--forest)" : "var(--text-primary)" }}>
                              {friendOverviewStats.todayCheckedIn
                                ? friendOverviewStats.todayWeight != null
                                  ? `${lt("Checked in")} • ${friendOverviewStats.todayWeight} kg`
                                  : lt("Checked in")
                                : lt("No check-in")}
                            </p>
                          </div>
                        </div>
                        <p className="mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {selectedActivityMeta.label}: {selectedActivityMeta.value}
                        </p>
                      </article>

                      {friendActionItems.map((item) => {
                        const isAvailable = item.id === "history";
                        return (
                        <article
                          key={item.id}
                          className="mx-1 my-0.5 rounded-md px-3 py-2.5"
                          style={{
                            cursor: "pointer",
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setDrawerState(activeFriend.id, { view: item.id as FriendViewMode });
                            setFriendActionsOpen(false);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setDrawerState(activeFriend.id, { view: item.id as FriendViewMode });
                              setFriendActionsOpen(false);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight" style={{ color: isAvailable ? "var(--text-primary)" : "var(--text-muted)" }}>
                              {item.label}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11px] italic" style={{ color: isAvailable ? "var(--text-secondary)" : "var(--text-muted)" }}>
                            {item.hint}
                          </p>
                        </article>
                        );
                      })}
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
                className="fixed inset-y-0 right-0 z-[72] overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                style={{
                  left: `${railWidthPx}px`,
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                }}
              >
                <div
                  className="h-full overflow-hidden"
                  style={{
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
                              onClick={() => setDrawerState(activeFriend.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                              style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                              aria-label={lt("Back to friend drawer")}
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                              {settings.languageMode === "vietnamese"
                                ? `${activeFriend.name} ${friendViewMode === "history" ? lt("History") : friendViewMode === "chart" ? lt("Chart") : friendViewMode === "chat" ? lt("Chat") : lt("Check-In")}`
                                : `${toPossessive(activeFriend.name)} ${friendViewMode === "history" ? lt("History") : friendViewMode === "chart" ? lt("Chart") : friendViewMode === "chat" ? lt("Chat") : lt("Check-In")}`}
                            </h2>
                          </div>

                          {friendViewMode === "history" ? (
                            <div className="flex items-center gap-3 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setFriendHistorySearchOpen((prev) => !prev)}
                                className="inline-flex h-8 items-center justify-center transition-colors"
                                style={{ color: "var(--text-secondary)" }}
                                aria-label={friendHistorySearchOpen ? lt("Close exercise search") : lt("Open exercise search")}
                                aria-expanded={friendHistorySearchOpen}
                              >
                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFriendHistoryFilterOpen(true)}
                                className="relative inline-flex h-8 items-center justify-center transition-colors"
                                style={{ color: "var(--text-secondary)" }}
                                aria-label={lt("Open exercise filters")}
                              >
                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                                </svg>
                                {(friendHistorySort !== "recent" || friendHistoryRecency !== "all") ? (
                                  <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
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
                                placeholder={lt("Search exercises")}
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
                    </div>

                    {friendViewMode === "history" ? (
                      friendHistoryLoading ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          {lt("Loading history...")}
                        </div>
                      ) : friendHistoryRows.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                          {lt("No exercises logged yet.")}
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
                              onClick={() => setDrawerState(activeFriend.id, { view: "history", exerciseId: row.exerciseId })}
                              className="mx-1 my-0.5 block w-[calc(100%-0.5rem)] rounded-md border-0 bg-transparent px-3 py-2.5 text-left"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold leading-tight" style={{ color: getRecentExerciseTextColor(row.date) }}>
                                  {row.exerciseName}
                                  {row.recent24hCount >= 2 ? (
                                    <sup className="ml-0.5 text-[12px] font-bold leading-none" style={{ color: "var(--accent)" }}>
                                      {row.recent24hCount}
                                    </sup>
                                  ) : null}
                                </p>
                                <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  {formatRelativeRecentDate(row.date, dateFormat, timeZone)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-start justify-between gap-2">
                                <p className="min-w-0 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                                  {`${lt("Recent")}: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
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
                        <div
                          className="rounded-2xl border p-4"
                          style={{
                            borderColor: "var(--border)",
                            backgroundColor: "var(--surface)",
                          }}
                        >
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {friendViewMode === "chart" ? lt("Chart") : friendViewMode === "chat" ? lt("Chat") : lt("Check-In")} {lt("coming soon")}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            {lt("This now opens as a dedicated drawer instead of switching the page.")}
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
                                    {lt("Exercise Filters")}
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
                                    aria-label={lt("Close exercise filters")}
                                  >
                                    x
                                  </button>
                                </div>
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">{lt("Sort")}</label>
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
                                    <option value="recent">{lt("Recent first")}</option>
                                    <option value="oldest">{lt("Oldest first")}</option>
                                    <option value="name-az">{lt("Name A-Z")}</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">{lt("Updated")}</label>
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
                                    <option value="all">{lt("All time")}</option>
                                    <option value="7d">{lt("Last 7 days")}</option>
                                    <option value="30d">{lt("Last 30 days")}</option>
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
                                  {lt("Clear filters")}
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
                className="fixed inset-y-0 right-0 z-[73] overflow-hidden safe-area-top safe-area-bottom safe-area-right"
                style={{
                  left: `${railWidthPx}px`,
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                }}
              >
                <div
                  className="h-full overflow-hidden"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
                  }}
                >
                  <div
                    data-mobile-scroll-container="true"
                    className="h-full overflow-y-auto scrollbar-hide overflow-x-hidden pb-[calc(var(--mobile-nav-offset)+max(env(safe-area-inset-bottom,0px),12px))]"
                    style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto", touchAction: "pan-y" }}
                  >
                    <div
                      className="sticky top-0 z-10 px-3 py-2.5"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setDrawerState(activeFriend.id, { view: "history" })}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                            style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                            aria-label={lt("Back to friend history")}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold" style={{ color: getRecentExerciseTextColor(selectedFriendExerciseLogs[0]?.createdAt, true) }}>
                              {selectedFriendExercise.name || lt("Exercise")}
                            </h3>
                            <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--mist-light)" }}>
                              {lt("Workout History")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setFriendExerciseSearchOpen((prev) => !prev)}
                            className="inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                            aria-label={friendExerciseSearchOpen ? lt("Close log search") : lt("Open log search")}
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
                            aria-label={lt("Open log filters")}
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
                              placeholder={lt("Search logs")}
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
                                    {lt("Log Filters")}
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
                                    aria-label={lt("Close log filters")}
                                  >
                                    x
                                  </button>
                                </div>
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">{lt("Progression")}</label>
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
                                    <option value="all">{lt("All progressions")}</option>
                                    {friendExerciseProgressionOptions.map((progressionName) => (
                                      <option key={`friend-progression-${progressionName}`} value={progressionName}>{progressionName}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">{lt("Variation")}</label>
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
                                    <option value="all">{lt("All variations")}</option>
                                    {friendExerciseVariantOptions.map((variant) => (
                                      <option key={`friend-variant-${variant}`} value={variant}>{variant === "-" ? lt("No variation") : variant}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">{lt("Weight")}</label>
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
                                    <option value="all">{lt("All loads")}</option>
                                    <option value="weighted">{lt("Weighted")}</option>
                                    <option value="bodyweight">{lt("Bodyweight")}</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">{lt("Reps")}</label>
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
                                    <option value="all">{lt("All rep ranges")}</option>
                                    <option value="1-5">{lt("1–5 reps")}</option>
                                    <option value="6-10">{lt("6–10 reps")}</option>
                                    <option value="11+">{lt("11+ reps")}</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">{lt("Sort")}</label>
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
                                    <option value="recent">{lt("Recent first")}</option>
                                    <option value="oldest">{lt("Oldest first")}</option>
                                    <option value="progression-asc">{lt("Progression ascending")}</option>
                                    <option value="progression-desc">{lt("Progression descending")}</option>
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
                                  {lt("Clear filters")}
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
                            const tierName = selectedFriendExercise.tiers.find((tier) => tier.level === log.level)?.name ?? `${lt("Progression")} ${log.level}`;
                            const variationValue = log.variant?.trim() || "-";
                            const modValue = log.modifier?.trim() || "-";
                            const notesValue = log.notes?.trim() || "-";
                            const alignedMetricRows = getWorkoutMetricRows(log);
                            const leftDetailRows = [
                              { label: `${lt("Variation")}:`, value: variationValue, valueColor: "var(--mountain-blue-glow)" },
                              { label: `${lt("Mod")}:`, value: modValue, valueColor: "var(--gold-glow)" },
                              { label: `${lt("Notes")}:`, value: notesValue, valueColor: "var(--text-secondary)" },
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
                                    {formatRelativeRecentDate(log.createdAt, dateFormat, timeZone)}
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
                                              <span style={{ color: "var(--text-muted)" }}>{lt("Weight")}: </span>{metric.weight}
                                            </span>
                                          ) : (
                                            <span aria-hidden="true" />
                                          )}
                                          {metric.reps !== "-" ? (
                                            <span className="truncate" style={{ color: "var(--forest)" }}>
                                              <span style={{ color: "var(--text-muted)" }}>{lt("Reps")}: </span>{metric.reps}
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
