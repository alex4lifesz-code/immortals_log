"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { EmptyFriends } from "@/components/empty-states";

interface BasicUser {
  id: string;
  name: string;
  username: string;
  friendCode?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sessionCount?: number | null;
  checkInCount?: number | null;
  lastWorkoutAt?: string | null;
  lastCheckInAt?: string | null;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
}

interface FriendRequestRow {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  respondedAt?: string | null;
  requester: BasicUser;
  receiver: BasicUser;
}

interface FriendPayload {
  me?: { id: string; friendCode?: string | null } | null;
  friends: BasicUser[];
  incomingRequests: FriendRequestRow[];
  outgoingRequests: FriendRequestRow[];
}

interface FriendRequestCreateResponse {
  request: FriendRequestRow;
  resent?: boolean;
}

interface CheckInRow {
  date: string;
  userId: string;
  present: boolean;
  weight?: number | null;
  comment?: string | null;
}

interface FriendStats {
  totalCheckIns: number;
  lastCheckInDate: string | null;
  latestWeight: number | null;
  totalSessions: number;
  lastSeenAt: string | null;
  lastSeenLabel: string;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatRelativeRecentDate(
  dateLike: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy" = "dd-mmm-yyyy",
  timeZone?: string,
): string {
  const timestamp = toTimestamp(dateLike);
  if (!Number.isFinite(timestamp)) return "-";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "just now";

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) {
    const mins = Math.max(1, Math.floor(diffMs / minuteMs));
    return `${mins}m ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return `${hours}h ago`;
  }

  if (diffMs < 14 * dayMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days}d ago`;
  }

  return formatDateWithPreference(new Date(timestamp), dateFormat, timeZone);
}

export default function FriendsPage() {
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const timeZone = settings.timeZone;

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [data, setData] = useState<FriendPayload>({
    me: null,
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  });
  const [checkins, setCheckins] = useState<CheckInRow[]>([]);
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [addFriendMessage, setAddFriendMessage] = useState("");
  const shareableFriendId = data.me?.friendCode?.trim() || data.me?.id || "";

  const broadcastFriendRequestsUpdated = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("friend-requests-updated"));
    localStorage.setItem("friend-requests-updated-at", String(Date.now()));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [friendData, checkinResult] = await Promise.all([
        api.get<FriendPayload>("/api/friends"),
        api.get<{ checkins: CheckInRow[] }>("/api/checkins?scope=friends").catch(() => ({ checkins: [] })),
      ]);
      setData(friendData);
      setCheckins(checkinResult.checkins || []);
    } catch (error) {
      console.error("Failed to load friends page:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const friendStatsMap = useMemo(() => {
    const statsByUser = new Map<string, FriendStats>();

    const rowsByUser = new Map<string, CheckInRow[]>();
    for (const row of checkins) {
      const rows = rowsByUser.get(row.userId) || [];
      rows.push(row);
      rowsByUser.set(row.userId, rows);
    }

    for (const friend of data.friends) {
      const rows = rowsByUser.get(friend.id) || [];
      const presentRows = rows
        .filter((row) => row.present)
        .sort((a, b) => b.date.localeCompare(a.date));
      const weightedRows = rows
        .filter((row) => typeof row.weight === "number" && Number.isFinite(row.weight))
        .sort((a, b) => b.date.localeCompare(a.date));

      statsByUser.set(friend.id, {
        totalCheckIns: presentRows.length || Number(friend.checkInCount || 0),
        lastCheckInDate: presentRows[0]?.date || friend.lastCheckInAt || null,
        latestWeight: (weightedRows[0]?.weight as number | undefined) ?? null,
        totalSessions: Number(friend.sessionCount || 0),
        lastSeenAt: (() => {
          const candidates: Array<string | null> = [
            friend.lastActivityAt || null,
            friend.lastWorkoutAt || null,
            friend.lastCheckInAt || null,
            presentRows[0]?.date ? `${presentRows[0].date}T00:00:00.000Z` : null,
          ];

          const sorted = candidates
            .filter((value): value is string => Boolean(value))
            .sort((left, right) => toTimestamp(right) - toTimestamp(left));

          return sorted[0] || null;
        })(),
        lastSeenLabel: (() => {
          const activityAt = friend.lastActivityAt || null;
          const workoutAt = friend.lastWorkoutAt || null;
          const checkInAt = friend.lastCheckInAt || null;
          const latest = [activityAt, workoutAt, checkInAt]
            .filter((value): value is string => Boolean(value))
            .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0];

          if (!latest) return "Last seen";
          if (activityAt && latest === activityAt) return (friend.lastActivityLabel || "Last seen").trim() || "Last seen";
          if (workoutAt && latest === workoutAt) return "Last workout";
          return "Last check-in";
        })(),
      });
    }

    return statsByUser;
  }, [checkins, data.friends]);

  const sortedFriends = useMemo(() => {
    return [...data.friends].sort((left, right) => {
      const leftStats = friendStatsMap.get(left.id);
      const rightStats = friendStatsMap.get(right.id);
      const leftDate = toTimestamp(leftStats?.lastSeenAt || null);
      const rightDate = toTimestamp(rightStats?.lastSeenAt || null);
      if (Number.isFinite(leftDate) || Number.isFinite(rightDate)) {
        if (!Number.isFinite(leftDate)) return 1;
        if (!Number.isFinite(rightDate)) return -1;
        if (leftDate !== rightDate) return rightDate - leftDate;
      }
      return left.name.localeCompare(right.name);
    });
  }, [data.friends, friendStatsMap]);

  const sendFriendRequest = useCallback(async () => {
    const normalized = friendCodeInput.trim();
    if (!normalized) {
      setAddFriendMessage("Enter a friend ID first.");
      return;
    }

    setWorking(true);
    setAddFriendMessage("");
    try {
      const response = await api.post<FriendRequestCreateResponse>("/api/friends", { friendCode: normalized });
      if (response?.request) {
        setData((prev) => {
          const withoutSame = prev.outgoingRequests.filter((request) => request.id !== response.request.id);
          return {
            ...prev,
            outgoingRequests: [response.request, ...withoutSame],
          };
        });
      }
      broadcastFriendRequestsUpdated();
      await refresh();
      setFriendCodeInput("");
      setAddFriendMessage("Friend request sent.");
    } catch (error) {
      console.error("Failed to send friend request:", error);
      setAddFriendMessage(error instanceof Error ? error.message : "Failed to send friend request.");
    } finally {
      setWorking(false);
    }
  }, [broadcastFriendRequestsUpdated, friendCodeInput, refresh]);

  const respondRequest = useCallback(async (requestId: string, action: "accept" | "reject") => {
    setWorking(true);
    try {
      await api.patch("/api/friends", { requestId, action });
      broadcastFriendRequestsUpdated();
      await refresh();
    } catch (error) {
      console.error("Failed to respond to friend request:", error);
    } finally {
      setWorking(false);
    }
  }, [broadcastFriendRequestsUpdated, refresh]);

  const cancelOutgoing = useCallback(async (requestId: string) => {
    setWorking(true);
    try {
      await api.delete("/api/friends", { requestId });
      broadcastFriendRequestsUpdated();
      await refresh();
    } catch (error) {
      console.error("Failed to cancel request:", error);
    } finally {
      setWorking(false);
    }
  }, [broadcastFriendRequestsUpdated, refresh]);

  const removeFriend = useCallback(async (friendUserId: string, friendName?: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Remove ${friendName || "this friend"} from your friends list? This cannot be undone automatically.`
      );
      if (!confirmed) return;
    }

    setWorking(true);
    try {
      await api.delete("/api/friends", { friendUserId });
      broadcastFriendRequestsUpdated();
      await refresh();
    } catch (error) {
      console.error("Failed to remove friend:", error);
    } finally {
      setWorking(false);
    }
  }, [broadcastFriendRequestsUpdated, refresh]);

  const pendingCount = data.incomingRequests.length + data.outgoingRequests.length;
  const activeFriendsCount = Array.from(friendStatsMap.values()).filter((stats) => stats.totalCheckIns > 0).length;

  const sectionShellStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 2%, transparent)",
  };

  const tileStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
  };

  const shellMinHeight = "calc(var(--app-viewport-height) - var(--mobile-nav-offset) - 0.5rem)";

  return (
    <PageLayout
      title="Friends"
      subtitle="Social navigation for your cultivation circle"
      mobileContentPaddingClass="p-0 pb-0"
    >
      {loading ? (
        <GlowCard glow="jade" hoverable={false}>
          <p className="py-4 text-center text-sm text-mist-dark">Loading friends data...</p>
        </GlowCard>
      ) : (
        <div className="flex flex-col px-0" style={{ minHeight: shellMinHeight }}>
          <section
            className="flex min-h-0 flex-1 flex-col rounded-tl-2xl border"
            style={{
              ...sectionShellStyle,
              minHeight: shellMinHeight,
            }}
          >
            <div
              className="sticky top-0 z-10 border-b rounded-tl-2xl px-3 py-3"
              style={{
                borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Cultivation Circle</p>
              <h2 className="mt-1 text-sm font-semibold text-[#f2f3f5]">Friends Navigation</h2>
              <p className="mt-1 text-[11px] text-[#b5bac1]">Open the social areas you want, with the same flatter train-style feed feel.</p>
            </div>

            <div className="flex flex-1 flex-col space-y-3 px-2 py-2.5 pb-[calc(var(--mobile-nav-offset,calc(env(safe-area-inset-bottom,0px)+4.85rem))+0.75rem)]">
              <section className="grid grid-cols-3 gap-2">
                <div className="rounded-md border px-2.5 py-2" style={tileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Friends</p>
                  <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{data.friends.length}</p>
                </div>
                <div className="rounded-md border px-2.5 py-2" style={tileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Pending</p>
                  <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{pendingCount}</p>
                </div>
                <div className="rounded-md border px-2.5 py-2" style={tileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Active</p>
                  <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{activeFriendsCount}</p>
                </div>
              </section>

              <section className="border-t pt-2" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Navigation</p>

                <div className="space-y-2">
                  <Link
                    href="/dashboard/friends/manage"
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-[#2b2d31]"
                    style={{
                      border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 48%, var(--ink-deep))",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#f2f3f5]">Manage Friends</p>
                      <p className="mt-0.5 text-[11px] text-[#b5bac1]">Incoming requests, outgoing invites, and remove friend actions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold text-[#c8cdfa]" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 34%, transparent)" }}>
                        {pendingCount}
                      </span>
                      <span className="text-[#949ba4]">›</span>
                    </div>
                  </Link>

                  <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-3" style={{ border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-mid) 48%, var(--ink-deep))" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#f2f3f5]">Connected Cultivators</p>
                      <p className="mt-0.5 text-[11px] text-[#b5bac1]">Your current circle and recent social activity at a glance.</p>
                    </div>
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold text-[#dbdee1]" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--ink-light) 34%, transparent)" }}>
                      {data.friends.length}
                    </span>
                  </div>
                </div>
              </section>

              <section className="flex flex-1 flex-col border-t pt-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <div className="mb-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Circle Activity</p>
                  <p className="mt-1 text-[11px] text-[#b5bac1]">Live at-a-glance summary for everyone in your current circle.</p>
                </div>

                {sortedFriends.length === 0 ? (
                  <div className="rounded-lg p-3" style={{ border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-mid) 48%, var(--ink-deep))" }}>
                    <EmptyFriends friendCode={data.me?.friendCode ?? undefined} />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col space-y-2.5">
                    {sortedFriends.map((friend) => {
                      const stats = friendStatsMap.get(friend.id) || {
                        totalCheckIns: 0,
                        lastCheckInDate: null,
                        latestWeight: null,
                        totalSessions: Number(friend.sessionCount || 0),
                        lastSeenAt: friend.lastActivityAt || friend.lastWorkoutAt || friend.lastCheckInAt || null,
                        lastSeenLabel: "Last seen",
                      };

                      return (
                        <article key={friend.id} className="rounded-lg p-3" style={{ border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-mid) 48%, var(--ink-deep))" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#f2f3f5]">{friend.name}</p>
                              <p className="truncate text-[11px] text-[#b5bac1]">@{friend.username}</p>
                            </div>
                            <span className="rounded-md px-2 py-1 text-[11px] text-[#dbdee1]" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 34%, transparent)" }}>
                              {stats.lastSeenAt ? `${stats.lastSeenLabel}: ${formatRelativeRecentDate(stats.lastSeenAt, dateFormat, timeZone)}` : "No recent activity"}
                            </span>
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-md px-2 py-1.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--ink-light) 24%, transparent)" }}>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Sessions</p>
                              <p className="mt-0.5 font-semibold text-[#f2f3f5]">{stats.totalSessions}</p>
                            </div>
                            <div className="rounded-md px-2 py-1.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--ink-light) 24%, transparent)" }}>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Check-ins</p>
                              <p className="mt-0.5 font-semibold text-[#f2f3f5]">{stats.totalCheckIns}</p>
                            </div>
                            <div className="rounded-md px-2 py-1.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--ink-light) 24%, transparent)" }}>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Last Check-In</p>
                              <p className="mt-0.5 font-semibold text-[#f2f3f5]">{stats.lastCheckInDate ? formatDateWithPreference(stats.lastCheckInDate, dateFormat, timeZone) : "-"}</p>
                            </div>
                            <div className="rounded-md px-2 py-1.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--ink-light) 24%, transparent)" }}>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Latest Weight</p>
                              <p className="mt-0.5 font-semibold text-[#f2f3f5]">{typeof stats.latestWeight === "number" ? `${stats.latestWeight}` : "-"}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    <div
                      className="flex flex-1 min-h-[3rem] items-center justify-center rounded-lg px-3 py-3 text-center"
                      style={{
                        border: "1px dashed color-mix(in srgb, var(--ink-light) 32%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 28%, var(--ink-deep))",
                      }}
                    >
                      <p className="text-[11px] text-[#949ba4]">
                        Showing {sortedFriends.length} {sortedFriends.length === 1 ? "cultivator" : "cultivators"} • activity refreshes when you return.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </PageLayout>
  );
}
