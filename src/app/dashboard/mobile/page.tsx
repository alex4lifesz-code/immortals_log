"use client";

import { useEffect, useMemo, useState } from "react";
import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import CultivationRealmBadge from "@/components/mobile/progress/CultivationRealmBadge";
import MobileProgressRing from "@/components/mobile/progress/MobileProgressRing";
import MobileSpeedDial from "@/components/mobile/actions/MobileSpeedDial";
import MobileLoadingSkeleton from "@/components/mobile/feedback/MobileLoadingSkeleton";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { MOBILE_DASHBOARD_ROUTES } from "@/lib/navigation";

function deriveStage(score: number): string {
  if (score >= 5000) return "Stage 7";
  if (score >= 2500) return "Stage 6";
  if (score >= 1200) return "Stage 5";
  if (score >= 600) return "Stage 4";
  if (score >= 250) return "Stage 3";
  if (score >= 80) return "Stage 2";
  return "Stage 1";
}

export default function MobileDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [checkinCount, setCheckinCount] = useState(0);
  const [exerciseCount, setExerciseCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [checkinsRes, progressionsRes] = await Promise.all([
          fetch("/api/checkins", { cache: "no-store", credentials: "include" }),
          fetch("/api/progressions", { cache: "no-store", credentials: "include" }),
        ]);

        const checkinsPayload = await checkinsRes.json().catch(() => ({}));
        const progressionsPayload = await progressionsRes.json().catch(() => ({}));

        const checkins = Array.isArray(checkinsPayload?.data) ? checkinsPayload.data : Array.isArray(checkinsPayload) ? checkinsPayload : [];
        const exercises = Array.isArray(progressionsPayload?.exercises) ? progressionsPayload.exercises : [];

        setCheckinCount(checkins.length);
        setExerciseCount(exercises.length);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user?.id]);

  const score = useMemo(() => checkinCount * 10 + exerciseCount * 25, [checkinCount, exerciseCount]);
  const stage = deriveStage(score);

  return (
    <div>
      <MobileHeader title="Cultivation Dashboard" />
      <section className="space-y-4 p-4">
        {loading ? (
          <MobileLoadingSkeleton />
        ) : (
          <>
            <MobileCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-mist-light">Current Stage</p>
                  <h2 className="mt-1 text-xl font-bold text-cloud-white">{stage}</h2>
                  <div className="mt-2">
                    <CultivationRealmBadge realm={stage} />
                  </div>
                </div>
                <MobileProgressRing progress={Math.min(100, (score % 500) / 5)} label="Progress" />
              </div>
            </MobileCard>

            <MobileCard>
              <h3 className="text-base font-semibold text-cloud-white">Today Summary</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-ink-dark p-3">
                  <p className="text-xs text-mist-light">Check-Ins</p>
                  <p className="mt-1 text-2xl font-bold text-cloud-white">{checkinCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-ink-dark p-3">
                  <p className="text-xs text-mist-light">Techniques</p>
                  <p className="mt-1 text-2xl font-bold text-cloud-white">{exerciseCount}</p>
                </div>
              </div>
            </MobileCard>
          </>
        )}
      </section>

      <MobileSpeedDial
        actions={[
          { id: "quick-log", label: "Quick log", onClick: () => router.push(MOBILE_DASHBOARD_ROUTES.checkIn) },
          { id: "start-training", label: "Start training", onClick: () => router.push(MOBILE_DASHBOARD_ROUTES.training) },
        ]}
      />
    </div>
  );
}
