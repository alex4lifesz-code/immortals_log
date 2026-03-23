"use client";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseRgbToHex(input: string): string | null {
  const match = input.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((s) => Number.parseFloat(s.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [r, g, b] = parts;
  return `#${[r, g, b]
    .map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = clamp(s / 100, 0, 1);
  const lig = clamp(l / 100, 0, 1);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = lig - c / 2;
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255)) as [number, number, number];
}

function parseHslToHex(input: string): string | null {
  const match = input.match(/hsla?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((s) => s.trim().replace("%", ""));
  if (parts.length < 3) return null;
  const h = Number.parseFloat(parts[0]);
  const s = Number.parseFloat(parts[1]);
  const l = Number.parseFloat(parts[2]);
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  const [r, g, b] = hslToRgb(h, s, l);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeToHex(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
    }
    return value.toLowerCase();
  }

  return parseRgbToHex(value) || parseHslToHex(value);
}

export function resolveCssVarColor(variableName: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName);
  return normalizeToHex(raw);
}

export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const rgb = [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16) / 255);
  const corrected = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * corrected[0] + 0.7152 * corrected[1] + 0.0722 * corrected[2];
}

export function shouldUseDarkIcons(hex: string): boolean {
  return luminance(hex) > 0.6;
}
