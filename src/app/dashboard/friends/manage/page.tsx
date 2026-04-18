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
}

export default function ManageFriendsPage() {
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";

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
      console.error("Failed to load manage friends page:", error);
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
        totalCheckIns: presentRows.length,
        lastCheckInDate: presentRows[0]?.date || null,
        latestWeight: (weightedRows[0]?.weight as number | undefined) ?? null,
      });
    }

    return statsByUser;
  }, [checkins, data.friends]);

  const sortedFriends = useMemo(() => {
    return [...data.friends].sort((left, right) => left.name.localeCompare(right.name));
  }, [data.friends]);

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
        setData((prev) => ({
          ...prev,
          outgoingRequests: [response.request, ...prev.outgoingRequests.filter((request) => request.id !== response.request.id)],
        }));
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

  const sectionShellStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 2%, transparent)",
  };

  const rowStyle = {
    border: "1px solid color-mix(in srgb, var(--ink-light) 40%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-mid) 48%, var(--ink-deep))",
  };

  const shellMinHeight = "calc(var(--app-viewport-height) - var(--mobile-nav-offset) - 0.5rem)";

  return (
    <PageLayout
      title="Manage Friends"
      subtitle="Handle requests, invites, and your connected cultivators"
      mobileContentPaddingClass="p-0 pb-0"
    >
      {loading ? (
        <GlowCard glow="jade" hoverable={false}>
          <p className="py-4 text-center text-sm text-mist-dark">Loading friends data...</p>
        </GlowCard>
      ) : (
        <div className="flex flex-col px-0" style={{ minHeight: shellMinHeight }}>
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden border rounded-tl-2xl"
            style={{
              ...sectionShellStyle,
              minHeight: shellMinHeight,
            }}
          >
            <div
              className="sticky top-0 z-10 border-b px-3 py-2.5"
              style={{
                borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
              }}
            >
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/friends"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors"
                  style={{
                    color: "var(--mist-light)",
                    backgroundColor: "transparent",
                  }}
                  aria-label="Back to friends"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#dbdee1]">Manage Friends</h2>
                  <p className="mt-0.5 text-[11px] text-[#b5bac1]">Accept requests, send invites, and manage your cultivation circle.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col space-y-3 px-2 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              <section className="border-t pt-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Add Friend</p>
                  <p className="mt-1 text-[11px] text-[#b5bac1]">Share your code or send a request directly.</p>
                </div>

                <div className="rounded-lg px-2.5 py-2" style={rowStyle}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Your Friend ID</p>
                    <GlowButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!shareableFriendId) return;
                        navigator.clipboard?.writeText(shareableFriendId).catch(() => {});
                      }}
                    >
                      Copy
                    </GlowButton>
                  </div>
                  <p className="mt-1 break-all text-xs font-semibold text-[#f2f3f5]">{shareableFriendId || "-"}</p>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={friendCodeInput}
                    onChange={(event) => setFriendCodeInput(event.target.value.toLowerCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void sendFriendRequest();
                      }
                    }}
                    placeholder="Enter a friend ID"
                    className="h-9 flex-1 rounded-md border px-2.5 text-sm outline-none"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                      color: "var(--cloud-white)",
                    }}
                  />
                  <GlowButton variant="jade" size="sm" disabled={working} onClick={sendFriendRequest}>
                    Send Request
                  </GlowButton>
                </div>

                {addFriendMessage ? <p className="mt-2 text-[11px] text-[#dbdee1]">{addFriendMessage}</p> : null}
              </section>

              <section className="border-t pt-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <div className="mb-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Incoming Requests</p>
                </div>
                {data.incomingRequests.length === 0 ? (
                  <div className="rounded-lg px-3 py-3 text-[11px] text-[#949ba4]" style={rowStyle}>
                    No pending incoming requests.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.incomingRequests.map((request) => (
                      <article key={request.id} className="rounded-lg px-3 py-2.5" style={rowStyle}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f2f3f5]">{request.requester.name}</p>
                            <p className="truncate text-[11px] text-[#b5bac1]">@{request.requester.username}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <GlowButton variant="jade" size="sm" disabled={working} onClick={() => respondRequest(request.id, "accept")}>
                              Accept
                            </GlowButton>
                            <GlowButton variant="crimson" size="sm" disabled={working} onClick={() => respondRequest(request.id, "reject")}>
                              Reject
                            </GlowButton>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="border-t pt-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <div className="mb-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Outgoing Requests</p>
                </div>
                {data.outgoingRequests.length === 0 ? (
                  <div className="rounded-lg px-3 py-3 text-[11px] text-[#949ba4]" style={rowStyle}>
                    No outgoing pending requests.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.outgoingRequests.map((request) => (
                      <article key={request.id} className="rounded-lg px-3 py-2.5" style={rowStyle}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f2f3f5]">{request.receiver.name}</p>
                            <p className="truncate text-[11px] text-[#b5bac1]">@{request.receiver.username}</p>
                          </div>
                          <GlowButton variant="ghost" size="sm" disabled={working} onClick={() => cancelOutgoing(request.id)}>
                            Cancel
                          </GlowButton>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="border-t pt-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <div className="mb-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Connected Friends</p>
                </div>
                {sortedFriends.length === 0 ? (
                  <div className="rounded-lg p-3" style={rowStyle}>
                    <EmptyFriends friendCode={data.me?.friendCode ?? undefined} />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sortedFriends.map((friend) => {
                      const stats = friendStatsMap.get(friend.id) || {
                        totalCheckIns: 0,
                        lastCheckInDate: null,
                        latestWeight: null,
                      };

                      return (
                        <article key={friend.id} className="rounded-lg p-3" style={rowStyle}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#f2f3f5]">{friend.name}</p>
                              <p className="text-[11px] text-[#b5bac1]">@{friend.username}</p>
                              <p className="mt-1 text-[10px] text-[#949ba4]">
                                {stats.lastCheckInDate ? `Last check-in on ${formatDateWithPreference(stats.lastCheckInDate, dateFormat)}` : "No check-in activity yet."}
                              </p>
                            </div>
                            <GlowButton variant="ghost" size="sm" disabled={working} onClick={() => removeFriend(friend.id, friend.name)}>
                              Remove
                            </GlowButton>
                          </div>
                        </article>
                      );
                    })}
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
