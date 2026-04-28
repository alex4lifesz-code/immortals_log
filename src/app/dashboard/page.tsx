"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useIncomingFriendRequestsCount } from "@/hooks/useIncomingFriendRequestsCount";
import { api } from "@/lib/api-client";
import { getTodayInTimeZone } from "@/lib/constants";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { kgToLbs } from "@/lib/unit-conversion";

type CheckIn = {
  userId?: string;
  weight?: number | string | null;
  date?: string | null;
  present?: boolean | null;
};

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

function computeStreak(checkins: CheckIn[], userId: string, todayKey: string): number {
  const dates = new Set(
    checkins
      .filter((c) => c.userId === userId && c.present !== false && c.date)
      .map((c) => String(c.date))
  );

  if (dates.size === 0) return 0;

  let streak = 0;
  let cursorKey = dates.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);

  for (let i = 0; i < 365; i++) {
    if (!dates.has(cursorKey)) break;
    streak++;
    cursorKey = shiftDateKey(cursorKey, -1);
  }
  return streak;
}

const QUICK_ACTIONS = [
  { label: "Log Workout", icon: "🏋️", path: DASHBOARD_ROUTES.workoutHistory, primary: true },
  { label: "Check In", icon: "📋", path: DASHBOARD_ROUTES.checkIn, primary: false },
  { label: "Progress", icon: "📊", path: DASHBOARD_ROUTES.progress, primary: false },
] as const;

export default function DashboardHomePage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const weightUnit = settings.defaultWeightUnit ?? "kg";

  const [checkInCount, setCheckInCount] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [activeCheckinDates, setActiveCheckinDates] = useState<Set<string>>(new Set());

  const { count: incomingRequestCount } = useIncomingFriendRequestsCount(user?.id);

  const todayKey = useMemo(() => getTodayInTimeZone(settings.timeZone), [settings.timeZone]);

  useEffect(() => {
    if (!user?.id) {
      setCheckInCount(0);
      setStreak(0);
      setLatestWeight(null);
      setActiveCheckinDates(new Set());
      return;
    }
    let cancelled = false;
    api.get<{ checkins: CheckIn[] }>("/api/checkins", { cache: "no-store" })
      .then((payload) => {
        if (cancelled) return;
        const raw: CheckIn[] = Array.isArray(payload?.checkins) ? payload.checkins : [];
        const mine = raw.filter((c) => c.userId === user.id && c.present !== false);
        setCheckInCount(mine.length);
        setStreak(computeStreak(raw, user.id, todayKey));
        setActiveCheckinDates(new Set(mine.map((c) => String(c.date ?? ""))));
        const sorted = mine
          .filter((c) => c.weight != null && Number.isFinite(Number(c.weight)) && Number(c.weight) > 0)
          .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
        setLatestWeight(sorted.length > 0 ? Number(sorted[0].weight) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setCheckInCount(0);
          setStreak(0);
          setLatestWeight(null);
          setActiveCheckinDates(new Set());
        }
      });
    return () => { cancelled = true; };
  }, [user?.id, todayKey]);

  const weekDays = useMemo(() => {
    const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
    return Array.from({ length: 7 }, (_, i) => {
      const key = shiftDateKey(todayKey, i - 6);
      const dow = new Date(key + "T00:00:00Z").getUTCDay();
      return { key, label: DAY_LABELS[dow], active: activeCheckinDates.has(key), isToday: i === 6 };
    });
  }, [todayKey, activeCheckinDates]);

  const checkedInToday = activeCheckinDates.has(todayKey);

  const displayWeight = useMemo(() => {
    if (latestWeight == null) return "—";
    const val = weightUnit === "lbs" ? kgToLbs(latestWeight) : latestWeight;
    return `${val} ${weightUnit}`;
  }, [latestWeight, weightUnit]);

  const now = new Date();
  const zonedHourRaw = settings.timeZone
    ? Number.parseInt(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: settings.timeZone }).format(now), 10)
    : now.getHours();
  const hour = Number.isFinite(zonedHourRaw) ? zonedHourRaw : now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const shellStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
  };

  const tileStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-mid) 62%, var(--ink-deep))",
  };

  return (
    <PageLayout
      title="Home"
      subtitle={`${greeting}, ${user?.name ?? "Cultivator"}`}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map(({ label, icon, path, primary }) => (
            <Link
              key={path}
              href={path}
              className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3.5 text-center transition-all active:scale-[0.97]"
              style={primary ? {
                borderColor: "color-mix(in srgb, var(--accent) 44%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-mid))",
                boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 18%, transparent)",
              } : tileStyle}
            >
              <span className="text-[22px] leading-none">{icon}</span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: primary ? "var(--accent)" : "var(--text-primary)" }}
              >
                {label}
              </span>
            </Link>
          ))}
        </div>

        {/* Stats */}
        <section className="rounded-xl border p-3" style={shellStyle}>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Your stats</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "Check-ins", value: checkInCount == null ? "—" : String(checkInCount) },
              { label: "Streak", value: streak == null ? "—" : streak === 0 ? "0 days" : `${streak}d` },
              { label: "Weight", value: displayWeight },
            ] as const).map(({ label, value }) => (
              <div key={label} className="rounded-lg border px-2.5 py-2.5" style={tileStyle}>
                <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* This week */}
        <section className="rounded-xl border p-3" style={shellStyle}>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>This week</p>
            {checkedInToday && (
              <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--forest)" }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--forest)" }} />
                Logged today
              </span>
            )}
          </div>
          <div className="flex items-end gap-1.5">
            {weekDays.map(({ key, label, active, isToday }) => (
              <div key={key} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-md"
                  style={{
                    height: 28,
                    backgroundColor: active
                      ? "color-mix(in srgb, var(--forest) 68%, transparent)"
                      : "color-mix(in srgb, var(--ink-light) 28%, transparent)",
                    border: isToday
                      ? `1.5px solid ${active ? "var(--forest)" : "var(--accent)"}`
                      : "1px solid transparent",
                  }}
                />
                <span
                  className="text-[9px] font-medium"
                  style={{ color: isToday ? "var(--accent)" : "var(--text-muted)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Circle */}
        <Link
          href={DASHBOARD_ROUTES.circle}
          className="flex items-center justify-between rounded-xl border px-3.5 py-3 transition-all active:scale-[0.98]"
          style={shellStyle}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[20px] leading-none">⭕</span>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Circle</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Friends &amp; activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(incomingRequestCount ?? 0) > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{ backgroundColor: "var(--accent)", color: "var(--void-black)" }}
              >
                {incomingRequestCount}
              </span>
            )}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

      </div>
    </PageLayout>
  );
}

