"use client";

import { resolveCssVarColor } from "@/utils/colorConversion";
import { setNavigationBarColor } from "@/utils/systemBars";

export async function applyNavigationBarFromCssVar(cssVar = "--ink-deep") {
  const resolved = resolveCssVarColor(cssVar) || resolveCssVarColor("--void-black");
  if (!resolved) return;
  await setNavigationBarColor(resolved);
}
