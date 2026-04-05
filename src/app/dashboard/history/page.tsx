"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise } from "../workout/types";

export default function HistoryPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const didApplyInitialUserScopeRef = useRef(false);

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const [visibleUsers, setVisibleUsers] = useState<Array<{ id: string; name: string; username: string }>>([]);

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

  return (
    <PageLayout
      title="Train"
      subtitle={subtitle}
      mobileContentPaddingClass="p-2 pb-2"
    >
      <div className="nyaa-history-page min-h-0 space-y-2 px-0 py-2 sm:py-3">
        {loading ? (
          <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
            Loading history...
          </div>
        ) : (
          <>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="history-user-scope" className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  View user
                </label>
                <select
                  id="history-user-scope"
                  value={activeUserId || userId}
                  onChange={(event) => handleUserScopeChange(event.target.value)}
                  className="rounded border px-2 py-1 text-xs outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
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
            </div>

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
    </PageLayout>
  );
}
