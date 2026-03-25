"use client";

export type HapticLevel = "light" | "medium" | "heavy";

const vibrationMap: Record<HapticLevel, number> = {
  light: 12,
  medium: 24,
  heavy: 40,
};

export async function triggerHaptic(level: HapticLevel) {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(vibrationMap[level]);
  } catch {
    // Best-effort only; do not block UX.
  }
}

export async function hapticSelection() {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate([8, 8, 8]);
  } catch {
    // Ignore unsupported devices.
  }
}
