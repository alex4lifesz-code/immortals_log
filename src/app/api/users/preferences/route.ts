import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type StoredAppPreferences = {
  theme?: "dark" | "light";
  themeStyle?: "midnight-ink" | "mountain-mist" | "calligraphy" | "sakura" | "sakura-dark";
};

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
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

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const existing = await prisma.userSettings.findUnique({ where: { userId } });
    if (!existing) {
      return NextResponse.json({ appPrefs: null, displaySettings: null });
    }

    const appPrefs = parseJsonObject(existing.pinnedNavItems);
    const displaySettings = parseJsonObject(existing.hiddenNavItems);

    return NextResponse.json({ appPrefs, displaySettings });
  } catch (error) {
    console.error("Preferences fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const existing = await prisma.userSettings.findUnique({ where: { userId } });

    const appPrefsInput = body.appPrefs;
    const displaySettingsInput = body.displaySettings;

    const appPrefs =
      appPrefsInput && typeof appPrefsInput === "object" && !Array.isArray(appPrefsInput)
        ? (appPrefsInput as StoredAppPreferences)
        : parseJsonObject(existing?.pinnedNavItems) ?? null;

    const displaySettings =
      displaySettingsInput && typeof displaySettingsInput === "object" && !Array.isArray(displaySettingsInput)
        ? (displaySettingsInput as Record<string, unknown>)
        : parseJsonObject(existing?.hiddenNavItems) ?? null;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Preferences save error:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
