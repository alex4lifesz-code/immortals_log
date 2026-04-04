"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";

export default function WorkoutHistoryMobileInputPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const userId = user?.id ?? "";

  const prefillExerciseId = searchParams.get("prefillExerciseId");
  const prefillExerciseName = searchParams.get("prefillExercise");
  const prefillProgression = searchParams.get("prefillProgression");
  const prefillVariant = searchParams.get("prefillVariant");

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);

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
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions/history?logLimit=200");
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to load history input page:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void fetchExercises();
  }, [fetchExercises]);

  return (
    <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden p-2 pb-24">
      <div className="min-w-0 nyaa-history-page space-y-2 px-0 py-2 sm:py-3">
        {loading ? (
          <div
            className="rounded-lg border p-6 text-center text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
          >
            Loading input...
          </div>
        ) : (
          <div className="nyaa-history-table-shell min-w-0">
            <MemoTrainingLogTable
              exercises={exercises}
              physique={physique}
              onRefresh={fetchExercises}
              userId={userId}
              prefillExerciseId={prefillExerciseId}
              prefillExerciseName={prefillExerciseName}
              prefillProgression={prefillProgression}
              prefillVariant={prefillVariant}
              forceMobileInputOpen
            />
          </div>
        )}
      </div>
    </div>
  );
}
