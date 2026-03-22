export interface AnalyticsLog {
  id: string;
  level: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  reps: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
  completed: boolean;
  createdAt: string;
}

export interface ProgressionTierLite {
  id: string;
  level: number;
  name: string;
  wuxiaName: string;
  description: string;
  targetHold: number | null;
  targetReps: number | null;
  targetRepsText: string;
}

export interface ExerciseAnalyticsInput {
  logs: AnalyticsLog[];
  tiers: ProgressionTierLite[];
  currentLevel: number;
  now?: Date;
}

export interface SessionPoint {
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

interface RegressionResult {
  slope: number;
  intercept: number;
}

interface BreakdownRow {
  label: string;
  sessions: number;
  totalVolume: number;
  totalReps: number;
  totalHold: number;
  bestWeight: number;
  bestReps: number;
  bestHold: number;
  avgIntensity: number;
}

const DISPLAY_LEVEL_TOKEN = /^RBL:\s*(\d+)$/i;

function num(v: number | null | undefined): number {
  return Number.isFinite(v as number) ? Number(v) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = average(values);
  const variance = average(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

function linearRegression(xs: number[], ys: number[]): RegressionResult {
  if (xs.length === 0 || ys.length === 0 || xs.length !== ys.length) {
    return { slope: 0, intercept: 0 };
  }
  if (xs.length === 1) {
    return { slope: 0, intercept: ys[0] };
  }

  const xMean = average(xs);
  const yMean = average(ys);
  let nume = 0;
  let deno = 0;
  for (let i = 0; i < xs.length; i += 1) {
    nume += (xs[i] - xMean) * (ys[i] - yMean);
    deno += (xs[i] - xMean) ** 2;
  }
  if (deno === 0) return { slope: 0, intercept: yMean };
  const slope = nume / deno;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function bestReps(log: AnalyticsLog): number {
  return Math.max(num(log.reps), num(log.reps1), num(log.reps2), num(log.reps3));
}

function totalReps(log: AnalyticsLog): number {
  return num(log.reps) + num(log.reps1) + num(log.reps2) + num(log.reps3);
}

function holdValues(log: AnalyticsLog): number[] {
  return [num(log.holdTime), num(log.holdTime2), num(log.holdTime3)].filter((v) => v > 0);
}

function totalHold(log: AnalyticsLog): number {
  return holdValues(log).reduce((sum, v) => sum + v, 0);
}

function bestHold(log: AnalyticsLog): number {
  return Math.max(num(log.holdTime), num(log.holdTime2), num(log.holdTime3));
}

function volume(log: AnalyticsLog): number {
  const pairs: Array<[number, number]> = [
    [num(log.weight1), num(log.reps1)],
    [num(log.weight2), num(log.reps2)],
    [num(log.weight3), num(log.reps3)],
  ];
  return pairs.reduce((sum, [w, r]) => sum + w * r, 0);
}

function bestWeight(log: AnalyticsLog): number {
  return Math.max(num(log.weight1), num(log.weight2), num(log.weight3));
}

function oneRmFromPair(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

function oneRmEstimate(log: AnalyticsLog): number {
  const candidates = [
    oneRmFromPair(num(log.weight1), num(log.reps1)),
    oneRmFromPair(num(log.weight2), num(log.reps2)),
    oneRmFromPair(num(log.weight3), num(log.reps3)),
  ];
  return Math.max(...candidates, 0);
}

function parseTargetReps(tier: ProgressionTierLite | undefined): number {
  if (!tier) return 0;
  if (tier.targetReps && tier.targetReps > 0) return tier.targetReps;
  const match = tier.targetRepsText?.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rollingAverage(points: SessionPoint[], windowDays: number): Array<{ date: string; value: number }> {
  return points.map((p) => {
    const end = new Date(p.date);
    const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const inWindow = points.filter((q) => {
      const dt = new Date(q.date);
      return dt >= start && dt <= end;
    });
    return { date: p.date, value: average(inWindow.map((x) => x.intensityScore)) };
  });
}

function longestStreakByDay(points: SessionPoint[]): number {
  if (points.length === 0) return 0;
  const uniqueDays = Array.from(new Set(points.map((p) => p.date.slice(0, 10)))).sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diff = daysBetween(prev, curr);
    if (diff <= 1.01) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

function improvementPct(values: Array<{ date: string; value: number }>, periodDays: number, now: Date): number {
  const curStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const prevStart = new Date(now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000);
  const current = values.filter((v) => new Date(v.date) >= curStart).map((v) => v.value);
  const previous = values
    .filter((v) => {
      const d = new Date(v.date);
      return d >= prevStart && d < curStart;
    })
    .map((v) => v.value);
  const currAvg = average(current);
  const prevAvg = average(previous);
  if (prevAvg <= 0) return currAvg > 0 ? 100 : 0;
  return ((currAvg - prevAvg) / prevAvg) * 100;
}

function dayIndex(base: Date, date: string): number {
  return (new Date(date).getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
}

function effectiveLevel(log: AnalyticsLog): number {
  const parts = (log.modifier || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const match = part.match(DISPLAY_LEVEL_TOKEN);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return Math.max(1, Math.floor(num(log.level) || 1));
}

function aggregateBreakdown(rows: SessionPoint[], key: (s: SessionPoint) => string): BreakdownRow[] {
  const acc = new Map<string, BreakdownRow>();
  rows.forEach((row) => {
    const label = key(row) || "unspecified";
    const existing = acc.get(label) || {
      label,
      sessions: 0,
      totalVolume: 0,
      totalReps: 0,
      totalHold: 0,
      bestWeight: 0,
      bestReps: 0,
      bestHold: 0,
      avgIntensity: 0,
    };
    existing.sessions += 1;
    existing.totalVolume += row.volume;
    existing.totalReps += row.totalReps;
    existing.totalHold += row.totalHold;
    existing.bestWeight = Math.max(existing.bestWeight, row.bestWeight);
    existing.bestReps = Math.max(existing.bestReps, row.bestReps);
    existing.bestHold = Math.max(existing.bestHold, row.bestHold);
    existing.avgIntensity += row.intensityScore;
    acc.set(label, existing);
  });

  return Array.from(acc.values())
    .map((row) => ({
      ...row,
      totalVolume: Number(row.totalVolume.toFixed(2)),
      avgIntensity: Number((row.sessions > 0 ? row.avgIntensity / row.sessions : 0).toFixed(2)),
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function buildExerciseAnalytics(input: ExerciseAnalyticsInput) {
  const now = input.now ?? new Date();
  const tiers = [...input.tiers].sort((a, b) => a.level - b.level);
  const logs = [...input.logs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const sessions: SessionPoint[] = logs.map((log) => {
    const level = effectiveLevel(log);
    const repsTotal = totalReps(log);
    const holdTotal = totalHold(log);
    const vol = volume(log);
    const score = repsTotal * 1.4 + holdTotal * 0.8 + vol * 0.02 + level * 10;
    return {
      id: log.id,
      date: new Date(log.createdAt).toISOString(),
      level,
      rawLevel: log.level,
      w1: num(log.weight1),
      r1: num(log.reps1),
      w2: num(log.weight2),
      r2: num(log.reps2),
      w3: num(log.weight3),
      r3: num(log.reps3),
      t1: num(log.holdTime),
      t2: num(log.holdTime2),
      t3: num(log.holdTime3),
      bestWeight: bestWeight(log),
      totalReps: repsTotal,
      bestReps: bestReps(log),
      totalHold: holdTotal,
      bestHold: bestHold(log),
      volume: vol,
      oneRmEstimate: oneRmEstimate(log),
      intensityScore: Number(score.toFixed(2)),
      modifier: log.modifier || "bodyweight",
      variant: log.variant || "default",
      notes: log.notes || "",
      completed: log.completed,
    };
  });

  const firstDate = sessions[0]?.date ? new Date(sessions[0].date) : now;
  const activeDays = Math.max(1, Math.ceil(daysBetween(firstDate, now)));
  const activeWeeks = Math.max(1, activeDays / 7);

  const totalVolume = sessions.reduce((sum, s) => sum + s.volume, 0);
  const totalTut = sessions.reduce((sum, s) => sum + s.totalHold, 0);
  const totalRepsAll = sessions.reduce((sum, s) => sum + s.totalReps, 0);
  const totalSessions = sessions.length;

  const repsSeries = sessions.map((s) => ({ date: s.date, value: s.bestReps }));
  const holdSeries = sessions.map((s) => ({ date: s.date, value: s.bestHold }));
  const volumeSeries = sessions.map((s) => ({ date: s.date, value: s.volume }));
  const scoreSeries = sessions.map((s) => ({ date: s.date, value: s.intensityScore }));

  const bestSession = sessions.reduce<SessionPoint | null>((best, s) => {
    if (!best || s.intensityScore > best.intensityScore) return s;
    return best;
  }, null);

  const consistencyCv = average(scoreSeries.map((s) => s.value)) > 0
    ? stdDev(scoreSeries.map((s) => s.value)) / average(scoreSeries.map((s) => s.value))
    : 1;
  const consistencyScore = Math.max(0, Math.min(100, Math.round((1 - consistencyCv) * 100)));

  const uniqueDays = new Set(sessions.map((s) => s.date.slice(0, 10))).size;

  const completionEvents = sessions
    .filter((s) => s.completed)
    .map((s) => ({ level: s.level, date: s.date }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const tierCompletionDates = new Map<number, string>();
  completionEvents.forEach((evt) => {
    if (!tierCompletionDates.has(evt.level)) tierCompletionDates.set(evt.level, evt.date);
  });

  const advancementIntervals: number[] = [];
  for (let i = 1; i < completionEvents.length; i += 1) {
    advancementIntervals.push(daysBetween(new Date(completionEvents[i - 1].date), new Date(completionEvents[i].date)));
  }

  const avgAdvancementDays = average(advancementIntervals) || 21;
  const nextTier = tiers.find((t) => t.level >= input.currentLevel);

  const base = sessions[0] ? new Date(sessions[0].date) : now;
  const xs = sessions.map((s) => dayIndex(base, s.date));
  const repsReg = linearRegression(xs, sessions.map((s) => s.bestReps));
  const holdReg = linearRegression(xs, sessions.map((s) => s.bestHold));
  const volumeReg = linearRegression(xs, sessions.map((s) => s.volume));

  const projectedNextSessionReps = Math.max(0, Math.round((sessions.at(-1)?.bestReps || 0) + repsReg.slope * 3));
  const projectedNextSessionHold = Math.max(0, Math.round((sessions.at(-1)?.bestHold || 0) + holdReg.slope * 3));

  const targetReps = parseTargetReps(nextTier);
  const targetHold = nextTier?.targetHold || 0;
  const bestRepsOverall = Math.max(...sessions.map((s) => s.bestReps), 0);
  const bestHoldOverall = Math.max(...sessions.map((s) => s.bestHold), 0);

  const repsSlope = Math.max(0.01, repsReg.slope);
  const holdSlope = Math.max(0.01, holdReg.slope);

  const daysToTargetReps = targetReps > bestRepsOverall ? (targetReps - bestRepsOverall) / repsSlope : 0;
  const daysToTargetHold = targetHold > bestHoldOverall ? (targetHold - bestHoldOverall) / holdSlope : 0;
  const projectedTierDays = Math.ceil(Math.max(daysToTargetReps, daysToTargetHold, avgAdvancementDays * 0.35));
  const projectedTierDate = new Date(now.getTime() + projectedTierDays * 24 * 60 * 60 * 1000);

  const lastPbDate = sessions
    .filter((s, idx) => {
      const prevMax = Math.max(...sessions.slice(0, idx).map((x) => x.intensityScore), 0);
      return s.intensityScore >= prevMax;
    })
    .at(-1)?.date;
  const daysSincePb = lastPbDate ? daysBetween(new Date(lastPbDate), now) : 999;
  const plateauDetected = sessions.length >= 8 && daysSincePb >= 21 && repsReg.slope < 0.03 && holdReg.slope < 0.05;

  const weeklyBuckets = new Map<string, { sessions: number; avgScore: number[]; improvement: number[] }>();
  for (let i = 0; i < sessions.length; i += 1) {
    const s = sessions[i];
    const d = new Date(s.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = formatDay(weekStart);
    const bucket = weeklyBuckets.get(key) || { sessions: 0, avgScore: [], improvement: [] };
    bucket.sessions += 1;
    bucket.avgScore.push(s.intensityScore);
    if (i > 0) bucket.improvement.push(s.intensityScore - sessions[i - 1].intensityScore);
    weeklyBuckets.set(key, bucket);
  }

  const freqPerf: Record<number, number[]> = {};
  Array.from(weeklyBuckets.values()).forEach((b) => {
    const count = b.sessions;
    if (!freqPerf[count]) freqPerf[count] = [];
    freqPerf[count].push(average(b.improvement));
  });
  const bestFreqEntry = Object.entries(freqPerf)
    .map(([k, vals]) => ({ sessions: Number(k), gain: average(vals) }))
    .sort((a, b) => b.gain - a.gain)[0];

  const restHours: number[] = [];
  for (let i = 1; i < sessions.length; i += 1) {
    restHours.push((new Date(sessions[i].date).getTime() - new Date(sessions[i - 1].date).getTime()) / (1000 * 60 * 60));
  }
  const inferredRecoveryHours = median(restHours) || 48;

  const fatigueScore = Math.max(0, Math.min(100,
    Math.round(
      40 +
      (average(scoreSeries.slice(-7).map((s) => s.value)) - average(scoreSeries.slice(-21, -7).map((s) => s.value))) * -0.7 +
      (activeWeeks > 0 ? (totalSessions / activeWeeks - 3) * 5 : 0)
    )
  ));

  const deloadRecommended = fatigueScore >= 70 || (plateauDetected && totalSessions / activeWeeks > 3.5);

  const equipmentDist: Record<string, number> = {};
  const variantDist: Record<string, number> = {};
  const tierDist: Record<string, number> = {};
  sessions.forEach((s) => {
    equipmentDist[s.modifier || "unmodified"] = (equipmentDist[s.modifier || "unmodified"] || 0) + 1;
    variantDist[s.variant || "default"] = (variantDist[s.variant || "default"] || 0) + 1;
    tierDist[`Tier ${s.level}`] = (tierDist[`Tier ${s.level}`] || 0) + 1;
  });

  const heatMap = new Map<string, number>();
  sessions.forEach((s) => {
    const key = s.date.slice(0, 10);
    heatMap.set(key, (heatMap.get(key) || 0) + 1);
  });

  const tierStats = tiers.map((tier) => {
    const tierSessions = sessions.filter((s) => s.level === tier.level);
    const completedAt = tierCompletionDates.get(tier.level) || null;
    const firstAttempt = tierSessions[0]?.date || null;
    const timeToMasteryDays = completedAt && firstAttempt
      ? Math.round(daysBetween(new Date(firstAttempt), new Date(completedAt)))
      : null;

    return {
      tierId: tier.id,
      level: tier.level,
      name: tier.name,
      wuxiaName: tier.wuxiaName || "",
      completed: !!completedAt,
      completedAt,
      firstAttempt,
      sessions: tierSessions.length,
      bestWeight: Math.max(...tierSessions.map((s) => s.bestWeight), 0),
      bestReps: Math.max(...tierSessions.map((s) => s.bestReps), 0),
      bestHold: Math.max(...tierSessions.map((s) => s.bestHold), 0),
      totalVolume: tierSessions.reduce((sum, s) => sum + s.volume, 0),
      avgSessionScore: Number(average(tierSessions.map((s) => s.intensityScore)).toFixed(2)),
      timeToMasteryDays,
      targetHold: tier.targetHold,
      targetReps: parseTargetReps(tier),
    };
  });

  const rolling7 = rollingAverage(sessions, 7);
  const rolling14 = rollingAverage(sessions, 14);
  const rolling30 = rollingAverage(sessions, 30);

  const next90GoalDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const projRepsAt90 = Math.max(0, bestRepsOverall + repsReg.slope * 90);
  const projHoldAt90 = Math.max(0, bestHoldOverall + holdReg.slope * 90);
  const repsGoalProb = targetReps > 0 ? Math.max(0, Math.min(100, Math.round((projRepsAt90 / targetReps) * 100))) : 50;
  const holdGoalProb = targetHold > 0 ? Math.max(0, Math.min(100, Math.round((projHoldAt90 / targetHold) * 100))) : 50;
  const variantBreakdown = aggregateBreakdown(sessions, (s) => s.variant);
  const modifierBreakdown = aggregateBreakdown(sessions, (s) => s.modifier);

  return {
    sessions,
    summaries: {
      totalSessions,
      activeDays,
      uniqueTrainingDays: uniqueDays,
      sessionsPerWeek: Number((totalSessions / activeWeeks).toFixed(2)),
      longestStreakDays: longestStreakByDay(sessions),
      totalVolume: Number(totalVolume.toFixed(2)),
      totalReps: totalRepsAll,
      totalTimeUnderTensionSeconds: totalTut,
      avgVolumePerSession: Number(average(sessions.map((s) => s.volume)).toFixed(2)),
      avgHoldSeconds: Number(average(sessions.map((s) => s.bestHold)).toFixed(2)),
      avgIntensityScore: Number(average(scoreSeries.map((s) => s.value)).toFixed(2)),
      consistencyScore,
      inferredRecoveryHours: Number(inferredRecoveryHours.toFixed(1)),
      fatigueScore,
      bestSession,
      personalBests: {
        bestWeight: Math.max(...sessions.map((s) => s.bestWeight), 0),
        bestReps: bestRepsOverall,
        bestHold: bestHoldOverall,
        bestVolumeSession: Math.max(...sessions.map((s) => s.volume), 0),
        bestOneRm: Number(Math.max(...sessions.map((s) => s.oneRmEstimate), 0).toFixed(2)),
      },
      improvements: {
        weeklyPct: Number(improvementPct(scoreSeries, 7, now).toFixed(2)),
        monthlyPct: Number(improvementPct(scoreSeries, 30, now).toFixed(2)),
        quarterlyPct: Number(improvementPct(scoreSeries, 90, now).toFixed(2)),
      },
      avgDaysBetweenTierAdvancements: Number(avgAdvancementDays.toFixed(2)),
      columnAverages: {
        w1: Number(average(sessions.map((s) => s.w1)).toFixed(2)),
        r1: Number(average(sessions.map((s) => s.r1)).toFixed(2)),
        w2: Number(average(sessions.map((s) => s.w2)).toFixed(2)),
        r2: Number(average(sessions.map((s) => s.r2)).toFixed(2)),
        w3: Number(average(sessions.map((s) => s.w3)).toFixed(2)),
        r3: Number(average(sessions.map((s) => s.r3)).toFixed(2)),
        t1: Number(average(sessions.map((s) => s.t1)).toFixed(2)),
        t2: Number(average(sessions.map((s) => s.t2)).toFixed(2)),
        t3: Number(average(sessions.map((s) => s.t3)).toFixed(2)),
      },
    },
    predictions: {
      projectedNextSession: {
        reps: projectedNextSessionReps,
        holdSeconds: projectedNextSessionHold,
        volume: Number(Math.max(0, (sessions.at(-1)?.volume || 0) + volumeReg.slope * 3).toFixed(2)),
      },
      projectedNextTierDate: projectedTierDate.toISOString(),
      projectedTierDays,
      predictedPrDate: new Date(now.getTime() + Math.max(7, Math.round(20 / Math.max(0.01, repsReg.slope + holdReg.slope))) * 24 * 60 * 60 * 1000).toISOString(),
      plateauDetected,
      optimalSessionsPerWeek: bestFreqEntry?.sessions || 3,
      deloadRecommended,
      expectedVolumeForTierAdvancement: Number((average(tierStats.filter((t) => t.completed).map((t) => t.totalVolume)) || 0).toFixed(2)),
      goalProbabilities: {
        next90DaysRepsGoalPct: repsGoalProb,
        next90DaysHoldGoalPct: holdGoalProb,
        targetDate: next90GoalDate.toISOString(),
      },
    },
    charts: {
      repsSeries,
      holdSeries,
      volumeSeries,
      scoreSeries,
      rolling7,
      rolling14,
      rolling30,
      scatterFrequencyVsImprovement: Array.from(weeklyBuckets.entries()).map(([week, bucket]) => ({
        week,
        frequency: bucket.sessions,
        improvement: Number(average(bucket.improvement).toFixed(2)),
      })),
      equipmentDistribution: Object.entries(equipmentDist).map(([label, value]) => ({ label, value })),
      variantDistribution: Object.entries(variantDist).map(([label, value]) => ({ label, value })),
      tierDistribution: Object.entries(tierDist).map(([label, value]) => ({ label, value })),
      heatmap: Array.from(heatMap.entries()).map(([date, value]) => ({ date, value })),
      boxPlot: {
        q1: Number(percentile(scoreSeries.map((s) => s.value), 25).toFixed(2)),
        median: Number(percentile(scoreSeries.map((s) => s.value), 50).toFixed(2)),
        q3: Number(percentile(scoreSeries.map((s) => s.value), 75).toFixed(2)),
        min: Number(Math.min(...scoreSeries.map((s) => s.value), 0).toFixed(2)),
        max: Number(Math.max(...scoreSeries.map((s) => s.value), 0).toFixed(2)),
      },
      candlestick: sessions.map((s, idx) => {
        const prev = sessions[idx - 1];
        const open = prev ? prev.intensityScore : s.intensityScore;
        const close = s.intensityScore;
        const high = Math.max(open, close, s.bestReps + s.bestHold);
        const low = Math.min(open, close, Math.max(0, s.intensityScore - 20));
        return { date: s.date, open, close, high, low };
      }),
      funnel: tierStats.map((t) => ({ label: `Tier ${t.level}`, value: Math.max(1, t.sessions) })),
      radar: {
        strength: Number((average(sessions.map((s) => s.bestReps)) * 4).toFixed(2)),
        endurance: Number((average(sessions.map((s) => s.bestHold)) * 2).toFixed(2)),
        consistency: consistencyScore,
        velocity: Number(Math.max(0, (repsReg.slope + holdReg.slope) * 50).toFixed(2)),
        density: Number(Math.min(100, (totalSessions / activeWeeks) * 20).toFixed(2)),
      },
      gauge: {
        value: Math.max(
          targetReps > 0 ? (bestRepsOverall / targetReps) * 100 : 0,
          targetHold > 0 ? (bestHoldOverall / targetHold) * 100 : 0,
          0,
        ),
      },
    },
    tiers: tierStats,
    breakdowns: {
      byVariant: variantBreakdown,
      byModifier: modifierBreakdown,
    },
    raw: {
      logs: logs.map((log) => ({
        ...log,
        effectiveLevel: effectiveLevel(log),
      })),
    },
  };
}
