"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowInput from "@/components/ui/GlowInput";
import { AreaChartCard, BarChartCard, LineChartCard, ScatterChartCard } from "@/components/analytics/ExerciseCharts";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";

interface Tier {
  tierId: string;
  level: number;
  name: string;
  wuxiaName: string;
  completed: boolean;
  completedAt: string | null;
  sessions: number;
  bestWeight: number;
  bestReps: number;
  bestHold: number;
  totalVolume: number;
  avgSessionScore: number;
  timeToMasteryDays: number | null;
  targetHold: number | null;
  targetReps: number;
}

interface SessionPoint {
  id: string;
  date: string;
  level: number;
  rawLevel: number;
  w1: number;
  r1: number;
  w2: number;
  r2: number;
  w3: number;
  r3: number;
  t1: number;
  t2: number;
  t3: number;
  bestWeight: number;
  totalReps: number;
  bestReps: number;
  totalHold: number;
  bestHold: number;
  volume: number;
  oneRmEstimate: number;
  intensityScore: number;
  modifier: string;
  variant: string;
  notes: string;
  completed: boolean;
}

interface RawLog {
  id: string;
  level: number;
  effectiveLevel?: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
}

interface Payload {
  exercise: { id: string; name: string; wuxiaName: string | null };
  progression: { currentLevel: number } | null;
  analytics: {
    sessions: SessionPoint[];
    tiers: Tier[];
    charts: {
      scoreSeries: Array<{ date: string; value: number }>;
      rolling7: Array<{ date: string; value: number }>;
      rolling14: Array<{ date: string; value: number }>;
      scatterFrequencyVsImprovement: Array<{ week: string; frequency: number; improvement: number }>;
    };
    raw: { logs: RawLog[] };
    predictions: {
      projectedNextTierDate: string;
      projectedTierDays: number;
      expectedVolumeForTierAdvancement: number;
    };
  };
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v <= value).length;
  return Math.round((below / values.length) * 100);
}

function getTierDisplayName(tier: Tier, mode: "fantasy" | "normal"): string {
  if (mode === "fantasy") {
    return tier.wuxiaName || tier.name || `Tier ${tier.level}`;
  }
  return tier.name || tier.wuxiaName || `Tier ${tier.level}`;
}

function getTopSet(log: RawLog | undefined): string {
  if (!log) return "-";
  const sets = [
    { weight: log.weight1, reps: log.reps1 },
    { weight: log.weight2, reps: log.reps2 },
    { weight: log.weight3, reps: log.reps3 },
  ].filter((set) => (set.weight ?? 0) > 0 || (set.reps ?? 0) > 0);

  if (sets.length === 0) return "-";

  sets.sort((a, b) => {
    const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
    if (weightDiff !== 0) return weightDiff;
    return (b.reps ?? 0) - (a.reps ?? 0);
  });

  const top = sets[0];
  if ((top.weight ?? 0) > 0 && (top.reps ?? 0) > 0) return `${top.weight}kg x ${top.reps}`;
  if ((top.weight ?? 0) > 0) return `${top.weight}kg`;
  return `${top.reps ?? 0} reps`;
}

export default function TierDetailPage() {
  const params = useParams<{ id: string; tierId: string }>();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();

  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        if (!user?.id) return;
        const res = await fetch(`/api/exercises/${encodeURIComponent(params.id)}/analytics?userId=${encodeURIComponent(user.id)}`);
        if (!res.ok) throw new Error("Failed to load tier analytics");
        const data = await res.json();
        setPayload(data as Payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tier analytics");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [params.id, user?.id]);

  const tier = useMemo(() => payload?.analytics.tiers.find((t) => t.tierId === params.tierId) || null, [payload, params.tierId]);

  const tierSessions = useMemo(() => {
    if (!payload || !tier) return [];
    const q = query.trim().toLowerCase();
    return payload.analytics.sessions
      .filter((s) => s.level === tier.level)
      .filter((s) => !q || [s.notes, s.modifier, s.variant, s.date].join(" ").toLowerCase().includes(q));
  }, [payload, tier, query]);

  const rawTierLogs = useMemo(() => {
    if (!payload || !tier) return [];
    return payload.analytics.raw.logs.filter((l) => (l.effectiveLevel ?? l.level) === tier.level);
  }, [payload, tier]);

  const tierScores = tierSessions.map((s) => s.intensityScore);
  const benchmark = useMemo(() => {
    if (!payload || !tier) return 0;
    const peer = payload.analytics.tiers.map((t) => t.avgSessionScore);
    return percentileRank(peer, tier.avgSessionScore);
  }, [payload, tier]);

  const deltas = useMemo(() => {
    const out: Array<{ id: string; repsDelta: number; holdDelta: number; volumeDelta: number }> = [];
    for (let i = 1; i < tierSessions.length; i += 1) {
      out.push({
        id: tierSessions[i].id,
        repsDelta: tierSessions[i].bestReps - tierSessions[i - 1].bestReps,
        holdDelta: tierSessions[i].bestHold - tierSessions[i - 1].bestHold,
        volumeDelta: tierSessions[i].volume - tierSessions[i - 1].volume,
      });
    }
    return out;
  }, [tierSessions]);

  const regressionSessions = deltas.filter((d) => d.repsDelta < 0 || d.holdDelta < 0 || d.volumeDelta < 0).length;
  const tierDisplayName = tier ? getTierDisplayName(tier, settings.terminologyMode) : "";

  const saveLog = async (log: RawLog) => {
    if (!user?.id) return;
    setSavingId(log.id);
    try {
      const res = await fetch("/api/progressions/logs/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          updates: [
            {
              id: log.id,
              level: log.level,
              weight1: log.weight1,
              reps1: log.reps1,
              weight2: log.weight2,
              reps2: log.reps2,
              weight3: log.weight3,
              reps3: log.reps3,
              holdTime: log.holdTime,
              holdTime2: log.holdTime2,
              holdTime3: log.holdTime3,
              modifier: log.modifier,
              variant: log.variant,
              notes: editNotes[log.id] ?? log.notes,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error("Unable to update log");
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          analytics: {
            ...prev.analytics,
            raw: {
              logs: prev.analytics.raw.logs.map((row) =>
                row.id === log.id ? { ...row, notes: editNotes[log.id] ?? row.notes } : row
              ),
            },
            sessions: prev.analytics.sessions.map((s) =>
              s.id === log.id ? { ...s, notes: editNotes[log.id] ?? s.notes } : s
            ),
          },
        };
      });
    } catch {
      setError("Failed to update log note");
    } finally {
      setSavingId(null);
    }
  };

  const deleteLog = async (logId: string) => {
    if (!user?.id) return;
    setSavingId(logId);
    try {
      const res = await fetch("/api/progressions/logs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, userId: user.id }),
      });
      if (!res.ok) throw new Error("Unable to delete log");
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          analytics: {
            ...prev.analytics,
            raw: {
              logs: prev.analytics.raw.logs.filter((l) => l.id !== logId),
            },
            sessions: prev.analytics.sessions.filter((s) => s.id !== logId),
          },
        };
      });
    } catch {
      setError("Failed to delete log");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <PageLayout
      title="Tier Detail"
      subtitle="Progression Deep Dive"
      sidebar={
        <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-3 text-sm">
          <div className="space-y-2">
            <Link href={`/dashboard/exercises/${params.id}`} className="block rounded border border-ink-light/20 px-3 py-2 text-mist-light hover:text-jade-light">Back To Exercise</Link>
            <Link href="/dashboard/exercises" className="block rounded border border-ink-light/20 px-3 py-2 text-mist-light hover:text-jade-light">Back To Atlas</Link>
          </div>
        </GlowCard>
      }
      sidebarLabel="Tier"
    >
      <div className="space-y-4">
        {loading && <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-8 text-center text-mist-dark">Loading tier analytics...</div>}
        {!loading && error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        {!loading && payload && tier && (
          <>
            <GlowCard glow="none" className="border border-gold/25 bg-[linear-gradient(170deg,rgba(22,27,27,0.9),rgba(17,15,14,0.88))] p-4">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-gold/80">Tier Intelligence</div>
                <h1 className="text-2xl font-semibold text-cloud-white">Tier {tier.level}: {tierDisplayName}</h1>
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                  <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Sessions Logged: {tier.sessions}</div>
                  <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Benchmark Percentile: {benchmark}th</div>
                  <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Time To Mastery: {tier.timeToMasteryDays != null ? `${tier.timeToMasteryDays} days` : "in progress"}</div>
                  <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Best Weight: {tier.bestWeight > 0 ? `${tier.bestWeight}kg` : "-"}</div>
                  <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Best Reps: {tier.bestReps || "-"}</div>
                  <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Best Hold: {tier.bestHold ? `${tier.bestHold}s` : "-"}</div>
                  <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Total Volume: {tier.totalVolume.toFixed(1)}</div>
                </div>
              </div>
            </GlowCard>

            <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Tier Predictions</div>
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Projected next tier unlock: {new Date(payload.analytics.predictions.projectedNextTierDate).toLocaleDateString()}</div>
                <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Expected days remaining: {payload.analytics.predictions.projectedTierDays}</div>
                <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">Expected volume threshold: {payload.analytics.predictions.expectedVolumeForTierAdvancement}</div>
              </div>
            </GlowCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <LineChartCard title="Tier Session Score Curve" points={tierSessions.map((s) => ({ label: s.date, value: s.intensityScore }))} />
              <AreaChartCard title="Tier Volume Accumulation" points={tierSessions.map((s) => ({ label: s.date, value: s.volume }))} />
              <BarChartCard title="Session-to-Session Reps" points={tierSessions.map((s) => ({ label: s.date, value: s.bestReps }))} />
              <ScatterChartCard
                title="Delta Correlation"
                points={deltas.map((d) => ({ x: d.repsDelta, y: d.holdDelta, label: d.id }))}
              />
            </div>

            <GlowCard glow="none" className="border border-gold/25 bg-ink-dark/50 p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Tier Analysis Narrative</div>
              <div className="space-y-1 text-sm text-mist-light">
                <div>Failure / regression sessions: {regressionSessions} of {Math.max(1, deltas.length)} transitions.</div>
                <div>Fatigue indicator proxy: {tierScores.length > 0 ? `${Math.round((tierScores.filter((s) => s < (tier.avgSessionScore * 0.9)).length / tierScores.length) * 100)}% sub-baseline sessions` : "No data"}.</div>
                <div>Suggested structure: prioritize {tier.targetReps > 0 ? `sets targeting ${tier.targetReps} reps` : "high-quality repetition sets"} and {tier.targetHold ? `${tier.targetHold}s holds` : "controlled hold exposure"} with 2-3 minute recovery.</div>
                <div>Advancement criteria reminder: surpass target metrics across at least 2-3 consecutive sessions with stable or improving score trend.</div>
              </div>
            </GlowCard>

            <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div className="text-xs uppercase tracking-[0.18em] text-gold/80">Tier Session Logs (Inline Editable Notes)</div>
                <div className="w-full md:w-72">
                  <GlowInput label="Search tier logs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="note, modifier, date" />
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-ink-light/20">
                <table className="w-full text-sm">
                  <thead className="bg-ink-dark/80 text-mist-light">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Top Set</th>
                      <th className="p-2 text-left">W1</th>
                      <th className="p-2 text-left">R1</th>
                      <th className="p-2 text-left">W2</th>
                      <th className="p-2 text-left">R2</th>
                      <th className="p-2 text-left">W3</th>
                      <th className="p-2 text-left">R3</th>
                      <th className="p-2 text-left">T1</th>
                      <th className="p-2 text-left">T2</th>
                      <th className="p-2 text-left">T3</th>
                      <th className="p-2 text-left">Best Weight</th>
                      <th className="p-2 text-left">Best Reps</th>
                      <th className="p-2 text-left">Best Hold</th>
                      <th className="p-2 text-left">Volume</th>
                      <th className="p-2 text-left">Modifier</th>
                      <th className="p-2 text-left">Variant</th>
                      <th className="p-2 text-left">Notes</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierSessions.map((session) => {
                      const log = rawTierLogs.find((x) => x.id === session.id);
                      return (
                        <tr key={session.id} className="border-t border-ink-light/15 text-mist-light">
                          <td className="p-2">{new Date(session.date).toLocaleDateString()}</td>
                          <td className="p-2">{getTopSet(log)}</td>
                          <td className="p-2">{session.w1 || "-"}</td>
                          <td className="p-2">{session.r1 || "-"}</td>
                          <td className="p-2">{session.w2 || "-"}</td>
                          <td className="p-2">{session.r2 || "-"}</td>
                          <td className="p-2">{session.w3 || "-"}</td>
                          <td className="p-2">{session.r3 || "-"}</td>
                          <td className="p-2">{session.t1 ? `${session.t1}s` : "-"}</td>
                          <td className="p-2">{session.t2 ? `${session.t2}s` : "-"}</td>
                          <td className="p-2">{session.t3 ? `${session.t3}s` : "-"}</td>
                          <td className="p-2">{session.bestWeight > 0 ? `${session.bestWeight}kg` : "-"}</td>
                          <td className="p-2">{session.bestReps || "-"}</td>
                          <td className="p-2">{session.bestHold ? `${session.bestHold}s` : "-"}</td>
                          <td className="p-2">{session.volume.toFixed(1)}</td>
                          <td className="p-2">{session.modifier}</td>
                          <td className="p-2">{session.variant}</td>
                          <td className="p-2">
                            <input
                              className="w-full rounded border border-ink-light/30 bg-ink-dark/60 px-2 py-1 text-xs text-mist-light"
                              value={editNotes[session.id] ?? session.notes ?? ""}
                              onChange={(e) => setEditNotes((prev) => ({ ...prev, [session.id]: e.target.value }))}
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <button
                                className="rounded border border-jade/30 px-2 py-1 text-xs text-jade-light"
                                disabled={!log || savingId === session.id}
                                onClick={() => log && saveLog(log)}
                              >
                                Save
                              </button>
                              <button
                                className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300"
                                disabled={savingId === session.id}
                                onClick={() => deleteLog(session.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          </>
        )}
      </div>
    </PageLayout>
  );
}
