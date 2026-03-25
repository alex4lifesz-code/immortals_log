"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProfileSetupPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || "");
  const [unitPreference, setUnitPreference] = useState("metric");
  const [trainingExperience, setTrainingExperience] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, unitPreference, trainingExperience }),
    });
    await refreshUser();
    router.push("/home");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-void-black p-4 text-cloud-white">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-gold-dim/40 bg-ink-deep/75 p-5">
        <h1 className="text-2xl font-semibold">Profile Setup</h1>

        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none" />

        <select value={unitPreference} onChange={(e) => setUnitPreference(e.target.value)} className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none">
          <option value="metric">Metric (kg, km)</option>
          <option value="imperial">Imperial (lbs, miles)</option>
        </select>

        <select value={trainingExperience} onChange={(e) => setTrainingExperience(e.target.value)} className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none">
          <option value="">Training experience (optional)</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/home")} className="flex-1 rounded-lg border border-ink-light px-4 py-2 text-xs uppercase tracking-wider text-mist-light">
            Skip
          </button>
          <button disabled={saving} className="flex-1 rounded-lg border border-gold/50 bg-gold-dim/20 px-4 py-2 text-xs uppercase tracking-wider text-gold-glow">
            {saving ? "Saving..." : "Finish"}
          </button>
        </div>
      </form>
    </main>
  );
}
