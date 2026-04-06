// src/lib/copy/index.ts — Cultivation copy helper

import { CULTIVATION_EN } from "./cultivation.en";
import { CULTIVATION_VI } from "./cultivation.vi";
import type { LanguageMode } from "@/lib/language";

export type CultivationCopy = typeof CULTIVATION_EN;

const COPY_MAP: Record<LanguageMode, CultivationCopy> = {
  english: CULTIVATION_EN,
  vietnamese: CULTIVATION_VI as unknown as CultivationCopy,
};

export function getCopy(lang: LanguageMode): CultivationCopy {
  return COPY_MAP[lang] ?? CULTIVATION_EN;
}

export { CULTIVATION_EN, CULTIVATION_VI };
