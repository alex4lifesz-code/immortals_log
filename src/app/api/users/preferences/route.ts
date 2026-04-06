import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import type { Theme } from "@/lib/config";

type StoredAppPreferences = {
  theme?: "dark" | "light";
  themeStyle?: Theme;
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

export const GET = withAuth(async (_req, { auth }) => {
  try {
    const userId = auth.userId;

    const existing = await prisma.userSettings.findUnique({
      where: { userId },
    });
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

    const existing = await prisma.userSettings.findUnique({
      where: { userId },
    });

    const appPrefsInput = body.appPrefs;
    const displaySettingsInput = body.displaySettings;

    const existingAppPrefs = parseJsonObject(existing?.pinnedNavItems) ?? null;
    const appPrefs =
      appPrefsInput &&
      typeof appPrefsInput === "object" &&
      !Array.isArray(appPrefsInput)
        ? ({ ...(existingAppPrefs ?? {}), ...(appPrefsInput as StoredAppPreferences) } as StoredAppPreferences)
        : (existingAppPrefs as StoredAppPreferences | null);

    const displaySettings =
      displaySettingsInput &&
      typeof displaySettingsInput === "object" &&
      !Array.isArray(displaySettingsInput)
        ? (displaySettingsInput as Record<string, unknown>)
        : (parseJsonObject(existing?.hiddenNavItems) ?? null);

    await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        pinnedNavItems: JSON.stringify(appPrefs ?? {}),
        hiddenNavItems: JSON.stringify(displaySettings ?? {}),
        panelPosition: existing?.panelPosition ?? "left",
        dualPageView: existing?.dualPageView ?? false,
        combinedView: existing?.combinedView ?? false,
      },
      update: {
        pinnedNavItems: JSON.stringify(appPrefs ?? {}),
        hiddenNavItems: JSON.stringify(displaySettings ?? {}),
      },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Preferences save error:", error);
    return ApiErrors.internal("Failed to save preferences");
  }
});
