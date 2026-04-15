"use client";

import { normalizeToHex, shouldUseDarkIcons } from "@/utils/colorConversion";

type NavigationBarBridge = {
  setColor?: (args: { color: string; darkButtons: boolean }) => Promise<void> | void;
};

type StatusBarBridge = {
  setBackgroundColor?: (args: { color: string }) => Promise<void> | void;
  setStyle?: (args: { style: "LIGHT" | "DARK" | string }) => Promise<void> | void;
  setOverlaysWebView?: (args: { overlay: boolean }) => Promise<void> | void;
};

function getSystemBarBridges() {
  if (typeof window === "undefined") {
    return { navBridge: undefined, statusBridge: undefined } as {
      navBridge: NavigationBarBridge | undefined;
      statusBridge: StatusBarBridge | undefined;
    };
  }

  const globalAny = window as unknown as {
    NavigationBar?: NavigationBarBridge;
    StatusBar?: StatusBarBridge;
    Capacitor?: {
      Plugins?: Record<string, NavigationBarBridge | StatusBarBridge | undefined>;
    };
  };

  return {
    navBridge: (globalAny.NavigationBar || globalAny.Capacitor?.Plugins?.NavigationBar) as NavigationBarBridge | undefined,
    statusBridge: (globalAny.StatusBar || globalAny.Capacitor?.Plugins?.StatusBar) as StatusBarBridge | undefined,
  };
}

function syncThemeColorMeta(hex: string, darkIcons: boolean) {
  if (typeof document === "undefined") return;

  const themeMeta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?? document.createElement("meta");
  themeMeta.name = "theme-color";
  themeMeta.content = hex;
  if (!themeMeta.parentNode) {
    document.head.appendChild(themeMeta);
  }

  const appleMeta = document.head.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?? document.createElement("meta");
  appleMeta.name = "apple-mobile-web-app-status-bar-style";
  appleMeta.content = darkIcons ? "default" : "black";
  if (!appleMeta.parentNode) {
    document.head.appendChild(appleMeta);
  }
}

async function setNavigationBarViaBridge(hex: string, darkIcons: boolean) {
  const { navBridge } = getSystemBarBridges();
  if (!navBridge?.setColor) return;

  try {
    await navBridge.setColor({ color: hex, darkButtons: darkIcons });
  } catch {
    // Optional bridge.
  }
}

async function setStatusBarViaBridge(hex: string, darkIcons: boolean) {
  const { statusBridge } = getSystemBarBridges();
  if (!statusBridge) return;

  try {
    await statusBridge.setOverlaysWebView?.({ overlay: false });
  } catch {
    // Optional bridge.
  }

  try {
    await statusBridge.setBackgroundColor?.({ color: hex });
  } catch {
    // Optional bridge.
  }

  try {
    await statusBridge.setStyle?.({ style: darkIcons ? "DARK" : "LIGHT" });
  } catch {
    // Optional bridge.
  }
}

export async function setStatusBarColor(color: string) {
  if (typeof window === "undefined") return;
  const hex = normalizeToHex(color);
  if (!hex) return;

  const darkIcons = shouldUseDarkIcons(hex);

  document.documentElement.style.setProperty("--resolved-status-bar-color", hex);
  document.documentElement.style.setProperty("--resolved-status-bar-dark-icons", darkIcons ? "1" : "0");
  syncThemeColorMeta(hex, darkIcons);

  await setStatusBarViaBridge(hex, darkIcons);
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
