"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard, { GlowModal } from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useIsMobile } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise } from "../workout/types";

export default function HistoryPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const didApplyInitialUserScopeRef = useRef(false);

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const [visibleUsers, setVisibleUsers] = useState<Array<{ id: string; name: string; username: string }>>([]);
  const [mobileUserPickerOpen, setMobileUserPickerOpen] = useState(false);

  const userId = user?.id ?? "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const activeUserId = targetUserId || userId;
  const prefillExerciseId = searchParams.get("prefillExerciseId");
  const prefillExerciseName = searchParams.get("prefillExercise");
  const prefillProgression = searchParams.get("prefillProgression");
  const prefillVariant = searchParams.get("prefillVariant");

  useEffect(() => {
    if (!userId || didApplyInitialUserScopeRef.current) return;

    didApplyInitialUserScopeRef.current = true;

    if (!targetUserId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("targetUserId");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, targetUserId, userId]);

  useEffect(() => {
    const hasPrefill = Boolean(prefillExerciseId || prefillExerciseName || prefillProgression || prefillVariant);
    if (!hasPrefill) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("prefillExerciseId");
    params.delete("prefillExercise");
    params.delete("prefillProgression");
    params.delete("prefillVariant");

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, prefillExerciseId, prefillExerciseName, prefillProgression, prefillVariant, router, searchParams]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadUsers = async () => {
      try {
        const data = await api.get<{ users: Array<{ id: string; name: string; username: string }> }>("/api/users/public?scope=community");
        if (!cancelled) {
          setVisibleUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) {
          setVisibleUsers([]);
        }
      }
    };
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }
    setPhysique(loadUserPhysique(activeUserId || userId));
  }, [activeUserId, userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({ logLimit: "200" });
      if (targetUserId) params.set("targetUserId", targetUserId);
      const data = await api.get<{ exercises: ProgressionExercise[] }>(`/api/progressions/history?${params.toString()}`);
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, userId]);

  useEffect(() => {
    setLoading(true);
    void fetchExercises();
  }, [fetchExercises]);

  const subtitle = "Review your training logs and cultivation entries";

  const orderedVisibleUsers = useMemo(() => {
    if (!userId) return visibleUsers;

    const selfEntry = visibleUsers.find((u) => u.id === userId) ?? {
      id: userId,
      name: user?.name || "Me",
      username: user?.username || "",
    };
    const others = visibleUsers.filter((u) => u.id !== userId);
    return [selfEntry, ...others];
  }, [user?.name, user?.username, userId, visibleUsers]);

  const targetUserDisplayName = useMemo(() => {
    if (!targetUserId) return undefined;
    const target = orderedVisibleUsers.find((u) => u.id === targetUserId);
    if (!target) return undefined;
    return (target.name || target.username || "").trim() || undefined;
  }, [orderedVisibleUsers, targetUserId]);

  const activeUserLabel = useMemo(() => {
    const activeUser = orderedVisibleUsers.find((u) => u.id === activeUserId || (!activeUserId && u.id === userId));
    if (activeUser) return activeUser.name || activeUser.username || "Me";
    return user?.name || user?.username || "Me";
  }, [activeUserId, orderedVisibleUsers, user?.name, user?.username, userId]);

  const handleUserScopeChange = (nextUserId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextUserId || nextUserId === userId) {
      params.delete("targetUserId");
    } else {
      params.set("targetUserId", nextUserId);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  useEffect(() => {
    setMobileUserPickerOpen(false);
  }, [activeUserId]);

  return (
    <PageLayout
      title="Train"
      subtitle={subtitle}
      mobileContentPaddingClass="p-2 pb-2"
    >
      <div className="nyaa-history-page space-y-4 px-0">
        {loading ? (
          <GlowCard glow="jade" hoverable={false}>
            <p className="text-sm text-mist-dark text-center py-4">Loading history...</p>
          </GlowCard>
        ) : (
          <>
            <section
              className="w-full rounded-2xl relative overflow-hidden"
              style={{
                border: "1px solid color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                background: "linear-gradient(160deg, color-mix(in srgb, var(--ink-deep) 96%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 90%, transparent) 100%)",
                boxShadow: "0 0 0 1px color-mix(in srgb, var(--jade-glow) 10%, transparent), var(--shadow-elev-1)",
              }}
            >
              <div
                className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 border-b"
                style={{
                  borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                  backgroundColor: "color-mix(in srgb, var(--jade-glow) 9%, var(--ink-dark))",
                }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.09em] shrink-0"
                  style={{ color: "var(--jade-light)" }}
                >
                  Friends Scope
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const href = targetUserId
                      ? `${DASHBOARD_ROUTES.trainingLogHistory}?targetUserId=${encodeURIComponent(targetUserId)}`
                      : DASHBOARD_ROUTES.trainingLogHistory;
                    router.push(href);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    color: "var(--cloud-white)",
                    borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                  }}
                >
                  <span>Open history page</span>
                  <span aria-hidden="true" className="text-[13px] leading-none">↗</span>
                </button>
              </div>

              <div className="px-3 py-3">
                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setMobileUserPickerOpen(true)}
                    className="inline-flex min-w-[210px] items-center justify-between rounded-md border px-3 py-2.5 text-[15px] font-medium"
                    style={{
                      borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                      color: "var(--cloud-white)",
                    }}
                    aria-label="Pick friend"
                  >
                    <span className="truncate">{activeUserLabel}</span>
                    <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>▾</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--jade-light)" }}>
                      View friends
                    </label>
                    <select
                      value={activeUserId || userId}
                      onChange={(event) => handleUserScopeChange(event.target.value)}
                      className="min-w-[240px] rounded-md border px-3 py-2 text-[15px] font-medium outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                      }}
                    >
                      {orderedVisibleUsers.length === 0 ? (
                        <option value={userId}>{user?.name || "Me"}</option>
                      ) : (
                        orderedVisibleUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.id === userId ? `* ${u.name || u.username}` : (u.name || u.username)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
              </div>
            </section>

            <div className="nyaa-history-table-shell">
              <MemoTrainingLogTable
                exercises={exercises}
                physique={physique}
                onRefresh={fetchExercises}
                userId={userId}
                historyTargetUserId={targetUserId || undefined}
                historyTargetUserName={targetUserDisplayName}
                prefillExerciseId={prefillExerciseId}
                prefillExerciseName={prefillExerciseName}
                prefillProgression={prefillProgression}
                prefillVariant={prefillVariant}
              />
            </div>
          </>
        )}
      </div>
      <GlowModal
        isOpen={isMobile && mobileUserPickerOpen}
        onClose={() => setMobileUserPickerOpen(false)}
        title="View friends"
        contentClassName="!p-0"
      >
        <div className="relative px-3 pb-3 pt-2">
          <div
            className="pointer-events-none absolute left-3 right-3 top-1/2 h-11 -translate-y-1/2 border border-jade-glow/40 bg-jade-glow/10 rounded-lg"
          />
          <div
            className="h-56 overflow-y-auto snap-y snap-mandatory"
            style={{ paddingTop: "90px", paddingBottom: "90px", scrollbarWidth: "none" }}
          >
            {(orderedVisibleUsers.length === 0
              ? [{ id: userId, name: user?.name || "Me", username: user?.username || "" }]
              : orderedVisibleUsers
            ).map((u) => {
              const isActive = u.id === (activeUserId || userId);
              const displayName = u.name || u.username || "Unknown";
              return (
                <button
                  key={`mobile-user-option-${u.id}`}
                  type="button"
                  onClick={() => {
                    handleUserScopeChange(u.id);
                    setMobileUserPickerOpen(false);
                  }}
                  className={`flex h-11 w-full snap-center items-center justify-center text-sm rounded-lg transition-colors ${isActive ? "text-cloud-white font-bold bg-jade-glow/10" : "text-mist-dark font-medium hover:text-cloud-white hover:bg-ink-mid"}`}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        </div>
      </GlowModal>
    </PageLayout>
  );
}
