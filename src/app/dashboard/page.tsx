"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import type { CalendarWeekStartOption } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { translateEnglishToLanguage } from "@/lib/language";
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

type WeightTrend = {
  deltaKg: number;
  daysBetween: number;
};

type FriendWeekSection = {
  userId: string;
  name: string;
  days: Array<{ key: string; label: string; active: boolean; isToday: boolean }>;
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

function friendNameFallback(entry: PublicUser | undefined, userId: string): string {
  const primary = (entry?.name || entry?.username || "").trim();
  if (primary) return primary;
  const shortId = userId.slice(0, 6);
  return shortId ? `Friend ${shortId}` : "Friend";
}

function buildWeekDays(
  todayKey: string,
  weekOffset: number,
  calendarWeekStart: CalendarWeekStartOption,
  timeZone: string,
  checkinDates: Set<string>
) {
  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
  const weekStartsOn = resolveCalendarWeekStartsOn(calendarWeekStart, timeZone);
  const todayDow = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const offsetToStart = (todayDow - weekStartsOn + 7) % 7;
  const startKey = shiftDateKey(todayKey, -offsetToStart + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftDateKey(startKey, i);
    const dow = new Date(key + "T00:00:00Z").getUTCDay();
    return {
      key,
      label: DAY_LABELS[dow],
      active: checkinDates.has(key),
      isToday: key === todayKey,
    };
  });
}

function buildWeekLabel(
  weekOffset: number,
  todayKey: string,
  calendarWeekStart: CalendarWeekStartOption,
  timeZone: string
): string {
  if (weekOffset === 0) return "This week";
  if (weekOffset === -1) return "Last week";
  const weekStartsOn = resolveCalendarWeekStartsOn(calendarWeekStart, timeZone);
  const todayDow = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const offsetToStart = (todayDow - weekStartsOn + 7) % 7;
  const startKey = shiftDateKey(todayKey, -offsetToStart + weekOffset * 7);
  const endKey = shiftDateKey(startKey, 6);
  return `${startKey.slice(5)} \u2013 ${endKey.slice(5)}`;
}

interface WeekCardProps {
  name?: string;
  checkinDates: Set<string>;
  todayKey: string;
  weekOffset: number;
  transitionDirection: 1 | -1;
  calendarWeekStart: CalendarWeekStartOption;
  timeZone: string;
  activeColor: string;
  inactiveColor: string;
  borderColor: string;
  dayLabelColor: string;
  shellStyle: React.CSSProperties;
  translateFn?: (text: string) => string;
}

function WeekCard({
  name,
  checkinDates,
  todayKey,
  weekOffset,
  transitionDirection,
  calendarWeekStart,
  timeZone,
  activeColor,
  inactiveColor,
  borderColor,
  dayLabelColor,
  shellStyle,
  translateFn = (x) => x,
}: WeekCardProps) {
  const days = buildWeekDays(todayKey, weekOffset, calendarWeekStart, timeZone, checkinDates);

  return (
    <section className="rounded-xl border p-3" style={shellStyle}>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          {name && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: activeColor }} />
            {translateFn("Logged")}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border" style={{ borderColor }} />
            {translateFn("Today")}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        {days.map(({ key, label, active, isToday }) => (
          <div key={key} className="flex flex-1 flex-col items-center gap-1">
            {(() => {
              const isTodayAndLogged = active && isToday;
              const dayBoxStyle: React.CSSProperties = isTodayAndLogged
                ? {
                    height: 28,
                    backgroundColor: "color-mix(in srgb, var(--forest) 52%, var(--cloud-white) 48%)",
                    backgroundImage: "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--cloud-white) 24%, transparent) 0px, color-mix(in srgb, var(--cloud-white) 24%, transparent) 4px, transparent 4px, transparent 8px)",
                    border: `1.5px solid ${borderColor}`,
                    boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 28%, transparent), 0 0 0 1px color-mix(in srgb, var(--forest) 14%, transparent)",
                  }
                : {
                    height: 28,
                    backgroundColor: active ? activeColor : inactiveColor,
                    border: isToday ? `1.5px solid ${borderColor}` : "1px solid transparent",
                  };

              return (
                <motion.div
                  className="w-full rounded-md"
                  style={dayBoxStyle}
                  initial={{
                    opacity: 0,
                    x: transitionDirection > 0 ? 14 : -14,
                    scale: 0.98,
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{
                    x: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 },
                    opacity: { duration: 0.16, ease: "easeOut" },
                    scale: { duration: 0.16, ease: "easeOut" },
                  }}
                />
              );
            })()}
            <span className="text-[9px] font-medium" style={{ color: isToday ? dayLabelColor : "var(--text-muted)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardHomePage() {
  const { themeStyle } = useAppContext();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const weightUnit = settings.defaultWeightUnit ?? "kg";
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);

  const [checkInCount, setCheckInCount] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [activeCheckinDates, setActiveCheckinDates] = useState<Set<string>>(new Set());
  const [friendInfoList, setFriendInfoList] = useState<Array<{ userId: string; name: string }>>([]);
  const [friendCheckinData, setFriendCheckinData] = useState<Map<string, Set<string>>>(new Map());
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [cultivationDay, setCultivationDay] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekTransitionDirection, setWeekTransitionDirection] = useState<1 | -1>(-1);

  const weekSwipeRef = useRef<HTMLElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeHorizontalRef = useRef<boolean | null>(null);

  const minWeekOffset = -8;

  const weekLabelAnimation = {
    enter: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction > 0 ? 20 : -20,
      y: 0,
    }),
    center: { opacity: 1, x: 0, y: 0 },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction > 0 ? -20 : 20,
      y: 0,
    }),
  };

  const goToPreviousWeek = () => {
    setWeekTransitionDirection(-1);
    setWeekOffset((previous) => Math.max(minWeekOffset, previous - 1));
  };

  const goToNextWeek = () => {
    setWeekTransitionDirection(1);
    setWeekOffset((previous) => Math.min(0, previous + 1));
  };

  const todayKey = useMemo(() => getTodayInTimeZone(settings.timeZone), [settings.timeZone]);

  useEffect(() => {
    const el = weekSwipeRef.current;
    if (!el) return;
    const onStart = (event: TouchEvent) => {
      swipeStartXRef.current = event.touches[0].clientX;
      swipeStartYRef.current = event.touches[0].clientY;
      swipeHorizontalRef.current = null;
    };
    const onMove = (event: TouchEvent) => {
      if (swipeStartXRef.current == null || swipeStartYRef.current == null) return;
      if (swipeHorizontalRef.current == null) {
        const dx = Math.abs(event.touches[0].clientX - swipeStartXRef.current);
        const dy = Math.abs(event.touches[0].clientY - swipeStartYRef.current);
        if (dx < 5 && dy < 5) return;
        swipeHorizontalRef.current = dx > dy;
      }
      if (swipeHorizontalRef.current) event.preventDefault();
    };
    const onEnd = (event: TouchEvent) => {
      if (swipeStartXRef.current == null || !swipeHorizontalRef.current) {
        swipeStartXRef.current = null;
        swipeStartYRef.current = null;
        swipeHorizontalRef.current = null;
        return;
      }
      const dx = event.changedTouches[0].clientX - swipeStartXRef.current;
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      swipeHorizontalRef.current = null;
      if (Math.abs(dx) < 40) return;
      if (dx > 0) {
        goToPreviousWeek();
      } else {
        goToNextWeek();
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCheckInCount(0);
      setStreak(0);
      setLatestWeight(null);
      setWeightTrend(null);
      setCultivationDay(null);
      setActiveCheckinDates(new Set());
      setFriendInfoList([]);
      setFriendCheckinData(new Map());
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
        const mine = raw.filter((c) => c.userId === user.id && c.present !== false);
        const friendRows = users
          .filter((entry) => entry.id && entry.id !== user.id)
          .map((entry) => ({
            userId: entry.id,
            name: friendNameFallback(entry, entry.id),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const friendIds = new Set(friendRows.map((friend) => friend.userId));
        const friendCheckinDatesByUser = new Map<string, Set<string>>();
        for (const friend of friendRows) {
          friendCheckinDatesByUser.set(friend.userId, new Set());
        }
        for (const entry of raw) {
          if (!entry.userId || entry.userId === user.id || entry.present === false) continue;
          if (!friendIds.has(entry.userId)) continue;
          const key = normalizeDateOnlyKey(entry.date ?? null);
          if (!key) continue;
          const setForFriend = friendCheckinDatesByUser.get(entry.userId);
          if (setForFriend) setForFriend.add(key);
        }
        const mineDateKeys = mine
          .map((entry) => normalizeDateOnlyKey(entry.date ?? null))
          .filter((value): value is string => Boolean(value));
        setCheckInCount(mine.length);
        setStreak(computeStreak(raw, user.id, todayKey));
        setActiveCheckinDates(new Set(mineDateKeys));
        setFriendInfoList(friendRows);
        setFriendCheckinData(new Map(friendCheckinDatesByUser));

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
      })
      .catch(() => {
        if (!cancelled) {
          setCheckInCount(0);
          setStreak(0);
          setLatestWeight(null);
          setWeightTrend(null);
          setCultivationDay(null);
          setActiveCheckinDates(new Set());
          setFriendInfoList([]);
          setFriendCheckinData(new Map());
        }
      });
    return () => { cancelled = true; };
  }, [settings.calendarWeekStart, settings.timeZone, todayKey, user?.id]);

  const checkedInToday = activeCheckinDates.has(todayKey);

  const weekLabel = useMemo(
    () => lt(buildWeekLabel(weekOffset, todayKey, settings.calendarWeekStart, settings.timeZone)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekOffset, todayKey, settings.calendarWeekStart, settings.timeZone, settings.languageMode]
  );

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
    const daysLabel = weightTrend.daysBetween === 1 ? lt("day") : lt("days");
    return `${sign}${delta.toFixed(1)} ${unitLabel} ${lt("since last check-in")} (${weightTrend.daysBetween} ${daysLabel})`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightTrend, weightUnit, settings.languageMode]);

  const checkInStatusLabel = checkedInToday ? lt("Checked in") : lt("Not checked in");
  const statTiles = [
    {
      label: lt("Check-ins"),
      value: checkInCount == null ? "—" : String(checkInCount),
      subline: lt("all time"),
    },
    {
      label: lt("Streak"),
      value: streak == null ? "—" : `${streak} ${lt("days")}`,
      subline: streak != null && streak > 0 ? lt("keep it alive") : lt("start today"),
    },
    {
      label: lt("Weight"),
      value: displayWeight,
      subline: weightTrendText ?? lt("latest check-in"),
    },
  ];

  const now = new Date();
  const zonedHourRaw = settings.timeZone
    ? Number.parseInt(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: settings.timeZone }).format(now), 10)
    : now.getHours();
  const hour = Number.isFinite(zonedHourRaw) ? zonedHourRaw : now.getHours();
  const greeting = lt(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

  const shellStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
  };

  const tileStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-mid) 62%, var(--ink-deep))",
  };

  const yourWeekPalette = useMemo(() => {
    const paletteByTheme: Record<string, { active: string; inactive: string; border: string; label: string }> = {
      discord: {
        active: "color-mix(in srgb, var(--accent) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--accent) 20%, transparent)",
        border: "color-mix(in srgb, var(--accent) 78%, transparent)",
        label: "color-mix(in srgb, var(--accent) 40%, var(--cloud-white))",
      },
      forest: {
        active: "color-mix(in srgb, var(--forest) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--forest) 20%, transparent)",
        border: "color-mix(in srgb, var(--forest) 78%, transparent)",
        label: "color-mix(in srgb, var(--forest) 46%, var(--cloud-white))",
      },
      "ink-dragon": {
        active: "color-mix(in srgb, var(--gold) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--gold) 20%, transparent)",
        border: "color-mix(in srgb, var(--gold) 78%, transparent)",
        label: "color-mix(in srgb, var(--gold) 46%, var(--cloud-white))",
      },
      "ying-yang": {
        active: "color-mix(in srgb, var(--accent) 76%, transparent)",
        inactive: "color-mix(in srgb, var(--accent) 20%, transparent)",
        border: "color-mix(in srgb, var(--accent) 78%, transparent)",
        label: "color-mix(in srgb, var(--accent) 46%, var(--cloud-white))",
      },
      "ying-yang-light": {
        active: "color-mix(in srgb, var(--accent) 74%, transparent)",
        inactive: "color-mix(in srgb, var(--accent) 16%, transparent)",
        border: "color-mix(in srgb, var(--accent) 84%, transparent)",
        label: "color-mix(in srgb, var(--accent) 52%, var(--cloud-white))",
      },
      "phoenix-bloom": {
        active: "color-mix(in srgb, var(--danger) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--danger) 20%, transparent)",
        border: "color-mix(in srgb, var(--danger) 78%, transparent)",
        label: "color-mix(in srgb, var(--danger) 36%, var(--cloud-white))",
      },
      "storm-chains": {
        active: "color-mix(in srgb, var(--accent) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--accent) 20%, transparent)",
        border: "color-mix(in srgb, var(--accent) 78%, transparent)",
        label: "color-mix(in srgb, var(--accent) 46%, var(--cloud-white))",
      },
      "obsidian-ember": {
        active: "color-mix(in srgb, var(--jade) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--jade) 20%, transparent)",
        border: "color-mix(in srgb, var(--jade) 78%, transparent)",
        label: "color-mix(in srgb, var(--jade) 46%, var(--cloud-white))",
      },
      "mist-cultivator": {
        active: "color-mix(in srgb, var(--accent) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--accent) 20%, transparent)",
        border: "color-mix(in srgb, var(--accent) 78%, transparent)",
        label: "color-mix(in srgb, var(--accent) 40%, var(--cloud-white))",
      },
      "frost-sect": {
        active: "color-mix(in srgb, var(--jade) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--jade) 20%, transparent)",
        border: "color-mix(in srgb, var(--jade) 78%, transparent)",
        label: "color-mix(in srgb, var(--jade) 46%, var(--cloud-white))",
      },
      "heavenly-sword": {
        active: "color-mix(in srgb, var(--gold) 72%, transparent)",
        inactive: "color-mix(in srgb, var(--gold) 20%, transparent)",
        border: "color-mix(in srgb, var(--gold) 78%, transparent)",
        label: "color-mix(in srgb, var(--gold) 46%, var(--cloud-white))",
      },
    };
    return paletteByTheme[themeStyle] ?? paletteByTheme.discord;
  }, [themeStyle]);

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
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{lt("Cultivation Path")}</p>
              <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                修炼之路 · {formatDateWithPreference(todayKey, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{lt("Day")}</p>
              <p className="mt-0.5 text-[22px] font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
                {cultivationDay ?? "-"}
              </p>
            </div>
          </div>
        </section>

        {/* Today */}
        <section className="rounded-xl border p-3" style={shellStyle}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{lt("Today")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg border px-2.5 py-2" style={tileStyle}>
              <p className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{lt("Check-in")}</p>
              <p className="mt-0.5 text-[12px] font-semibold" style={{ color: checkedInToday ? "var(--forest)" : "var(--text-primary)" }}>
                {checkInStatusLabel}
              </p>
            </div>
            <Link
              href={DASHBOARD_ROUTES.workoutHistory}
              className="block rounded-lg border px-3 py-2 text-left"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 84%, var(--border))",
                backgroundColor: "color-mix(in srgb, var(--accent) 18%, var(--surface))",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent), 0 0 7px color-mix(in srgb, var(--accent) 28%, transparent), 0 0 12px color-mix(in srgb, var(--accent) 18%, transparent)",
              }}
            >
              <span className="block text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{lt("Start workout")}</span>
              <span className="mt-0.5 block text-[10px]" style={{ color: "var(--text-secondary)" }}>{lt("Open your training log and begin today's session")}</span>
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="rounded-xl border p-3" style={shellStyle}>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{lt("Your stats")}</p>
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

        {/* Shared week navigator (you + friends) */}
        <section
          ref={weekSwipeRef}
          className="mx-auto w-full max-w-[640px] rounded-xl border p-3"
          style={shellStyle}
        >
          <div className="mb-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={goToPreviousWeek}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-[16px]"
              style={{
                color: "var(--text-muted)",
                borderColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 56%, var(--ink-deep))",
              }}
              aria-label={lt("Previous week")}
            >
              &#8249;
            </button>
            <div className="relative min-w-[120px] overflow-hidden">
              <AnimatePresence mode="wait" initial={false} custom={weekTransitionDirection}>
                <motion.p
                  key={`week-label-${weekOffset}`}
                  className="text-center text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-secondary)" }}
                  custom={weekTransitionDirection}
                  variants={weekLabelAnimation}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 340, damping: 34, mass: 0.78 },
                    opacity: { duration: 0.16, ease: "easeOut" },
                  }}
                >
                  {weekLabel}
                </motion.p>
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={goToNextWeek}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-[16px]"
              style={{
                color: "var(--text-muted)",
                borderColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 56%, var(--ink-deep))",
                opacity: weekOffset >= 0 ? 0.35 : 1,
              }}
              aria-label={lt("Next week")}
              disabled={weekOffset >= 0}
            >
              &#8250;
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false} custom={weekTransitionDirection}>
            <div
              key={`week-content-${weekOffset}`}
              className="space-y-3"
            >
              <WeekCard
                name={lt("Your week")}
                checkinDates={activeCheckinDates}
                todayKey={todayKey}
                weekOffset={weekOffset}
                transitionDirection={weekTransitionDirection}
                calendarWeekStart={settings.calendarWeekStart}
                timeZone={settings.timeZone}
                activeColor={yourWeekPalette.active}
                inactiveColor={yourWeekPalette.inactive}
                borderColor={yourWeekPalette.border}
                dayLabelColor={yourWeekPalette.label}
                shellStyle={shellStyle}
                translateFn={lt}
              />

              {friendInfoList.map((friend) => (
                <WeekCard
                  key={friend.userId}
                  name={friend.name}
                  checkinDates={friendCheckinData.get(friend.userId) ?? new Set()}
                  todayKey={todayKey}
                  weekOffset={weekOffset}
                  transitionDirection={weekTransitionDirection}
                  calendarWeekStart={settings.calendarWeekStart}
                  timeZone={settings.timeZone}
                  activeColor="color-mix(in srgb, var(--accent) 72%, transparent)"
                  inactiveColor="color-mix(in srgb, var(--accent) 18%, transparent)"
                  borderColor="var(--accent)"
                  dayLabelColor="var(--accent)"
                  shellStyle={shellStyle}
                  translateFn={lt}
                />
              ))}
            </div>
          </AnimatePresence>
        </section>

      </div>
    </PageLayout>
  );
}

