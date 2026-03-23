"use client";

import { isNativePlatform } from "@/lib/platform";
import { normalizeToHex, shouldUseDarkIcons } from "@/utils/colorConversion";

let StatusBarModule: typeof import("@capacitor/status-bar") | null = null;

async function getStatusBar() {
  if (StatusBarModule) return StatusBarModule;
  try {
    StatusBarModule = await import("@capacitor/status-bar");
    return StatusBarModule;
  } catch {
    return null;
  }
}

async function setNavigationBarViaBridge(hex: string, darkIcons: boolean) {
  if (typeof window === "undefined") return;
  const globalAny = window as unknown as {
    NavigationBar?: { setColor?: (args: { color: string; darkButtons: boolean }) => Promise<void> | void };
    Capacitor?: { Plugins?: Record<string, { setColor?: (args: { color: string; darkButtons: boolean }) => Promise<void> | void }> };
  };

  const navBridge = globalAny.NavigationBar || globalAny.Capacitor?.Plugins?.NavigationBar;
  if (!navBridge?.setColor) return;

  try {
    await navBridge.setColor({ color: hex, darkButtons: darkIcons });
  } catch {
    // Optional bridge.
  }
}

export async function setStatusBarColor(color: string) {
  if (!isNativePlatform()) return;
  const hex = normalizeToHex(color);
  if (!hex) return;

  const statusBar = await getStatusBar();
  if (!statusBar) return;

  try {
    await statusBar.StatusBar.setBackgroundColor({ color: hex });
    await statusBar.StatusBar.setStyle({ style: shouldUseDarkIcons(hex) ? statusBar.Style.Light : statusBar.Style.Dark });
  } catch {
    // Best effort.
  }
}

export async function setNavigationBarColor(color: string) {
  if (!isNativePlatform()) return;
  const hex = normalizeToHex(color);
  if (!hex) return;
  await setNavigationBarViaBridge(hex, shouldUseDarkIcons(hex));
}

export async function syncSystemBars(statusColor: string, navColor: string) {
  await Promise.all([setStatusBarColor(statusColor), setNavigationBarColor(navColor)]);
}
