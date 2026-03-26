export interface DifficultyStyle {
  textColor: string;
  glowColor: string;
  glowShadow: string;
}
const EXERCISE_GLOW_COLOR = "var(--exercise-glow)";

export function getDifficultyStyle(difficulty: string): DifficultyStyle {
  void difficulty;
  return {
    textColor: "text-mist-light",
    glowColor: EXERCISE_GLOW_COLOR,
    glowShadow:
      "0 0 8px color-mix(in srgb, var(--exercise-glow) 35%, transparent), inset 0 0 8px color-mix(in srgb, var(--exercise-glow) 14%, transparent)",
  };
}

/**
 * Get the text color class for a difficulty level
 */
export function getDifficultyColorClass(difficulty: string): string {
  return getDifficultyStyle(difficulty).textColor;
}

/**
 * Get the box-shadow value for glow effect
 */
export function getDifficultyShadow(difficulty: string): React.CSSProperties["boxShadow"] {
  return getDifficultyStyle(difficulty).glowShadow;
}

/**
 * Get inline style object for difficulty border glow
 */
export function getDifficultyGlowStyle(difficulty: string): React.CSSProperties {
  const style = getDifficultyStyle(difficulty);
  return {
    boxShadow: style.glowShadow,
    borderColor: style.glowColor,
  };
}

/**
 * Get inline style object for difficulty border glow, scaled by intensity (0-100)
 */
export function getDifficultyGlowStyleScaled(difficulty: string, intensity: number): React.CSSProperties {
  if (intensity <= 0) return {};
  const style = getDifficultyStyle(difficulty);
  if (intensity >= 100) return { boxShadow: style.glowShadow, borderColor: style.glowColor };
  const factor = intensity / 100;
  const scaledShadow = style.glowShadow.replace(
    /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g,
    (_m: string, r: string, g: string, b: string, a: string) => `rgba(${r}, ${g}, ${b}, ${(parseFloat(a) * factor).toFixed(3)})`
  );
  return { boxShadow: scaledShadow, borderColor: style.glowColor };
}

/**
 * Get abbreviated difficulty level (for compact display)
 */
export function getAbbreviatedDifficulty(difficulty: string): string {
  const value = (difficulty || "").trim();
  if (!value) return "";
  return value.split(/\s+/).map((part) => part[0]?.toUpperCase() ?? "").join("").slice(0, 3);
}
