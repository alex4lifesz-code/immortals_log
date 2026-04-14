"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { api } from "@/lib/api-client";
import { useIsMobile } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

interface FriendsPayload {
  friends?: Array<{ id: string; name: string; username?: string | null }>;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function DiscordFriendsRail({ incomingFriendRequestCount = 0 }: { incomingFriendRequestCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const isActive = pathname === DASHBOARD_ROUTES.friends || pathname.startsWith(`${DASHBOARD_ROUTES.friends}/`);
  const [friends, setFriends] = useState<Array<{ id: string; name: string; username?: string }>>([]);
  const [friendActionsOpen, setFriendActionsOpen] = useState(false);
  const [activeFriend, setActiveFriend] = useState<{ id: string; name: string; username?: string } | null>(null);
  const railWidthPx = isMobile ? 64 : 76;

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
    const meId = user?.id || "me";
    const meName = (user?.name || user?.username || "Me").trim() || "Me";
    const others = friends.filter((friend) => friend.id !== user?.id).slice(0, 6);
    return [{ id: meId, name: meName, isMe: true }, ...others.map((friend) => ({ ...friend, isMe: false }))];
  }, [friends, user?.id, user?.name, user?.username]);

  const closeFriendPanels = () => {
    setFriendActionsOpen(false);
    setActiveFriend(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("train-reset-view"));
    }
  };

  return (
    <>
      <aside className="flex h-full w-[64px] md:w-[76px] shrink-0 border-r border-[#1f2227] bg-[#1e1f22]">
        <div className="flex h-full w-full flex-col items-center gap-3 px-2 pt-[calc(env(safe-area-inset-top,0px)+2.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] md:pb-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              closeFriendPanels();
              router.push(DASHBOARD_ROUTES.friends);
            }}
            aria-current={isActive ? "page" : undefined}
            aria-label="Friends"
            className={`relative flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-2xl border transition-colors duration-150 ${
              isActive
                ? "border-[#6f78ff] bg-[#5865f2] text-white shadow-[0_0_0_1px_rgba(111,120,255,0.35),0_10px_22px_rgba(88,101,242,0.35)]"
                : "border-[#3a3d44] bg-[#2b2d31] text-[#b8bcc6] hover:border-[#5865f2]/60 hover:text-[#f2f3f5]"
            }`}
            title="Friends"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 100-8 4 4 0 000 8M8 12a4 4 0 100-8 4 4 0 000 8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 20a6 6 0 0112 0M14 20a6 6 0 018 0" />
            </svg>

            {incomingFriendRequestCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f23f43] px-1 text-[10px] font-bold text-white">
                {incomingFriendRequestCount > 99 ? "99+" : incomingFriendRequestCount}
              </span>
            )}

            {isActive && <span className="absolute -left-2 h-5 w-1 rounded-r-full bg-[#f2f3f5]" />}
          </motion.button>

          <div className="h-px w-8 bg-[#3a3d44]" />

          <div className="flex w-full min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pr-0.5">
            {railUsers.map((friend) => (
              <button
                key={friend.id}
                type="button"
                onClick={() => {
                  if (friend.isMe) {
                    closeFriendPanels();
                    router.push(DASHBOARD_ROUTES.workoutHistory);
                    return;
                  }

                  if (friendActionsOpen && activeFriend?.id === friend.id) {
                    closeFriendPanels();
                    return;
                  }

                  closeFriendPanels();
                  setActiveFriend({ id: friend.id, name: friend.name, username: "username" in friend ? friend.username : undefined });
                  setFriendActionsOpen(true);
                }}
                className="group w-full rounded-xl px-1.5 py-1 text-center border border-transparent bg-transparent"
                title={friend.isMe ? "Me" : friend.name}
                aria-label={friend.isMe ? "Open my train view" : `Open ${friend.name} actions`}
              >
                <span
                  className={`mx-auto flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full font-semibold text-[#f2f3f5] ${
                    friend.isMe ? "bg-[#5865f2] text-[11px]" : "bg-[#404249] text-[10px]"
                  }`}
                >
                  {friend.isMe ? "ME" : initials(friend.name)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {friendActionsOpen && activeFriend && (
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
              onClick={() => setFriendActionsOpen(false)}
            />

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
                <div className="h-full overflow-y-auto scrollbar-hide pb-[max(env(safe-area-inset-bottom,0px),12px)]">
                  <div className="sticky top-0 z-20" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                    <div className="px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            closeFriendPanels();
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
                    <div className="mx-1 mt-1 mb-2 rounded-2xl border border-[#3b3f48] bg-[#1e1f22] p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Friend Profile</p>
                          <p className="mt-0.5 truncate text-[13px] font-semibold text-[#f2f3f5]">{activeFriend.name}</p>
                          <p className="truncate text-[11px] text-[#dbdee1]">@{activeFriend.username || activeFriend.name.toLowerCase().replace(/\s+/g, "")}</p>
                          <p className="mt-1 truncate text-[10px] text-[#949ba4]">ID: {activeFriend.id || "-"}</p>
                        </div>

                        <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#5865f2]/40 bg-[#5865f2]/15 text-[#c8cdfa]">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
                          </svg>
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border"
                            style={{ backgroundColor: "#3ba55d", borderColor: "#1e1f22" }}
                          />
                        </span>
                      </div>
                    </div>

                    {[
                      { id: "history", label: "History", hint: "Open train history" },
                      { id: "chart", label: "Chart", hint: "Coming soon" },
                      { id: "checkin", label: "Check-in", hint: "Coming soon" },
                    ].map((item) => (
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
                          const params = new URLSearchParams({ targetUserId: activeFriend.id, friendView: item.id });
                          router.push(`${DASHBOARD_ROUTES.workoutHistory}?${params.toString()}`);
                          setFriendActionsOpen(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            const params = new URLSearchParams({ targetUserId: activeFriend.id, friendView: item.id });
                            router.push(`${DASHBOARD_ROUTES.workoutHistory}?${params.toString()}`);
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
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(DiscordFriendsRail);
