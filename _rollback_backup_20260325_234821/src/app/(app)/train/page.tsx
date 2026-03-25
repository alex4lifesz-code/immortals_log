"use client";

import { useEffect, useMemo, useState } from "react";

const tabs = ["Strength", "Cardio", "Yoga"] as const;

type ExerciseItem = {
  id: string;
  name: string;
  difficulty: string;
  type: string;
  targetGroup: string | null;
};

function getTabForExercise(exercise: ExerciseItem): (typeof tabs)[number] {
  const haystack = `${exercise.type} ${exercise.targetGroup ?? ""}`.toLowerCase();
  if (haystack.includes("cardio")) return "Cardio";
  if (haystack.includes("yoga") || haystack.includes("mobility") || haystack.includes("stretch")) return "Yoga";
  return "Strength";
}

export default function TrainPage() {
  const [active, setActive] = useState<(typeof tabs)[number]>("Strength");
  const [items, setItems] = useState<ExerciseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExercises() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/exercises", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to load exercises (${response.status})`);
        }

        const data = (await response.json()) as { items?: ExerciseItem[] };
        if (!isMounted) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Unable to load exercises.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadExercises();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = useMemo(
    () => items.filter((item) => getTabForExercise(item) === active),
    [active, items],
  );

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-pure-white">Train</h1>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-ink-light bg-ink-deep/70 p-3">
          <p className="px-2 pb-2 text-xs uppercase tracking-wider text-mist-light">Workout Sidebar</p>

          <div className="mb-3 flex gap-1 rounded-xl border border-ink-light bg-ink-dark/60 p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActive(tab)}
                className={`flex-1 rounded-lg px-2 py-2 text-[11px] uppercase tracking-wider ${
                  active === tab ? "bg-gold-dim/20 text-gold-glow" : "text-mist-light hover:text-cloud-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="sidebar-scroll max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {isLoading && <p className="px-2 py-2 text-xs text-mist-light">Loading exercises...</p>}

            {!isLoading && error && (
              <p className="px-2 py-2 text-xs text-red-300">{error}</p>
            )}

            {!isLoading && !error && filteredItems.length === 0 && (
              <p className="px-2 py-2 text-xs text-mist-light">No exercises found for {active}.</p>
            )}

            {!isLoading && !error && filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-ink-light bg-ink-dark/60 px-3 py-2"
              >
                <p className="text-sm text-cloud-white">{item.name}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-mist-light">
                  {item.difficulty}
                  {item.targetGroup ? ` • ${item.targetGroup}` : ""}
                </p>
              </div>
            ))}
          </div>
        </aside>

        <div className="rounded-2xl border border-gold-dim/40 bg-ink-deep/70 p-4 text-sm text-mist-light">
          <p className="text-cloud-white">{active} Module</p>
          <p className="mt-2">
            {active === "Strength" && "Workout execution, plans, set logging, timer, and progression support."}
            {active === "Cardio" && "Session timer, distance and pace logging, templates, and cardio goals."}
            {active === "Yoga" && "Flow player, pose sequencing, hold timers, and custom flow builder."}
          </p>
        </div>
      </div>
    </section>
  );
}
