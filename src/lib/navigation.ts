export const DASHBOARD_ROUTES = {
  root: "/dashboard",
  main: "/dashboard/main",
  overview: "/dashboard/overview",
  community: "/dashboard/community",
  workoutHistory: "/dashboard/workout-history",
  attendance: "/dashboard/attendance",
  exercises: "/dashboard/exercises",
  friends: "/dashboard/friends",
  settings: "/dashboard/settings",
  admin: "/dashboard/admin",
  checkinLegacy: "/dashboard/checkin",
} as const;

export const MOBILE_DASHBOARD_ROUTES = {
  home: "/dashboard/mobile",
  training: "/dashboard/mobile/training",
  checkIn: "/dashboard/mobile/check-in",
  progress: "/dashboard/mobile/progress",
  theme: "/dashboard/mobile/profile/settings/theme",
} as const;

export const NAV_LABELS: Record<string, string> = {
  main: "Navigation Hub",
  dashboard: "Overview",
  newsfeed: "Community Feed",
  history: "Workout History",
  checkin: "Attendance",
  "exercise-db": "Exercise Library",
  friends: "Friends",
  settings: "Settings",
  admin: "Admin Panel",
};

export const MOBILE_PRIMARY_NAV_IDS: readonly string[] = [
  "dashboard",
  "main",
  "history",
  "friends",
];

export const MAIN_NAV_IDS_ORDER: readonly string[] = [
  "dashboard",
  "main",
  "history",
  "exercise-db",
  "friends",
  "newsfeed",
  "settings",
];

export const ADMIN_NAV_IDS_ORDER: readonly string[] = [
  "checkin",
  "admin",
];

export function sortNavItemsByIdOrder<T extends { id: string }>(items: T[], orderedIds: readonly string[]): T[] {
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.id.localeCompare(b.id);
  });
}

export const MOBILE_BOTTOM_TABS = [
  { href: MOBILE_DASHBOARD_ROUTES.home, label: "Home", icon: "\u2302" },
  { href: MOBILE_DASHBOARD_ROUTES.training, label: "Training", icon: "\u2694" },
  { href: MOBILE_DASHBOARD_ROUTES.checkIn, label: "Check-In", icon: "\u270e" },
  { href: MOBILE_DASHBOARD_ROUTES.progress, label: "Progress", icon: "\u25c9" },
  { href: MOBILE_DASHBOARD_ROUTES.theme, label: "Theme", icon: "\u25e8" },
] as const;
