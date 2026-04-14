// Navigation items configuration
import { DASHBOARD_ROUTES, NAV_LABELS } from "@/lib/navigation";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  pinned: boolean;
  visible: boolean;
}

export const defaultNavItems: NavItem[] = [
  { id: "dashboard", label: NAV_LABELS.dashboard, icon: "⛩️", path: DASHBOARD_ROUTES.overview, pinned: false, visible: true },
  { id: "newsfeed", label: NAV_LABELS.newsfeed, icon: "🌿", path: DASHBOARD_ROUTES.community, pinned: false, visible: true },
  { id: "rank-up", label: NAV_LABELS["rank-up"], icon: "🏆", path: DASHBOARD_ROUTES.rankUp, pinned: false, visible: true },
  { id: "history", label: NAV_LABELS.history, icon: "📜", path: DASHBOARD_ROUTES.workoutHistory, pinned: false, visible: true },
  { id: "training-log-history", label: NAV_LABELS["training-log-history"], icon: "🕘", path: DASHBOARD_ROUTES.trainingLogHistory, pinned: false, visible: true },
  { id: "checkin", label: NAV_LABELS.checkin, icon: "📋", path: DASHBOARD_ROUTES.checkIn, pinned: false, visible: true },
  { id: "exercise-db", label: NAV_LABELS["exercise-db"], icon: "📚", path: DASHBOARD_ROUTES.exercises, pinned: false, visible: true },
  { id: "friends", label: NAV_LABELS.friends, icon: "🤝", path: DASHBOARD_ROUTES.friends, pinned: false, visible: true },
  { id: "settings", label: NAV_LABELS.settings, icon: "⚙️", path: DASHBOARD_ROUTES.settings, pinned: false, visible: true },
  { id: "website-information", label: NAV_LABELS["website-information"], icon: "🗂️", path: DASHBOARD_ROUTES.websiteInformation, pinned: false, visible: true },
  { id: "admin", label: NAV_LABELS.admin, icon: "👑", path: DASHBOARD_ROUTES.admin, pinned: false, visible: true },
];

export function getDifficultyColor(difficulty: string): string {
  void difficulty;
  return "text-mist-light";
}

export function getDifficultyGlow(difficulty: string): string {
  void difficulty;
  return "";
}

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    "Upper Heaven": "text-mountain-blue-glow",
    "Lower Realms": "text-crimson",
    "Heart Meridian": "text-jade-glow",
    "Unified Realm": "text-gold",
  };
  return colors[type] || "text-mist-light";
}

export function getTargetGroupColor(targetGroup: string): string {
  const colors: Record<string, string> = {
    "Iron Body Conditioning": "text-difficulty-amber",
    "Lightfoot Movement": "text-mountain-blue-glow",
    "Meridian Flow": "text-jade-glow",
    "Inner Strength": "text-crimson",
    "Sword Forms": "text-difficulty-violet",
    "Palm Techniques": "text-gold",
    "Breathing Arts": "text-difficulty-light-pink",
    "Mental Cultivation": "text-difficulty-pink",
    "Energy Circulation": "text-jade-deep",
    "Combat Reflexes": "text-crimson-glow",
  };
  return colors[targetGroup] || "text-mist-light";
}

// Day assignment constants and utilities
export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday", 
  "Tuesday",
  "Wednesday", 
  "Thursday",
  "Friday",
  "Saturday"
] as const;

export const DAY_ABBREVIATIONS = [
  "Sun",
  "Mon",
  "Tue", 
  "Wed",
  "Thu",
  "Fri",
  "Sat"
] as const;

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

// Utility functions for day assignments
export function parseDayAssignments(assignedDays: string): number[] {
  if (!assignedDays || assignedDays.trim() === "") return [];
  return assignedDays.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d));
}

export function serializeDayAssignments(days: number[]): string {
  return days.filter(d => d >= 0 && d <= 6).sort().join(",");
}

export function isDayAssigned(assignedDays: string, dayIndex: number): boolean {
  const assignedDayNumbers = parseDayAssignments(assignedDays);
  return assignedDayNumbers.includes(dayIndex);
}

export function toggleDayAssignment(assignedDays: string, dayIndex: number): string {
  const assignedDayNumbers = parseDayAssignments(assignedDays);
  if (assignedDayNumbers.includes(dayIndex)) {
    return serializeDayAssignments(assignedDayNumbers.filter(d => d !== dayIndex));
  } else {
    return serializeDayAssignments([...assignedDayNumbers, dayIndex]);
  }
}

export function formatAssignedDays(assignedDays: string): string {
  const dayNumbers = parseDayAssignments(assignedDays);
  if (dayNumbers.length === 0) return "No days assigned";
  if (dayNumbers.length === 7) return "Every day";
  return dayNumbers.map(d => DAY_ABBREVIATIONS[d]).join(", ");
}

// ── Configurable Date Formatting ──

import type {
  CalendarWeekStartOption,
  DateFormatOption,
} from "@/context/DisplaySettingsContext";

const DISPLAY_SETTINGS_STORAGE_KEY = "cultivateos-display-settings";
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function readStoredTimeZone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timeZone?: string };
    return typeof parsed.timeZone === "string" ? parsed.timeZone : null;
  } catch {
    return null;
  }
}

export function resolvePreferredTimeZone(timeZone?: string): string {
  const candidates = [timeZone, readStoredTimeZone()];

  try {
    candidates.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    // Ignore environment timezone lookup failures.
  }

  for (const candidate of candidates) {
    if (candidate && isValidTimeZone(candidate)) {
      return candidate;
    }
  }

  return "UTC";
}

export function getTimeZoneDateParts(date: Date, timeZone?: string): { year: number; month: number; day: number } {
  const tz = resolvePreferredTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(lookup.year ?? "0", 10),
    month: Number.parseInt(lookup.month ?? "1", 10),
    day: Number.parseInt(lookup.day ?? "1", 10),
  };
}

export function getTimeZoneDateTimeParts(
  date: Date,
  timeZone?: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const tz = resolvePreferredTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const rawHour = Number.parseInt(lookup.hour ?? "0", 10);

  return {
    year: Number.parseInt(lookup.year ?? "0", 10),
    month: Number.parseInt(lookup.month ?? "1", 10),
    day: Number.parseInt(lookup.day ?? "1", 10),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number.parseInt(lookup.minute ?? "0", 10),
    second: Number.parseInt(lookup.second ?? "0", 10),
  };
}

export function formatDateLocal(date: Date, timeZone?: string): string {
  const parts = getTimeZoneDateParts(date, timeZone);
  const year = String(parts.year);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayInTimeZone(timeZone?: string): string {
  return formatDateLocal(new Date(), timeZone);
}

export function getPreferredLocaleForTimeZone(timeZone?: string): string {
  const tz = resolvePreferredTimeZone(timeZone);

  if (tz.startsWith("Australia/")) return "en-AU";
  if (tz === "Pacific/Auckland") return "en-NZ";
  if (tz === "Asia/Ho_Chi_Minh") return "vi-VN";
  if (tz === "Asia/Bangkok") return "th-TH";
  if (tz.startsWith("Europe/")) return "en-GB";
  if (tz.startsWith("America/")) return "en-US";

  return "en-US";
}

export function resolveCalendarWeekStartsOn(
  option: CalendarWeekStartOption = "auto",
  timeZone?: string,
): 0 | 1 {
  if (option === "monday") return 1;
  if (option === "sunday") return 0;

  const locale = getPreferredLocaleForTimeZone(timeZone);

  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay?: number };
      getWeekInfo?: () => { firstDay?: number };
    };
    const firstDay = intlLocale.weekInfo?.firstDay ?? intlLocale.getWeekInfo?.().firstDay;
    if (firstDay === 7) return 0;
    if (firstDay === 1) return 1;
  } catch {
    // Ignore locale week metadata failures.
  }

  return locale === "en-US" ? 0 : 1;
}

export function formatCalendarMonthLabel(date: Date, timeZone?: string): string {
  const tz = resolvePreferredTimeZone(timeZone);
  return new Intl.DateTimeFormat(getPreferredLocaleForTimeZone(tz), {
    timeZone: tz,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function createCalendarMonthAnchor(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0));
}

export function buildIsoAtUserDateTime(
  dateValue: string,
  timeZone?: string,
  options?: Partial<{ hour: number; minute: number; second: number; millisecond: number }>,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return undefined;

  const [year, month, day] = dateValue.split("-").map((value) => Number.parseInt(value, 10));
  const tz = resolvePreferredTimeZone(timeZone);
  const nowParts = getTimeZoneDateTimeParts(new Date(), tz);
  const hour = options?.hour ?? nowParts.hour;
  const minute = options?.minute ?? nowParts.minute;
  const second = options?.second ?? nowParts.second;
  const millisecond = options?.millisecond ?? 0;

  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const desiredLocalEpoch = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  for (let index = 0; index < 3; index += 1) {
    const actual = getTimeZoneDateTimeParts(guess, tz);
    const actualLocalEpoch = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      millisecond,
    );
    const diff = desiredLocalEpoch - actualLocalEpoch;
    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }

  return guess.toISOString();
}

/**
 * Format a date string (YYYY-MM-DD) or Date object using the user's chosen format.
 */
export function formatDateWithPreference(
  dateInput: string | Date,
  format: DateFormatOption,
  timeZone?: string,
): string {
  const parts = (() => {
    if (typeof dateInput !== "string") {
      if (Number.isNaN(dateInput.getTime())) return null;
      return getTimeZoneDateParts(dateInput, timeZone);
    }

    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map((value) => Number.parseInt(value, 10));
      return { year, month, day };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return getTimeZoneDateParts(parsed, timeZone);
  })();

  if (!parts) {
    return "-";
  }

  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  const mmm = MONTH_NAMES_SHORT[parts.month - 1];
  const yyyy = String(parts.year);
  const yy = yyyy.slice(-2);

  switch (format) {
    case "dd-mm-yyyy":
      return `${dd}-${mm}-${yyyy}`;
    case "dd-mmm-yyyy":
      return `${dd}-${mmm}-${yyyy}`;
    case "dd-mm-yy":
      return `${dd}-${mm}-${yy}`;
    case "dd-mmm-yy":
      return `${dd}-${mmm}-${yy}`;
    default:
      return `${dd}-${mmm}-${yyyy}`;
  }
}
