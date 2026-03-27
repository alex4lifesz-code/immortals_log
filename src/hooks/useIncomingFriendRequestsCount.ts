"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface FriendsCountPayload {
  incomingRequests?: unknown[];
}

export function useIncomingFriendRequestsCount(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["incoming-friend-requests", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const payload = await api.get<FriendsCountPayload>("/api/friends");
      return Array.isArray(payload.incomingRequests) ? payload.incomingRequests.length : 0;
    },
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }
    await query.refetch();
  }, [query, userId]);

  useEffect(() => {
    if (!userId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["incoming-friend-requests", userId] });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        invalidate();
      }
    };

    const onFriendRequestsUpdated = () => {
      invalidate();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "friend-requests-updated-at") {
        invalidate();
      }
    };

    window.addEventListener("focus", invalidate);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("friend-requests-updated", onFriendRequestsUpdated);
    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(() => {
      invalidate();
    }, 60000);

    return () => {
      window.removeEventListener("focus", invalidate);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("friend-requests-updated", onFriendRequestsUpdated);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [queryClient, userId]);

  return { count: userId ? (query.data ?? 0) : 0, refresh };
}
