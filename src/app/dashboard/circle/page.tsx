"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import PageHeader from "@/components/layout/PageHeader";
import DiscordFriendsRail from "@/components/navigation/DiscordFriendsRail";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { formatDateWithPreference } from "@/lib/constants";
import { EmptyFriends } from "@/components/empty-states";
import { useIncomingFriendRequestsCount } from "@/hooks/useIncomingFriendRequestsCount";

// ── Types ──────────────────────────────────────────────────────────

type Tab = "feed" | "members" | "requests";

interface FeedLog {
  id: string;
  userId: string;
  userName: string;
  exerciseName: string;
  level: number;
  progressionName?: string;
  createdAt: string;
  reps1?: number;
  reps2?: number;
  reps3?: number;
  weight1?: number;
  weight2?: number;
  weight3?: number;
  completed: boolean;
}

interface BasicUser {
  id: string;
  name: string;
  username: string;
  createdAt?: string | null;
  friendCode?: string | null;
  sessionCount?: number | null;
  checkInCount?: number | null;
  lastWorkoutAt?: string | null;
  lastCheckInAt?: string | null;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
  themeStyle?: string | null;
}

interface FriendRequestRow {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  requester: BasicUser;
  receiver: BasicUser;
}

interface FriendPayload {
  me?: { id: string; friendCode?: string | null } | null;
  friends: BasicUser[];
  incomingRequests: FriendRequestRow[];
  outgoingRequests: FriendRequestRow[];
}

interface CheckInRow {
  date: string;
  userId: string;
  present: boolean;
  weight?: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatRelative(dateLike: string | null | undefined): string {
  if (!dateLike) return "-";
  const ts = toTimestamp(dateLike);
  if (!Number.isFinite(ts)) return "-";
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "just now";
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  if (diffMs < h) return `${Math.max(1, Math.floor(diffMs / m))}m ago`;
  if (diffMs < d) return `${Math.max(1, Math.floor(diffMs / h))}h ago`;
  if (diffMs < 14 * d) return `${Math.max(1, Math.floor(diffMs / d))}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Shared styles ──────────────────────────────────────────────────

const tileStyle = {
  borderColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--ink-mid) 48%, var(--ink-deep))",
};

const microTileStyle = {
  backgroundColor: "color-mix(in srgb, var(--ink-light) 8%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ink-light) 24%, transparent)",
};

// ── Feed tab ───────────────────────────────────────────────────────

function FeedTab({ userId }: { userId: string }) {
  const { settings } = useDisplaySettings();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<FeedLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    type FeedExercise = {
      id: string;
      name: string;
      tiers?: Array<{ level: number; name: string }>;
      userProgress?: Array<{
        userId: string;
        user?: { id: string; name: string };
        logs: Array<{
          id: string;
          createdAt: string;
          level: number;
          reps1?: number;
          reps2?: number;
          reps3?: number;
          weight1?: number;
          weight2?: number;
          weight3?: number;
          completed?: boolean;
        }>;
      }>;
    };

    api
      .get<{ exercises: FeedExercise[] }>("/api/feed?scope=friends")
      .then((data) => {
        if (cancelled) return;
        const allLogs: FeedLog[] = [];
        for (const exercise of data.exercises || []) {
          for (const progress of exercise.userProgress || []) {
            if (progress.userId === userId) continue;
            for (const log of progress.logs || []) {
              allLogs.push({
                id: log.id,
                userId: progress.userId,
                userName: progress.user?.name || "Unknown",
                exerciseName: exercise.name,
                level: log.level,
                progressionName:
                  exercise.tiers?.find((t) => t.level === log.level)?.name ??
                  `Progression ${log.level}`,
                createdAt: log.createdAt,
                reps1: log.reps1,
                reps2: log.reps2,
                reps3: log.reps3,
                weight1: log.weight1,
                weight2: log.weight2,
                weight3: log.weight3,
                completed: log.completed || false,
              });
            }
          }
        }
        allLogs.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setLogs(allLogs);
      })
      .catch(() => {
        // silent — empty state handles it
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[12px] text-[color:var(--text-muted)]">Loading feed…</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">Nothing yet</p>
        <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">
          When your circle logs workouts, their sessions will appear here.
        </p>
      </div>
    );
  }

  // Group by calendar day
  const grouped: Record<string, FeedLog[]> = {};
  for (const log of logs) {
    const day = log.createdAt.slice(0, 10);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(log);
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped)
        .slice(0, 14)
        .map(([day, dayLogs], groupIndex) => (
          <div key={day}>
            {/* Date separator with visual weight */}
            <div className={`flex items-center gap-2 ${groupIndex === 0 ? "mb-2" : "mb-2 mt-6"}`}>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                }}
              />
              <p
                className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatDateWithPreference(
                  new Date(`${day}T00:00:00`),
                  settings.dateFormat || "dd-mmm-yyyy"
                )}
              </p>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                }}
              />
            </div>
            <div className="space-y-2">
              {dayLogs.map((log) => {
                const sets = (
                  [
                    [log.reps1, log.weight1],
                    [log.reps2, log.weight2],
                    [log.reps3, log.weight3],
                  ] as Array<[number | undefined, number | undefined]>
                ).filter(([r]) => r != null && r > 0);

                return (
                  <article
                    key={log.id}
                    className="rounded-lg px-3 py-2.5 border"
                    style={tileStyle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                          {log.exerciseName}
                        </p>
                        <p className="text-[11px] text-[color:var(--text-secondary)]">
                          {log.progressionName} · {log.userName}
                        </p>
                      </div>
                      {log.completed && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[color:var(--forest)]"
                          style={{
                            backgroundColor:
                              "color-mix(in srgb, var(--forest) 14%, transparent)",
                            border:
                              "1px solid color-mix(in srgb, var(--forest) 34%, transparent)",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    {sets.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {sets.map(([reps, weight], i) => (
                          <span
                            key={i}
                            className="rounded px-1.5 py-0.5 text-[10px] text-[color:var(--mist-light)]"
                            style={{
                              backgroundColor:
                                "color-mix(in srgb, var(--ink-light) 12%, transparent)",
                            }}
                          >
                            {weight ? `${weight}kg × ${reps}` : `${reps} reps`}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

// ── Members tab ────────────────────────────────────────────────────

function MembersTab({ userId: _userId }: { userId: string }) {
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const timeZone = settings.timeZone;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FriendPayload>({
    me: null,
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  });
  const [checkins, setCheckins] = useState<CheckInRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [working, setWorking] = useState(false);

  const broadcastUpdated = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("friend-requests-updated"));
    localStorage.setItem("friend-requests-updated-at", String(Date.now()));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fd, ci] = await Promise.all([
        api.get<FriendPayload>("/api/friends"),
        api
          .get<{ checkins: CheckInRow[] }>("/api/checkins?scope=friends")
          .catch(() => ({ checkins: [] as CheckInRow[] })),
      ]);
      setData(fd);
      setCheckins(ci.checkins || []);
    } catch {
      // keep previous state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendRequest = useCallback(async () => {
    const code = friendCodeInput.trim();
    if (!code) {
      setAddMsg("Enter a friend code first.");
      return;
    }
    setWorking(true);
    setAddMsg("");
    try {
      await api.post("/api/friends", { friendCode: code });
      broadcastUpdated();
      await refresh();
      setFriendCodeInput("");
      setAddMsg("Request sent.");
    } catch (e) {
      setAddMsg(e instanceof Error ? e.message : "Failed to send request.");
    } finally {
      setWorking(false);
    }
  }, [broadcastUpdated, friendCodeInput, refresh]);

  const removeFriend = useCallback(
    async (friendUserId: string, name?: string) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Remove ${name || "this friend"}?`)
      )
        return;
      setWorking(true);
      try {
        await api.delete("/api/friends", { friendUserId });
        broadcastUpdated();
        await refresh();
      } finally {
        setWorking(false);
      }
    },
    [broadcastUpdated, refresh]
  );

  const friendStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalCheckIns: number;
        lastCheckInDate: string | null;
        lastSeenAt: string | null;
        totalSessions: number;
      }
    >();
    const rowsByUser = new Map<string, CheckInRow[]>();
    for (const row of checkins) {
      const existing = rowsByUser.get(row.userId) || [];
      existing.push(row);
      rowsByUser.set(row.userId, existing);
    }
    for (const friend of data.friends) {
      const rows = rowsByUser.get(friend.id) || [];
      const present = rows
        .filter((r) => r.present)
        .sort((a, b) => b.date.localeCompare(a.date));
      const candidates = [
        friend.lastActivityAt,
        friend.lastWorkoutAt,
        friend.lastCheckInAt,
        present[0]?.date ? `${present[0].date}T00:00:00.000Z` : null,
      ]
        .filter((v): v is string => Boolean(v))
        .sort((a, b) => toTimestamp(b) - toTimestamp(a));
      map.set(friend.id, {
        totalCheckIns: present.length || Number(friend.checkInCount || 0),
        lastCheckInDate: present[0]?.date || null,
        lastSeenAt: candidates[0] || null,
        totalSessions: Number(friend.sessionCount || 0),
      });
    }
    return map;
  }, [checkins, data.friends]);

  const sorted = useMemo(
    () =>
      [...data.friends].sort((a, b) => {
        const aTs = toTimestamp(friendStatsMap.get(a.id)?.lastSeenAt);
        const bTs = toTimestamp(friendStatsMap.get(b.id)?.lastSeenAt);
        if (Number.isFinite(aTs) || Number.isFinite(bTs)) {
          if (!Number.isFinite(aTs)) return 1;
          if (!Number.isFinite(bTs)) return -1;
          if (aTs !== bTs) return bTs - aTs;
        }
        return a.name.localeCompare(b.name);
      }),
    [data.friends, friendStatsMap]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[12px] text-[color:var(--text-muted)]">Loading members…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add friend */}
      <div className="rounded-lg px-3 py-3 border" style={tileStyle}>
        <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Add by friend code
        </p>
        <div className="flex gap-2">
          <input
            value={friendCodeInput}
            onChange={(e) => setFriendCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendRequest();
            }}
            placeholder="Friend code"
            className="flex-1 rounded-md bg-transparent px-2.5 py-1.5 text-[13px] text-[color:var(--text-primary)] outline-none"
            style={{
              border:
                "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)",
            }}
          />
          <button
            type="button"
            onClick={() => void sendRequest()}
            disabled={working}
            className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-[color:var(--text-primary)] disabled:opacity-50"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--accent) 20%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            }}
          >
            Add
          </button>
        </div>
        {data.me?.friendCode && (
          <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
            Your code:{" "}
            <span className="font-semibold text-[color:var(--text-primary)]">
              {data.me.friendCode}
            </span>
          </p>
        )}
        {addMsg && (
          <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{addMsg}</p>
        )}
      </div>

      {/* Friends list */}
      {sorted.length === 0 ? (
        <div className="rounded-lg p-3 border" style={tileStyle}>
          <EmptyFriends friendCode={data.me?.friendCode ?? undefined} />
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((friend) => {
            const stats = friendStatsMap.get(friend.id);
            const expanded = expandedIds.has(friend.id);
            return (
              <article
                key={friend.id}
                className="rounded-lg p-3 border"
                style={tileStyle}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIds((prev) => {
                      const n = new Set(prev);
                      n.has(friend.id) ? n.delete(friend.id) : n.add(friend.id);
                      return n;
                    })
                  }
                  aria-expanded={expanded}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                      {friend.name}
                    </p>
                    <p className="truncate text-[11px] text-[color:var(--text-secondary)]">
                      @{friend.username}
                    </p>
                  </div>
                  <span
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-[color:var(--mist-light)]"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--accent) 14%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--accent) 34%, transparent)",
                    }}
                  >
                    {stats?.lastSeenAt
                      ? formatRelative(stats.lastSeenAt)
                      : "No activity"}
                  </span>
                </button>

                {expanded && (
                  <div className="mt-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded-md px-2 py-1.5" style={microTileStyle}>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                          Sessions
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold text-[color:var(--text-primary)]">
                          {stats?.totalSessions ?? 0}
                        </p>
                      </div>
                      <div className="rounded-md px-2 py-1.5" style={microTileStyle}>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                          Check-ins
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold text-[color:var(--text-primary)]">
                          {stats?.totalCheckIns ?? 0}
                        </p>
                      </div>
                      <div className="rounded-md px-2 py-1.5" style={microTileStyle}>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                          Last check-in
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold text-[color:var(--text-primary)]">
                          {stats?.lastCheckInDate
                            ? formatDateWithPreference(
                                stats.lastCheckInDate,
                                dateFormat,
                                timeZone
                              )
                            : "-"}
                        </p>
                      </div>
                      <div className="rounded-md px-2 py-1.5" style={microTileStyle}>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                          Member since
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold text-[color:var(--text-primary)]">
                          {friend.createdAt
                            ? formatDateWithPreference(friend.createdAt, dateFormat, timeZone)
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md px-2 py-1.5" style={microTileStyle}>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                        Last activity
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-[color:var(--text-primary)]">
                        {friend.lastActivityAt
                          ? `${friend.lastActivityLabel || "Active"} · ${formatRelative(friend.lastActivityAt)}`
                          : stats?.lastSeenAt
                            ? formatRelative(stats.lastSeenAt)
                            : "No activity"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeFriend(friend.id, friend.name)}
                      disabled={working}
                      className="w-full rounded-md py-1.5 text-[11px] font-medium text-[color:var(--danger)] disabled:opacity-50"
                      style={{
                        border:
                          "1px solid color-mix(in srgb, var(--danger) 24%, transparent)",
                        backgroundColor:
                          "color-mix(in srgb, var(--danger) 8%, transparent)",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Requests tab ───────────────────────────────────────────────────

function RequestsTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FriendPayload>({
    me: null,
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  });
  const [working, setWorking] = useState(false);

  const broadcastUpdated = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("friend-requests-updated"));
    localStorage.setItem("friend-requests-updated-at", String(Date.now()));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fd = await api.get<FriendPayload>("/api/friends");
      setData(fd);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const respond = useCallback(
    async (requestId: string, action: "accept" | "reject") => {
      setWorking(true);
      try {
        await api.patch("/api/friends", { requestId, action });
        broadcastUpdated();
        await refresh();
      } finally {
        setWorking(false);
      }
    },
    [broadcastUpdated, refresh]
  );

  const cancel = useCallback(
    async (requestId: string) => {
      setWorking(true);
      try {
        await api.delete("/api/friends", { requestId });
        broadcastUpdated();
        await refresh();
      } finally {
        setWorking(false);
      }
    },
    [broadcastUpdated, refresh]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[12px] text-[color:var(--text-muted)]">Loading requests…</p>
      </div>
    );
  }

  const { incomingRequests, outgoingRequests } = data;

  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Incoming ({incomingRequests.length})
        </p>
        {incomingRequests.length === 0 ? (
          <div
            className="rounded-lg p-3 text-center border"
            style={tileStyle}
          >
            <p className="text-[12px] text-[color:var(--text-muted)]">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 border"
                style={tileStyle}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {req.requester.name}
                  </p>
                  <p className="truncate text-[11px] text-[color:var(--text-secondary)]">
                    @{req.requester.username}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void respond(req.id, "accept")}
                    disabled={working}
                    className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-[color:var(--forest)] disabled:opacity-50"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--forest) 14%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--forest) 34%, transparent)",
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(req.id, "reject")}
                    disabled={working}
                    className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[color:var(--danger)] disabled:opacity-50"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--danger) 8%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--danger) 24%, transparent)",
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Outgoing ({outgoingRequests.length})
        </p>
        {outgoingRequests.length === 0 ? (
          <div
            className="rounded-lg p-3 text-center border"
            style={tileStyle}
          >
            <p className="text-[12px] text-[color:var(--text-muted)]">No outgoing requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {outgoingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 border"
                style={tileStyle}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {req.receiver.name}
                  </p>
                  <p className="truncate text-[11px] text-[color:var(--text-secondary)]">
                    @{req.receiver.username}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void cancel(req.id)}
                  disabled={working}
                  className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-muted)] disabled:opacity-50"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--ink-light) 12%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--ink-light) 30%, transparent)",
                  }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function CirclePage() {
  const { user } = useAuth();
  const { count: incomingFriendRequestCount } = useIncomingFriendRequestsCount(user?.id);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tab = (searchParams.get("tab") as Tab) || "feed";

  const setTab = useCallback(
    (newTab: Tab) => {
      router.replace(`${pathname}?tab=${newTab}`, { scroll: false });
    },
    [pathname, router]
  );

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "feed", label: "Feed" },
    { id: "members", label: "Members" },
    { id: "requests", label: "Requests" },
  ];

  const isFriendRailDrawerOpen = Boolean(
    searchParams.get("friendDrawerId") || searchParams.get("friendView") || searchParams.get("targetUserId")
  );

  const shellMinHeight =
    "calc(var(--app-viewport-height) - var(--mobile-nav-offset) - 0.5rem)";

  const sectionShellStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
    boxShadow:
      "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 2%, transparent)",
  };

  return (
    <PageLayout
      title="Circle"
      subtitle="Your cultivation circle"
      mobileContentPaddingClass="p-0 pb-0"
      mobileScrollContainerEnabled={false}
    >
      <div className="flex min-h-0" style={{ minHeight: shellMinHeight }}>
        <div className="flex shrink-0">
          <DiscordFriendsRail incomingFriendRequestCount={incomingFriendRequestCount} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-0" style={{ minHeight: shellMinHeight }}>
          {!isFriendRailDrawerOpen ? (
            <section
              className="flex min-h-0 flex-1 flex-col rounded-tl-2xl border"
              style={{ ...sectionShellStyle, minHeight: shellMinHeight }}
            >
              {/* Fixed top region: Page header + Tab bar */}
              <div
                className="shrink-0 rounded-tl-2xl"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
                }}
              >
                <PageHeader
                  eyebrow="Circle"
                  title={tabs.find((t) => t.id === tab)?.label ?? "Feed"}
                  className="px-3 pt-3 pb-2.5"
                  noBorder
                />
                <div
                  className="flex border-b"
                  style={{
                    borderBottomColor:
                      "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                  }}
                >
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className="flex-1 py-2.5 text-[12px] font-semibold tracking-wide transition-colors"
                      style={{
                        color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
                        borderBottom:
                          tab === t.id
                            ? "2px solid var(--accent)"
                            : "2px solid transparent",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content — scrolls internally */}
              <div
                data-mobile-scroll-container="true"
                className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-2 py-3"
                style={{
                  paddingBottom:
                    "calc(var(--mobile-nav-offset, calc(env(safe-area-inset-bottom, 0px) + 4.85rem)) + 0.75rem)",
                }}
              >
                {user && tab === "feed" && <FeedTab userId={user.id} />}
                {user && tab === "members" && <MembersTab userId={user.id} />}
                {tab === "requests" && <RequestsTab />}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}
