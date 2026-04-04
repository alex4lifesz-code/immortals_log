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
  { id: "rank-up", label: NAV_LABELS["rank-up"], icon: "⬆️", path: DASHBOARD_ROUTES.rankUp, pinned: false, visible: true },
  { id: "history", label: NAV_LABELS.history, icon: "📜", path: DASHBOARD_ROUTES.workoutHistory, pinned: false, visible: true },
  { id: "checkin", label: NAV_LABELS.checkin, icon: "📋", path: DASHBOARD_ROUTES.attendance, pinned: false, visible: true },
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

import type { DateFormatOption } from "@/context/DisplaySettingsContext";

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a date string (YYYY-MM-DD) or Date object using the user's chosen format.
 */
export function formatDateWithPreference(dateInput: string | Date, format: DateFormatOption): string {
  const date = (() => {
    if (typeof dateInput !== "string") {
      return dateInput;
    }

    const trimmed = dateInput.trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T00:00:00`)
      : new Date(trimmed);

    return parsed;
  })();

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const mmm = MONTH_NAMES_SHORT[date.getMonth()];
  const yyyy = String(date.getFullYear());
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
