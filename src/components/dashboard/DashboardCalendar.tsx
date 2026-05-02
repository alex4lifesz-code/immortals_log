"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import GlowButton from "@/components/ui/GlowButton";
import { useIsMobile } from "@/context/AppContext";
import type { CalendarWeekStartOption } from "@/context/DisplaySettingsContext";
import {
  createCalendarMonthAnchor,
  formatCalendarMonthLabel,
  formatDateLocal as formatDateLocalForZone,
  formatDateWithPreference,
  getTimeZoneDateParts,
  resolveCalendarWeekStartsOn,
} from "@/lib/constants";
import { t } from "@/lib/terminology";

export interface DashboardUser {
  id: string;
  name: string;
  username: string;
  sessionCount?: number;
}

export interface DashboardUpcomingNote {
  id: string;
  date: string;
  content: string;
  user: { id: string; name: string };
}

export const DEFAULT_CULTIVATOR_COLORS = [
  "var(--cultivator-jade)", "var(--cultivator-gold)", "var(--cultivator-crimson)", "var(--cultivator-azure)",
  "var(--cultivator-violet)", "var(--cultivator-emerald)", "var(--cultivator-amber)", "var(--cultivator-rose)",
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDeterministicCultivatorColor(userId: string): string {
  const hash = hashString(userId || "cultivator");
  return DEFAULT_CULTIVATOR_COLORS[hash % DEFAULT_CULTIVATOR_COLORS.length];
}

/** Assigns each user a distinct color from the palette, cycling if needed.
 *  Sort order determines who gets which color slot so the same group always
 *  gets the same assignments regardless of fetch order. */
export function assignCultivatorColors(userIds: string[]): Record<string, string> {
  const sorted = [...userIds].sort();
  return Object.fromEntries(
    sorted.map((id, i) => [id, DEFAULT_CULTIVATOR_COLORS[i % DEFAULT_CULTIVATOR_COLORS.length]])
  );
}

export function getUserCultivatorColor(userId: string, userColors: Record<string, string>): string {
  return userColors[userId] || getDeterministicCultivatorColor(userId);
}

export function normalizeCultivatorColor(colorValue: string | undefined): string {
  if (!colorValue) return DEFAULT_CULTIVATOR_COLORS[0];
  const normalized = colorValue.trim();
  if (normalized.startsWith("var(")) return normalized;
  if (normalized.startsWith("#") && normalized.length === 7) return normalized.toLowerCase();
  if (normalized.startsWith("cultivator-")) return `var(--${normalized})`;
  return normalized;
}

export function getCultivatorGlowColor(colorValue: string | undefined, alpha = 0.5): string {
  const normalized = normalizeCultivatorColor(colorValue);
  const pct = Math.round(alpha * 100);
  if (normalized.startsWith("var(") || normalized.startsWith("#")) {
    return `color-mix(in srgb, ${normalized} ${pct}%, transparent)`;
  }
  return `rgb(255 255 255 / ${alpha})`;
}

export function formatDateLocal(date: Date, timeZone?: string): string {
  return formatDateLocalForZone(date, timeZone);
}

// ── Dashboard Sidebar ──

export function DashboardSidebar({
  stats,
  allUsers,
  userColors,
  currentUserId,
  isAdmin,
}: {
  stats: { sessions: number; techniques: number; streak: number };
  allUsers: DashboardUser[];
  userColors: Record<string, string>;
  currentUserId?: string;
  isAdmin?: boolean;
}) {
  return (
    <div className="dashboard-sidebar-shell">
      <div className="dashboard-sidebar-scroll sidebar-scroll space-y-3">
        <GlowButton variant="jade" size="sm" glow className="w-full">
          ⚔️ Quick Training
        </GlowButton>
        <GlowButton variant="blue" size="sm" className="w-full">
          📋 Today&apos;s Check-In
        </GlowButton>

        <div className="dashboard-sidebar-card space-y-2">
          <h3 className="text-xs text-jade-glow uppercase">Cultivation Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-mist-mid">Training Sessions</span>
              <span className="text-cloud-white">{stats.sessions}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-mist-mid">Techniques Known</span>
              <span className="text-cloud-white">{stats.techniques}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-mist-mid">Check-In Streak</span>
              <span className="text-jade-glow font-semibold">{stats.streak} days</span>
            </div>
          </div>
        </div>
        {allUsers.length > 0 && (
          <div className="dashboard-sidebar-card space-y-2">
            <h3 className="text-xs text-jade-glow uppercase">Cultivators</h3>
            <div className="space-y-2">
              {allUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                const color = isSelf ? "var(--cultivator-self)" : "var(--cultivator-friend)";
                return (
                  <div key={u.id} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-mist-light truncate">{u.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar Day Cell ──

function CalendarDay({ dayNumber, checkedInUsers, hasCurrentUserWeight, isToday, isPast, hasNote, hasFutureNote, isOutsideMonth, compact, onClick }: { dayNumber: number; checkedInUsers: { id: string; name: string; color: string; isCurrentUser: boolean }[]; hasCurrentUserWeight?: boolean; isToday: boolean; isPast?: boolean; hasNote?: boolean; hasFutureNote?: boolean; isOutsideMonth?: boolean; compact: boolean; onClick?: () => void }) {
  const hasCheckIns = checkedInUsers.length > 0;
  const hasCurrentUserCheckIn = checkedInUsers.some((entry) => entry.isCurrentUser);
  const isElapsedDay = Boolean(isPast && !isToday && !hasCurrentUserCheckIn);
  const isUserPastCheckInDay = Boolean(isPast && !isToday && hasCurrentUserCheckIn);
  const friendDots = checkedInUsers.filter((entry) => !entry.isCurrentUser);
  const visibleDots = friendDots.slice(0, compact ? 3 : 4);
  const extraCount = friendDots.length - visibleDots.length;
  const neutralDayBackground = "color-mix(in srgb, var(--surface-hover) 62%, var(--surface))";

  // Prioritize meaningful status over time-based dimming.
  const baseDayStyle = isToday && hasCurrentUserCheckIn
    ? {
        borderColor: "color-mix(in srgb, var(--accent) 88%, var(--border))",
        backgroundColor: "color-mix(in srgb, var(--accent) 24%, var(--surface))",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 32%, transparent), 0 0 8px color-mix(in srgb, var(--accent) 34%, transparent), 0 0 14px color-mix(in srgb, var(--accent) 22%, transparent)",
      }
    : isToday
    ? {
        borderColor: "color-mix(in srgb, var(--accent) 84%, var(--border))",
        backgroundColor: "color-mix(in srgb, var(--accent) 18%, var(--surface))",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent), 0 0 7px color-mix(in srgb, var(--accent) 28%, transparent), 0 0 12px color-mix(in srgb, var(--accent) 18%, transparent)",
      }
    : hasCurrentUserCheckIn
      ? {
          borderColor: "color-mix(in srgb, var(--accent) 56%, var(--border))",
          backgroundColor: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
        }
      : hasCheckIns
        ? {
            borderColor: "color-mix(in srgb, var(--border) 88%, transparent)",
            backgroundColor: neutralDayBackground,
          }
        : hasFutureNote
          ? {
              borderColor: "color-mix(in srgb, var(--gold) 38%, var(--border))",
              backgroundColor: "color-mix(in srgb, var(--gold) 10%, var(--surface))",
            }
          : {
              borderColor: "color-mix(in srgb, var(--border) 94%, transparent)",
              backgroundColor: neutralDayBackground,
            };

  const dayStyle = isElapsedDay
    ? {
        ...baseDayStyle,
        borderStyle: "dashed" as const,
        backgroundColor: neutralDayBackground,
        backgroundImage: "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--border) 18%, transparent) 0px, color-mix(in srgb, var(--border) 18%, transparent) 4px, transparent 4px, transparent 8px)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 16%, transparent)",
      }
    : isUserPastCheckInDay
      ? {
          ...baseDayStyle,
          backgroundImage: "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--accent) 12%, transparent) 0px, color-mix(in srgb, var(--accent) 12%, transparent) 4px, transparent 4px, transparent 8px)",
        }
    : baseDayStyle;

  const resolvedDayStyle = isOutsideMonth
    ? {
        ...dayStyle,
        borderColor: "color-mix(in srgb, var(--border) 84%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--surface) 92%, transparent)",
        boxShadow: "none",
        opacity: 0.62,
      }
    : dayStyle;

  const dayNumberColor = isOutsideMonth
    ? "color-mix(in srgb, var(--text-muted) 92%, var(--surface))"
    : isToday || hasCurrentUserCheckIn
    ? "var(--text-primary)"
    : isPast
      ? "color-mix(in srgb, var(--text-secondary) 84%, var(--text-muted))"
      : "var(--text-primary)";

  return (
    <motion.button
      type="button"
      whileHover={compact ? undefined : { scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="dao-modern-calendar-day relative aspect-square w-full overflow-hidden rounded-[10px] border text-left transition-all duration-150"
      style={resolvedDayStyle}
    >
      <div className="flex h-full flex-col justify-between p-1.5">
        <div className="flex items-start justify-between gap-1">
          <span className={`${compact ? "text-xs" : "text-sm"} font-semibold`} style={{ color: dayNumberColor }}>{dayNumber}</span>
          <div className="flex items-center gap-1">
            {hasCurrentUserWeight ? (
              <span
                className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border px-1 text-[8px] font-semibold leading-none"
                title="Weight recorded"
                style={{
                  borderColor: "color-mix(in srgb, var(--mountain-blue-glow) 56%, var(--border))",
                  backgroundColor: "color-mix(in srgb, var(--mountain-blue-glow) 18%, var(--surface))",
                  color: "var(--mountain-blue-glow)",
                }}
              >
                W
              </span>
            ) : null}
            {hasCurrentUserCheckIn ? (
              <span
                className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border px-1 text-[8px] font-semibold leading-none"
                title="Workout recorded"
                style={{
                  borderColor: "color-mix(in srgb, var(--cultivator-self) 56%, var(--border))",
                  backgroundColor: "color-mix(in srgb, var(--cultivator-self) 16%, var(--surface))",
                  color: "var(--cultivator-self)",
                }}
              >
                ✓
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-end justify-between gap-1">
          <div className="flex items-center gap-1">
            {visibleDots.map((u) => (
              <span
                key={u.id}
                title={u.name}
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: u.color }}
              />
            ))}
            {extraCount > 0 ? <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>+{extraCount}</span> : null}
          </div>

          {(hasNote || hasFutureNote) ? (
            hasFutureNote ? (
              <span className="text-[9px]" style={{ color: "var(--gold)" }}>✦</span>
            ) : (
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="h-2.5 w-2.5"
                style={{ color: "var(--accent)" }}
              >
                <path
                  fill="currentColor"
                  d="M11.4 1.7a1.6 1.6 0 0 1 2.3 0l.6.6a1.6 1.6 0 0 1 0 2.3L5.9 13H3v-2.9l8.4-8.4Zm1.2 1.1L11.5 3.9l1.6 1.6 1.1-1.1-1.6-1.6Z"
                />
              </svg>
            )
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}

// ── Calendar Widget ──

export function Calendar({
  checkInUsersByDate,
  currentUserWeightDates,
  currentMonth,
  setCurrentMonth,
  dayNotes,
  futureNoteDates,
  onDayClick,
  allUsers,
  userColors,
  upcomingNotes,
  dateFormat = "dd-mmm-yyyy",
  onManageNotes,
  forceCompact = false,
  timeZone,
  calendarWeekStart = "sunday",
  currentUserId,
}: {
  checkInUsersByDate: Map<string, string[]>;
  currentUserWeightDates?: Set<string>;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  dayNotes?: Map<string, string>;
  futureNoteDates?: Set<string>;
  onDayClick?: (date: string) => void;
  allUsers: DashboardUser[];
  userColors: Record<string, string>;
  upcomingNotes?: DashboardUpcomingNote[];
  dateFormat?: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy";
  onManageNotes?: () => void;
  forceCompact?: boolean;
  timeZone?: string;
  calendarWeekStart?: CalendarWeekStartOption;
  currentUserId?: string;
}) {
  const isMobile = useIsMobile();
  const compactMode = isMobile || forceCompact;
  const { year: currentYear, month: currentMonthNumber } = getTimeZoneDateParts(currentMonth, timeZone);
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonthNumber, 0)).getUTCDate();
  const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonthNumber - 1, 1)).getUTCDay();
  const weekStartsOn = resolveCalendarWeekStartsOn(calendarWeekStart, timeZone);
  const leadingBlankDays = (firstDayOfMonth - weekStartsOn + 7) % 7;
  const days: Array<{ dateStr: string; dayNumber: number; isOutsideMonth: boolean }> = [];
  const today = formatDateLocalForZone(new Date(), timeZone);
  const weekdayHeaders = weekStartsOn === 1
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const navButtonClass = "theme-control-btn rounded-md border px-2.5 py-1 text-xs transition-colors";
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);

  const goToPreviousMonth = () => {
    const previousMonth = currentMonthNumber === 1 ? 12 : currentMonthNumber - 1;
    const previousYear = currentMonthNumber === 1 ? currentYear - 1 : currentYear;
    setCurrentMonth(createCalendarMonthAnchor(previousYear, previousMonth));
  };

  const goToNextMonth = () => {
    const nextMonth = currentMonthNumber === 12 ? 1 : currentMonthNumber + 1;
    const nextYear = currentMonthNumber === 12 ? currentYear + 1 : currentYear;
    setCurrentMonth(createCalendarMonthAnchor(nextYear, nextMonth));
  };

  const onCalendarTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchCurrentXRef.current = touchStartXRef.current;
    touchCurrentYRef.current = touchStartYRef.current;
  };

  const onCalendarTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    touchCurrentXRef.current = event.touches[0]?.clientX ?? null;
    touchCurrentYRef.current = event.touches[0]?.clientY ?? null;
  };

  const onCalendarTouchEnd = () => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const endX = touchCurrentXRef.current;
    const endY = touchCurrentYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchCurrentXRef.current = null;
    touchCurrentYRef.current = null;

    if (startX == null || startY == null || endX == null || endY == null) return;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const isHorizontalSwipe = Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!isHorizontalSwipe) return;

    if (deltaX < 0) {
      goToNextMonth();
      return;
    }
    goToPreviousMonth();
  };

  const previousMonthNumber = currentMonthNumber === 1 ? 12 : currentMonthNumber - 1;
  const previousYear = currentMonthNumber === 1 ? currentYear - 1 : currentYear;
  const nextMonthNumber = currentMonthNumber === 12 ? 1 : currentMonthNumber + 1;
  const nextYear = currentMonthNumber === 12 ? currentYear + 1 : currentYear;
  const daysInPreviousMonth = new Date(Date.UTC(previousYear, previousMonthNumber, 0)).getUTCDate();

  for (let i = leadingBlankDays; i > 0; i--) {
    const dayNumber = daysInPreviousMonth - i + 1;
    const dateStr = `${previousYear}-${String(previousMonthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
    days.push({ dateStr, dayNumber, isOutsideMonth: true });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentYear}-${String(currentMonthNumber).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    days.push({ dateStr, dayNumber: i, isOutsideMonth: false });
  }

  const trailingDays = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= trailingDays; i++) {
    const dateStr = `${nextYear}-${String(nextMonthNumber).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    days.push({ dateStr, dayNumber: i, isOutsideMonth: true });
  }

  return (
    <div
      className={`dao-modern-calendar ${compactMode ? "p-2.5" : "p-4"} min-w-0 space-y-3 overflow-hidden rounded-xl border`}
      style={{
        borderColor: "color-mix(in srgb, var(--border) 94%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
        boxShadow: "0 1px 0 color-mix(in srgb, var(--text-primary) 3%, transparent) inset",
      }}
      onTouchStart={onCalendarTouchStart}
      onTouchMove={onCalendarTouchMove}
      onTouchEnd={onCalendarTouchEnd}
    >
      <div className={`flex items-center justify-between gap-3 border-b ${compactMode ? "pb-2" : "pb-3"}`} style={{ borderBottomColor: "color-mix(in srgb, var(--border) 94%, transparent)" }}>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Check-In Calendar</p>
          <h3 className="mt-0.5 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            {formatCalendarMonthLabel(currentMonth, timeZone)}
          </h3>
        </div>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className={navButtonClass}
            aria-label="Previous month"
          >
            {compactMode ? "←" : "← Prev"}
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className={navButtonClass}
            aria-label="Next month"
          >
            {compactMode ? "→" : "Next →"}
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-7 ${compactMode ? "gap-1 mb-1" : "gap-2 mb-2"}`}>
        {weekdayHeaders.map((day) => (
          <div key={day} className={`text-center ${compactMode ? "text-[10px]" : "text-xs"} font-semibold uppercase tracking-wider`} style={{ color: "var(--text-secondary)" }}>
            {compactMode ? day[0] : day}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${compactMode ? "gap-1" : "gap-2"} min-w-0`}>
        {days.map((date, i) => (
          <div key={i}>
            <CalendarDay
              dayNumber={date.dayNumber}
              checkedInUsers={
                (checkInUsersByDate.get(date.dateStr) || []).map(uid => {
                  const u = allUsers.find(usr => usr.id === uid);
                  const isCurrentUser = uid === currentUserId;
                  return {
                    id: uid,
                    name: u?.name || "Unknown",
                    color: isCurrentUser ? "var(--cultivator-self)" : "var(--cultivator-friend)",
                    isCurrentUser,
                  };
                })
              }
              hasCurrentUserWeight={currentUserWeightDates?.has(date.dateStr)}
              isToday={date.dateStr === today}
              isPast={date.dateStr < today}
              hasNote={dayNotes?.has(date.dateStr)}
              hasFutureNote={futureNoteDates?.has(date.dateStr)}
              isOutsideMonth={date.isOutsideMonth}
              compact={compactMode}
              onClick={() => onDayClick?.(date.dateStr)}
            />
          </div>
        ))}
      </div>

      {upcomingNotes && upcomingNotes.length > 0 && (
        <div className="pt-3 border-t border-ink-light/30 space-y-2.5">
          <div className="flex items-center gap-2">
            <h4 className={`${compactMode ? "text-[11px]" : "text-xs"} text-gold-glow uppercase tracking-wide font-semibold`}>Upcoming Notes</h4>
            {!!upcomingNotes?.length && (
              <span className="text-[9px] text-gold-glow bg-gold-dim/20 px-2 py-0.5 rounded-full font-medium">{upcomingNotes.length}</span>
            )}
            {onManageNotes && (
              <button
                onClick={onManageNotes}
                className="ml-auto text-[10px] text-gold-light/70 hover:text-gold-glow transition-colors hover:underline"
                title="Manage notes in Sect Register"
              >
                Manage &rarr;
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {upcomingNotes.map((note) => {
              const noteColor = note.user.id === currentUserId ? "var(--cultivator-self)" : "var(--cultivator-friend)";
              return (
                <button
                  key={note.id}
                  onClick={() => onDayClick?.(note.date)}
                  className="w-full text-left p-2 border border-ink-light/45 bg-ink-dark/20 hover:bg-ink-mid/20 hover:border-gold-dim/45 transition-all duration-200"
                  title="Jump to this date"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: noteColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-semibold truncate" style={{ color: noteColor }}>{note.user.name}</span>
                        <span className="text-[9px] text-mist-mid bg-ink-mid/40 px-1.5 py-0.5 rounded">
                          {formatDateWithPreference(note.date, dateFormat)}
                        </span>
                      </div>
                      <p className="text-[10px] text-mist-light leading-relaxed line-clamp-2">{note.content}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`flex flex-wrap border-t pt-3 ${compactMode ? "gap-2 text-[10px]" : "gap-3 text-xs"}`} style={{ borderTopColor: "color-mix(in srgb, var(--border) 94%, transparent)" }}>
        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <div className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: "color-mix(in srgb, var(--accent) 86%, var(--border))", backgroundColor: "color-mix(in srgb, var(--accent) 22%, var(--surface-hover))" }} />
          <span>{t("Today", "normal")}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="h-3 w-3"
            style={{ color: "var(--accent)" }}
          >
            <path
              fill="currentColor"
              d="M11.4 1.7a1.6 1.6 0 0 1 2.3 0l.6.6a1.6 1.6 0 0 1 0 2.3L5.9 13H3v-2.9l8.4-8.4Zm1.2 1.1L11.5 3.9l1.6 1.6 1.1-1.1-1.6-1.6Z"
            />
          </svg>
          <span>{t("Note", "normal")}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <div
            className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border px-1 text-[8px] font-semibold leading-none"
            style={{
              borderColor: "color-mix(in srgb, var(--mountain-blue-glow) 56%, var(--border))",
              backgroundColor: "color-mix(in srgb, var(--mountain-blue-glow) 18%, var(--surface))",
              color: "var(--mountain-blue-glow)",
            }}
          >
            W
          </div>
          <span>{t("Weight", "normal")}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <div
            className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border px-1 text-[8px] font-semibold leading-none"
            style={{
              borderColor: "color-mix(in srgb, var(--cultivator-self) 56%, var(--border))",
              backgroundColor: "color-mix(in srgb, var(--cultivator-self) 16%, var(--surface))",
              color: "var(--cultivator-self)",
            }}
          >
            ✓
          </div>
          <span>{t("Workout", "normal")}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <div className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: "color-mix(in srgb, var(--cultivator-self) 62%, var(--border))", backgroundColor: "color-mix(in srgb, var(--cultivator-self) 12%, var(--surface))" }} />
          <span>{t("You", "normal")}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--cultivator-friend)" }} />
          <span>{t("Friend", "normal")}</span>
        </div>
      </div>
    </div>
  );
}
