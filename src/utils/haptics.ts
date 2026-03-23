"use client";

import { isNativePlatform } from "@/lib/platform";

export type HapticLevel = "light" | "medium" | "heavy";

let HapticsModule: typeof import("@capacitor/haptics") | null = null;

async function getHaptics() {
  if (HapticsModule) return HapticsModule;
  try {
    HapticsModule = await import("@capacitor/haptics");
    return HapticsModule;
  } catch {
    return null;
  }
}

export async function triggerHaptic(level: HapticLevel) {
  if (typeof window === "undefined" || !isNativePlatform()) return;
  const mod = await getHaptics();
  if (!mod) return;

  const styleMap: Record<HapticLevel, "Light" | "Medium" | "Heavy"> = {
    light: "Light",
    medium: "Medium",
    heavy: "Heavy",
  };

  try {
    const style = mod.ImpactStyle[styleMap[level] as keyof typeof mod.ImpactStyle];
    if (style !== undefined) {
      await mod.Haptics.impact({ style });
    }
  } catch {
    // Best-effort only; do not block UX.
  }
}

export async function hapticSelection() {
  if (typeof window === "undefined" || !isNativePlatform()) return;
  const mod = await getHaptics();
  if (!mod) return;
  try {
    await mod.Haptics.selectionStart();
    await mod.Haptics.selectionChanged();
    await mod.Haptics.selectionEnd();
  } catch {
    // Ignore unsupported devices.
  }
}
