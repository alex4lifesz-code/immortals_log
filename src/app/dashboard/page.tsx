"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useIncomingFriendRequestsCount } from "@/hooks/useIncomingFriendRequestsCount";
import { api } from "@/lib/api-client";
import { formatDateWithPreference, getTodayInTimeZone, normalizeDateOnlyKey, resolveCalendarWeekStartsOn } from "@/lib/constants";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { kgToLbs } from "@/lib/unit-conversion";

type CheckIn = {
  userId?: string;
  weight?: number | string | null;
  date?: string | null;
  present?: boolean | null;
};

type PublicUser = {
  id: string;
  name?: string | null;
  username?: string | null;
};

type CirclePreviewItem = {
  userId: string;
  name: string;
  dateKey: string;
};

type WeightTrend = {
  deltaKg: number;
  daysBetween: number;
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
      .map((c) => normalizeDateOnlyKey(c.date ?? null))
      .filter((value): value is string => Boolean(value))
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

function relativeTimeFromDateKeys(dateKey: string, todayKey: string): string {
  const diffMs = new Date(`${todayKey}T00:00:00.000Z`).getTime() - new Date(`${dateKey}T00:00:00.000Z`).getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
}

function friendNameFallback(entry: PublicUser | undefined, userId: string): string {
  const primary = (entry?.name || entry?.username || "").trim();
  if (primary) return primary;
  const shortId = userId.slice(0, 6);
  return shortId ? `Friend ${shortId}` : "Friend";
}

export default function DashboardHomePage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const weightUnit = settings.defaultWeightUnit ?? "kg";

  const [checkInCount, setCheckInCount] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [activeCheckinDates, setActiveCheckinDates] = useState<Set<string>>(new Set());
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [cultivationDay, setCultivationDay] = useState<number | null>(null);
  const [circlePreview, setCirclePreview] = useState<CirclePreviewItem[]>([]);

  const { count: incomingRequestCount } = useIncomingFriendRequestsCount(user?.id);

  const todayKey = useMemo(() => getTodayInTimeZone(settings.timeZone), [settings.timeZone]);

  useEffect(() => {
    if (!user?.id) {
      setCheckInCount(0);
      setStreak(0);
      setLatestWeight(null);
      setWeightTrend(null);
      setCultivationDay(null);
      setCirclePreview([]);
      setActiveCheckinDates(new Set());
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get<{ checkins: CheckIn[] }>("/api/checkins", { cache: "no-store" }),
      api.get<{ users: PublicUser[] }>("/api/users/public?scope=friends", { cache: "no-store" }).catch(() => ({ users: [] })),
    ])
      .then(([payload, usersPayload]) => {
        if (cancelled) return;
        const raw: CheckIn[] = Array.isArray(payload?.checkins) ? payload.checkins : [];
        const users = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
        const userById = new Map(users.map((entry) => [entry.id, entry]));
        const mine = raw.filter((c) => c.userId === user.id && c.present !== false);
        const mineDateKeys = mine
          .map((entry) => normalizeDateOnlyKey(entry.date ?? null))
          .filter((value): value is string => Boolean(value));
        setCheckInCount(mine.length);
        setStreak(computeStreak(raw, user.id, todayKey));
        setActiveCheckinDates(new Set(mineDateKeys));

        const earliest = [...mineDateKeys].sort()[0];
        if (earliest) {
          const diffMs = new Date(`${todayKey}T00:00:00.000Z`).getTime() - new Date(`${earliest}T00:00:00.000Z`).getTime();
          const days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1);
          setCultivationDay(days);
        } else {
          setCultivationDay(null);
        }

        const sorted = mine
          .filter((c) => c.weight != null && Number.isFinite(Number(c.weight)) && Number(c.weight) > 0)
          .sort((a, b) => {
            const left = normalizeDateOnlyKey(b.date ?? null) ?? "";
            const right = normalizeDateOnlyKey(a.date ?? null) ?? "";
            return left.localeCompare(right);
          });
        setLatestWeight(sorted.length > 0 ? Number(sorted[0].weight) : null);
        if (sorted.length >= 2) {
          const latestDate = normalizeDateOnlyKey(sorted[0].date ?? null);
          const previousDate = normalizeDateOnlyKey(sorted[1].date ?? null);
          const daysBetween = latestDate && previousDate
            ? Math.max(
                1,
                Math.floor(
                  (new Date(`${latestDate}T00:00:00.000Z`).getTime() - new Date(`${previousDate}T00:00:00.000Z`).getTime()) /
                    (24 * 60 * 60 * 1000)
                )
              )
            : 1;
          setWeightTrend({ deltaKg: Number(sorted[0].weight) - Number(sorted[1].weight), daysBetween });
        } else {
          setWeightTrend(null);
        }

        const latestByFriend = new Map<string, string>();
        for (const entry of raw) {
          if (!entry.userId || entry.userId === user.id || entry.present === false) continue;
          const key = normalizeDateOnlyKey(entry.date ?? null);
          if (!key) continue;
          const existing = latestByFriend.get(entry.userId);
          if (!existing || key > existing) {
            latestByFriend.set(entry.userId, key);
          }
        }
        const preview = [...latestByFriend.entries()]
          .sort((a, b) => b[1].localeCompare(a[1]))
          .slice(0, 3)
          .map(([friendId, dateKey]) => ({
            userId: friendId,
            name: friendNameFallback(userById.get(friendId), friendId),
            dateKey,
          }));
        setCirclePreview(preview);
      })
      .catch(() => {
        if (!cancelled) {
          setCheckInCount(0);
          setStreak(0);
          setLatestWeight(null);
          setWeightTrend(null);
          setCultivationDay(null);
          setCirclePreview([]);
          setActiveCheckinDates(new Set());
        }
      });
    return () => { cancelled = true; };
  }, [user?.id, todayKey]);

  const weekDays = useMemo(() => {
    const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
    const weekStartsOn = resolveCalendarWeekStartsOn(settings.calendarWeekStart, settings.timeZone);
    const todayDow = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
    const offset = (todayDow - weekStartsOn + 7) % 7;
    const startKey = shiftDateKey(todayKey, -offset);
    return Array.from({ length: 7 }, (_, i) => {
      const key = shiftDateKey(startKey, i);
      const dow = new Date(key + "T00:00:00Z").getUTCDay();
      return { key, label: DAY_LABELS[dow], active: activeCheckinDates.has(key), isToday: key === todayKey };
    });
  }, [activeCheckinDates, settings.calendarWeekStart, settings.timeZone, todayKey]);

  const checkedInToday = activeCheckinDates.has(todayKey);

  const displayWeight = useMemo(() => {
    if (latestWeight == null) return "—";
    const val = weightUnit === "lbs" ? kgToLbs(latestWeight) : latestWeight;
    return `${val} ${weightUnit}`;
  }, [latestWeight, weightUnit]);

  const weightTrendText = useMemo(() => {
    if (!weightTrend || !Number.isFinite(weightTrend.deltaKg) || weightTrend.deltaKg === 0) return null;
    const delta = weightUnit === "lbs" ? kgToLbs(Math.abs(weightTrend.deltaKg)) : Math.abs(weightTrend.deltaKg);
    const sign = weightTrend.deltaKg > 0 ? "+" : "-";
    const unitLabel = weightUnit === "lbs" ? "lb" : "kg";
    const daysLabel = weightTrend.daysBetween === 1 ? "day" : "days";
    return `${sign}${delta.toFixed(1)} ${unitLabel} since last check-in (${weightTrend.daysBetween} ${daysLabel})`;
  }, [weightTrend, weightUnit]);

  const checkInStatusLabel = checkedInToday ? "Checked in" : "Not checked in";
  const workoutStatusLabel = checkedInToday ? "Workout ready" : "Workout locked behind check-in";
  const statTiles = [
    {
      label: "Check-ins",
      value: checkInCount == null ? "—" : String(checkInCount),
      subline: "all time",
    },
    {
      label: "Streak",
      value: streak == null ? "—" : `${streak} days`,
      subline: streak != null && streak > 0 ? "keep it alive" : "start today",
    },
    {
      label: "Weight",
      value: displayWeight,
      subline: weightTrendText ?? "latest check-in",
    },
  ] as const;

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
      mobileContentPaddingClass="px-2 pt-4 pb-24"
    >
      <div className="space-y-3 px-0 py-0 sm:space-y-4 sm:py-1">

        {/* Header context */}
        <section className="rounded-xl border px-3 py-2.5" style={shellStyle}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Cultivation Path</p>
              <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                修炼之路 · {formatDateWithPreference(todayKey, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Day</p>
              <p className="mt-0.5 text-[22px] font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
                {cultivationDay ?? "-"}
              </p>
            </div>
          </div>
        </section>

        {/* Today */}
        <section className="rounded-xl border p-3" style={shellStyle}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Today</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg border px-2.5 py-2" style={tileStyle}>
              <p className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Check-in</p>
              <p className="mt-0.5 text-[12px] font-semibold" style={{ color: checkedInToday ? "var(--forest)" : "var(--text-primary)" }}>
                {checkInStatusLabel}
              </p>
            </div>
            <div className="rounded-lg border px-2.5 py-2" style={tileStyle}>
              <p className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Workout</p>
              <p className="mt-0.5 text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {workoutStatusLabel}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Link
              href={DASHBOARD_ROUTES.workoutHistory}
              className="flex-1 rounded-lg border px-3 py-3 text-left"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 56%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent) 18%, var(--ink-mid))",
                boxShadow: "0 8px 18px color-mix(in srgb, var(--accent) 22%, transparent)",
              }}
            >
              <span className="block text-[13px] font-semibold" style={{ color: "var(--accent)" }}>Start workout</span>
              <span className="mt-0.5 block text-[10px]" style={{ color: "var(--text-secondary)" }}>Open your training log and begin today&apos;s session</span>
            </Link>
            {!checkedInToday && (
              <Link
                href={DASHBOARD_ROUTES.checkIn}
                className="rounded-lg border px-3 py-3 text-[11px] font-semibold"
                style={tileStyle}
              >
                Check in now
              </Link>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="rounded-xl border p-3" style={shellStyle}>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Your stats</p>
          <div className="grid grid-cols-3 gap-2">
            {statTiles.map(({ label, value, subline }) => (
              <div key={label} className="rounded-lg border px-2.5 py-2.5" style={tileStyle}>
                <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
                <p className="mt-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>{subline}</p>
              </div>
            ))}
          </div>
        </section>

        {/* This week */}
        <section className="rounded-xl border p-3" style={shellStyle}>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>This week</p>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "color-mix(in srgb, var(--forest) 68%, transparent)" }} />
                Logged
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm border" style={{ borderColor: "var(--accent)" }} />
                Today
              </span>
            </div>
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
          className="flex items-start justify-between rounded-xl border px-3.5 py-3 transition-all active:scale-[0.98]"
          style={shellStyle}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-[20px] leading-none">⭕</span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Circle</p>
              {circlePreview.length > 0 ? (
                <div className="mt-1.5 space-y-1">
                  {circlePreview.slice(0, 2).map((item) => (
                    <p key={item.userId} className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                      ● {item.name} checked in · {relativeTimeFromDateKeys(item.dateKey, todayKey)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Friends &amp; activity</p>
              )}
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

