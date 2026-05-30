import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import type { Theme } from "@/lib/config";
import {
  findUserSettingsByUserId,
  upsertUserSettings,
} from "@/lib/repositories/user.repository";

type ActivityLogEntry = {
  at: string;
  label: string;
  route: string;
};

type StoredAppPreferences = {
  theme?: "dark" | "light";
  themeStyle?: Theme;
  cultivatorColor?: string;
  lastActivityAt?: string;
  lastActivityLabel?: string;
  lastActivityRoute?: string;
  activityLog?: ActivityLogEntry[];
  activityEvent?: Partial<ActivityLogEntry>;
  [key: string]: unknown;
};

function parseJsonObject(
  value: string | null | undefined
): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid payloads and fallback to defaults
  }
  return null;
}

function normalizeActivityEntry(value: unknown): ActivityLogEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const rawAt = "at" in value ? value.at : null;
  const rawLabel = "label" in value ? value.label : null;
  const rawRoute = "route" in value ? value.route : null;

  const at = typeof rawAt === "string" ? rawAt.trim() : "";
  const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
  const route = typeof rawRoute === "string" ? rawRoute.trim() : "";

  if (!at || !label || !route) return null;
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    at: parsed.toISOString(),
    label,
    route,
  };
}

export const GET = withAuth(async (_req, { auth }) => {
  try {
    const userId = auth.userId;

    const existing = await findUserSettingsByUserId(userId);
    if (!existing) {
      return apiSuccess({ appPrefs: null, displaySettings: null });
    }

    const appPrefs = parseJsonObject(existing.pinnedNavItems);
    const displaySettings = parseJsonObject(existing.hiddenNavItems);

    return apiSuccess({ appPrefs, displaySettings });
  } catch (error) {
    console.error("Preferences fetch error:", error);
    return ApiErrors.internal("Failed to fetch preferences");
  }
});

export const PUT = withAuth(async (req, { auth }) => {
  try {
    const body = await req.json();
    const requestedUserId =
      typeof body.userId === "string" && body.userId.trim().length > 0
        ? body.userId.trim()
        : auth.userId;

    const userId = auth.role === "admin" ? requestedUserId : auth.userId;

    const existing = await findUserSettingsByUserId(userId);

    const appPrefsInput = body.appPrefs;
    const displaySettingsInput = body.displaySettings;

    const existingAppPrefs = (parseJsonObject(existing?.pinnedNavItems) ?? null) as StoredAppPreferences | null;
    const incomingAppPrefs =
      appPrefsInput &&
      typeof appPrefsInput === "object" &&
      !Array.isArray(appPrefsInput)
        ? (appPrefsInput as StoredAppPreferences)
        : null;

    const incomingActivityEvent = normalizeActivityEntry(incomingAppPrefs?.activityEvent);
    const existingActivityLog = Array.isArray(existingAppPrefs?.activityLog)
      ? existingAppPrefs.activityLog.map((entry) => normalizeActivityEntry(entry)).filter((entry): entry is ActivityLogEntry => Boolean(entry))
      : [];

    let appPrefs = incomingAppPrefs
      ? ({ ...(existingAppPrefs ?? {}), ...incomingAppPrefs } as StoredAppPreferences)
      : (existingAppPrefs as StoredAppPreferences | null);

    if (appPrefs && "activityEvent" in appPrefs) {
      delete appPrefs.activityEvent;
    }

    if (incomingActivityEvent) {
      appPrefs = {
        ...(appPrefs ?? {}),
        lastActivityAt: incomingActivityEvent.at,
        lastActivityLabel: incomingActivityEvent.label,
        lastActivityRoute: incomingActivityEvent.route,
        activityLog: [
          incomingActivityEvent,
          ...existingActivityLog.filter(
            (entry) => !(entry.at === incomingActivityEvent.at && entry.route === incomingActivityEvent.route && entry.label === incomingActivityEvent.label),
          ),
        ].slice(0, 40),
      };
    }

    const displaySettings =
      displaySettingsInput &&
      typeof displaySettingsInput === "object" &&
      !Array.isArray(displaySettingsInput)
        ? (displaySettingsInput as Record<string, unknown>)
        : (parseJsonObject(existing?.hiddenNavItems) ?? null);

    await upsertUserSettings({
      userId,
      pinnedNavItems: JSON.stringify(appPrefs ?? {}),
      hiddenNavItems: JSON.stringify(displaySettings ?? {}),
      panelPosition: existing?.panelPosition,
      dualPageView: existing?.dualPageView,
      combinedView: existing?.combinedView,
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Preferences save error:", error);
    return ApiErrors.internal("Failed to save preferences");
  }
});
