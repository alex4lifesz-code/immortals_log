"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise, LogTableFilter } from "../workout/types";

export default function HistoryPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const [selectedLogFilter, setSelectedLogFilter] = useState<LogTableFilter | null>(null);

  const userId = user?.id ?? "";

  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }
    setPhysique(loadUserPhysique(userId));
  }, [userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions");
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    const exerciseId = searchParams.get("exerciseId");
    if (!exerciseId) {
      setSelectedLogFilter(null);
      return;
    }

    const levelParam = searchParams.get("level");
    const parsedLevel = levelParam ? Number.parseInt(levelParam, 10) : null;
    setSelectedLogFilter({
      exerciseId,
      levelNameLevel: Number.isFinite(parsedLevel as number) ? parsedLevel : null,
    });
  }, [searchParams]);

  const subtitle = useMemo(() => {
    if (!selectedLogFilter) return "Review your training logs and cultivation entries";
    return "Filtered to selected exercise history";
  }, [selectedLogFilter]);

  return (
    <PageLayout
      title="History"
      subtitle={subtitle}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:py-3">
        {loading ? (
          <div className="rounded-xl border border-ink-light/40 p-6 text-center text-sm text-mist-dark" style={{ background: "var(--surface-gradient-strong)" }}>
            Loading history...
          </div>
        ) : (
          <MemoTrainingLogTable
            exercises={exercises}
            physique={physique}
            selectedLogFilter={selectedLogFilter}
            onSelectExercise={setSelectedLogFilter}
            onRefresh={fetchExercises}
            userId={userId}
          />
        )}
      </div>
    </PageLayout>
  );
}
