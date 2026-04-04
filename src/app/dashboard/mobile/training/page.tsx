"use client";

import { useEffect, useState } from "react";
import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import MobileListItem from "@/components/mobile/lists/MobileListItem";
import MobileFAB from "@/components/mobile/actions/MobileFAB";
import ExerciseImageBox from "@/components/exercise/ExerciseImageBox";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/navigation";

interface ProgressionExercise {
  id: string;
  name: string;
  wuxiaName?: string;
  difficulty?: string;
}

export default function MobileTrainingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ProgressionExercise[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;
      const res = await fetch("/api/progressions", { cache: "no-store", credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      setItems(Array.isArray(payload?.exercises) ? payload.exercises : []);
    };
    void run();
  }, [user?.id]);

  return (
    <div>
      <MobileHeader title="Training Grounds" />
      <section className="space-y-3 p-4">
        <MobileCard>
          <h2 className="text-base font-semibold text-cloud-white">Technique List</h2>
          <p className="mt-1 text-sm text-mist-light">Swipe right to mark complete, swipe left for secondary actions.</p>
        </MobileCard>

        {items.map((item) => (
          <MobileListItem
            key={item.id}
            left={<ExerciseImageBox className="h-9 w-9" compact />}
            title={item.wuxiaName || item.name}
            subtitle={item.difficulty || "Technique"}
            onSwipeRight={() => {}}
            onSwipeLeft={() => {}}
          />
        ))}
      </section>
      <MobileFAB label="Start" icon="\u25b6" onClick={() => router.push(DASHBOARD_ROUTES.overview)} />
    </div>
  );
}
