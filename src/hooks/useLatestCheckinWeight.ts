"use client";

import { useEffect, useState } from "react";

type CacheEntry = {
  value: number | null;
  ts: number;
};

const latestWeightCache = new Map<string, CacheEntry>();

export function useLatestCheckinWeight(userId: string | null, enabled: boolean, cacheMs = 60_000): number | null {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setValue(null);
      return;
    }

    const cacheKey = userId;
    const cached = latestWeightCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < cacheMs) {
      setValue(cached.value);
      return;
    }

    let cancelled = false;
    fetch("/api/checkins/latest-weight", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        const json = (await res.json()) as { weight?: number | null };
        const parsed = typeof json.weight === "number" && Number.isFinite(json.weight) && json.weight > 0
          ? json.weight
          : null;
        latestWeightCache.set(cacheKey, { value: parsed, ts: Date.now() });
        if (!cancelled) setValue(parsed);
      })
      .catch(() => {
        latestWeightCache.set(cacheKey, { value: null, ts: Date.now() });
        if (!cancelled) setValue(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, cacheMs]);

  return value;
}
