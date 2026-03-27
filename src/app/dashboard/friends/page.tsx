"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";

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

export default function FriendsPage() {
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
        totalCheckIns: presentRows.length,
        lastCheckInDate: presentRows[0]?.date || null,
        latestWeight: (weightedRows[0]?.weight as number | undefined) ?? null,
      });
    }

    return statsByUser;
  }, [checkins, data.friends]);

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

  const removeFriend = useCallback(async (friendUserId: string) => {
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

  return (
    <PageLayout
      title="Friends"
      subtitle="Manage your social circle and shared cultivation visibility"
    >
      {loading ? (
        <GlowCard glow="jade">
          <p className="text-sm text-mist-dark">Loading friends data...</p>
        </GlowCard>
      ) : (
        <div className="space-y-4">
          <GlowCard glow="jade">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-jade-glow uppercase">Friends</h3>
              <span className="text-xs text-mist-dark">{data.friends.length} connected</span>
            </div>
            {data.friends.length === 0 ? (
              <p className="text-sm text-mist-dark">No friends yet. Send requests below to start sharing data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-light/70">
                      <th className="px-2 py-2 text-left text-xs text-jade-glow uppercase">Cultivator</th>
                      <th className="px-2 py-2 text-center text-xs text-jade-glow uppercase">Check-Ins</th>
                      <th className="px-2 py-2 text-center text-xs text-jade-glow uppercase">Last Check-In</th>
                      <th className="px-2 py-2 text-center text-xs text-jade-glow uppercase">Latest Weight</th>
                      <th className="px-2 py-2 text-center text-xs text-jade-glow uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.friends.map((friend) => {
                      const stats = friendStatsMap.get(friend.id) || {
                        totalCheckIns: 0,
                        lastCheckInDate: null,
                        latestWeight: null,
                      };

                      return (
                        <tr key={friend.id} className="border-b border-ink-light/40">
                          <td className="px-2 py-2 text-cloud-white">
                            <div className="font-medium">{friend.name}</div>
                            <div className="text-xs text-mist-dark">@{friend.username}</div>
                            <div className="text-xs text-mist-dark">ID: {(friend.friendCode?.trim() || friend.id)}</div>
                          </td>
                          <td className="px-2 py-2 text-center text-mist-light">{stats.totalCheckIns}</td>
                          <td className="px-2 py-2 text-center text-mist-light">
                            {stats.lastCheckInDate
                              ? formatDateWithPreference(stats.lastCheckInDate, dateFormat)
                              : "-"}
                          </td>
                          <td className="px-2 py-2 text-center text-mist-light">
                            {stats.latestWeight != null ? `${stats.latestWeight} kg` : "-"}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <GlowButton
                              variant="ghost"
                              size="sm"
                              disabled={working}
                              onClick={() => removeFriend(friend.id)}
                            >
                              Remove
                            </GlowButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlowCard>

          <div className="grid grid-cols-2 gap-3">
            <GlowCard glow="gold">
              <h3 className="text-sm text-gold uppercase mb-3">Incoming Requests</h3>
              {data.incomingRequests.length === 0 ? (
                <p className="text-sm text-mist-dark">No pending incoming requests.</p>
              ) : (
                <div className="space-y-2">
                  {data.incomingRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-ink-light/50 bg-ink-mid/20 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-cloud-white">{request.requester.name}</p>
                          <p className="text-xs text-mist-dark">@{request.requester.username}</p>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <GlowButton
                            variant="jade"
                            size="sm"
                            disabled={working}
                            onClick={() => respondRequest(request.id, "accept")}
                          >
                            Accept
                          </GlowButton>
                          <GlowButton
                            variant="crimson"
                            size="sm"
                            disabled={working}
                            onClick={() => respondRequest(request.id, "reject")}
                          >
                            Reject
                          </GlowButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlowCard>

            <GlowCard glow="blue">
              <h3 className="text-sm text-mountain-blue-glow uppercase mb-3">Outgoing Pending Invitations</h3>
              {data.outgoingRequests.length === 0 ? (
                <p className="text-sm text-mist-dark">No outgoing pending requests.</p>
              ) : (
                <div className="space-y-2">
                  {data.outgoingRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-ink-light/50 bg-ink-mid/20 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-cloud-white">{request.receiver.name}</p>
                          <p className="text-xs text-mist-dark">@{request.receiver.username}</p>
                        </div>
                        <GlowButton
                          variant="ghost"
                          size="sm"
                          disabled={working}
                          onClick={() => cancelOutgoing(request.id)}
                          className="self-start sm:self-auto"
                        >
                          Cancel
                        </GlowButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlowCard>
          </div>

          <GlowCard glow="blue">
            <h3 className="text-xs text-mountain-blue-glow uppercase mb-2">Add Friend</h3>
            <div className="space-y-2">
              <div className="rounded-md border border-ink-light/50 bg-ink-mid/20 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-mist-dark uppercase">Your Friend ID</p>
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
                <p className="text-xs text-cloud-white font-semibold break-all leading-tight mt-1">{shareableFriendId || "-"}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={(event) => setFriendCodeInput(event.target.value)}
                  placeholder="Enter friend's ID"
                  className="flex-1 bg-ink-deep border border-ink-light rounded px-2.5 py-1.5 text-xs text-cloud-white placeholder-mist-dark outline-none focus:border-jade-glow transition-colors"
                />
                <GlowButton variant="jade" size="sm" disabled={working} onClick={sendFriendRequest}>
                  Send Request
                </GlowButton>
              </div>

              {addFriendMessage && (
                <p className="text-xs text-mist-light">{addFriendMessage}</p>
              )}
            </div>
          </GlowCard>

        </div>
      )}
    </PageLayout>
  );
}
