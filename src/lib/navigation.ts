export const DASHBOARD_ROUTES = {
  root: "/dashboard",
  main: "/dashboard/main",
  overview: "/dashboard",
  community: "/dashboard/community",
  rankUp: "/dashboard/completionist",
  workoutHistory: "/dashboard/train",
  trainingLogHistory: "/dashboard/training-log-history",
  checkIn: "/dashboard/check-in",
  attendance: "/dashboard/attendance",
  exercises: "/dashboard/exercises",
  friends: "/dashboard/friends",
  profile: "/dashboard/profile",
  settings: "/dashboard/settings",
  admin: "/dashboard/admin",
  websiteInformation: "/dashboard/website-information",
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
  dashboard: "Home",
  newsfeed: "Community Feed",
  "rank-up": "Completionist",
  history: "Train",
  "training-log-history": "History",
  checkin: "Check-In",
  "exercise-db": "Exercise Library",
  friends: "Friends",
  settings: "Settings",
  admin: "Admin Panel",
  "website-information": "Website Information",
};

export const MOBILE_PRIMARY_NAV_IDS: readonly string[] = [
  "dashboard",
  "checkin",
  "history",
];

export const MOBILE_MORE_NAV_IDS_ORDER: readonly string[] = [
  "training-log-history",
  "newsfeed",
  "friends",
  "exercise-db",
  "settings",
  "main",
];

export const MAIN_NAV_IDS_ORDER: readonly string[] = [
  "dashboard",
  "checkin",
  "history",
  "rank-up",
  "training-log-history",
  "newsfeed",
  "friends",
  "exercise-db",
  "settings",
];

export const ADMIN_NAV_IDS_ORDER: readonly string[] = [
  "website-information",
  "admin",
];

export const ADMIN_NAV_IDS = new Set(ADMIN_NAV_IDS_ORDER);

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
  { href: MOBILE_DASHBOARD_ROUTES.checkIn, label: "Check-In", icon: "\u270e" },
  { href: MOBILE_DASHBOARD_ROUTES.training, label: "Training", icon: "\u2694" },
  { href: MOBILE_DASHBOARD_ROUTES.theme, label: "Theme", icon: "\u25e8" },
] as const;
