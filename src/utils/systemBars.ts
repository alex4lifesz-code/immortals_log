"use client";

import { normalizeToHex, shouldUseDarkIcons } from "@/utils/colorConversion";

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
  if (typeof window === "undefined") return;
  const hex = normalizeToHex(color);
  if (!hex) return;

  // Web runtime: expose resolved values for optional diagnostics/future integrations.
  document.documentElement.style.setProperty("--resolved-status-bar-color", hex);
  document.documentElement.style.setProperty("--resolved-status-bar-dark-icons", shouldUseDarkIcons(hex) ? "1" : "0");
}

export async function setNavigationBarColor(color: string) {
  if (typeof window === "undefined") return;
  const hex = normalizeToHex(color);
  if (!hex) return;
  await setNavigationBarViaBridge(hex, shouldUseDarkIcons(hex));
}

export async function syncSystemBars(statusColor: string, navColor: string) {
  await Promise.all([setStatusBarColor(statusColor), setNavigationBarColor(navColor)]);
}
