import { isSupportedLanguageMode } from "@/lib/language";
import { prisma } from "@/lib/prisma";

export type AppLanguage = "english" | "vietnamese";

type StoredDisplaySettings = {
  languageMode?: unknown;
};

type ExerciseTranslationLike = {
  englishName?: string | null;
  vietnameseName?: string | null;
  englishStory?: string | null;
  vietnameseStory?: string | null;
  englishDifficulty?: string | null;
  vietnameseDifficulty?: string | null;
  englishType?: string | null;
  vietnameseType?: string | null;
};

type ProgressionTranslationLike = {
  englishName?: string | null;
  vietnameseName?: string | null;
  englishDescription?: string | null;
  vietnameseDescription?: string | null;
  englishDifficulty?: string | null;
  vietnameseDifficulty?: string | null;
};

type ExerciseLike = {
  name?: string | null;
  story?: string | null;
  difficulty?: string | null;
  type?: string | null;
};

type ProgressionExerciseLike = ExerciseLike & {
  tiers?: Array<{
    name?: string | null;
    description?: string | null;
    difficulty?: string | null;
    translation?: unknown;
  }>;
  variations?: Array<{
    name?: string | null;
    description?: string | null;
    difficulty?: string | null;
    translation?: unknown;
  }>;
};

export async function getUserLanguageMode(_userId: string): Promise<AppLanguage> {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: _userId },
      select: { hiddenNavItems: true },
    });

    if (!settings?.hiddenNavItems) {
      return "english";
    }

    const parsed = JSON.parse(settings.hiddenNavItems) as StoredDisplaySettings;
    return isSupportedLanguageMode(parsed.languageMode) ? parsed.languageMode : "english";
  } catch {
    return "english";
  }
}

function pickLocalizedValue(
  fallback: string | null | undefined,
  english: string | null | undefined,
  vietnamese: string | null | undefined,
  language: AppLanguage,
): string | null | undefined {
  if (language === "vietnamese") {
    return vietnamese ?? english ?? fallback;
  }
  return english ?? fallback;
}

export function applyExerciseTranslation<T extends ExerciseLike>(
  exercise: T,
  _translation: unknown,
  _language: AppLanguage
): T {
  if (!_translation || typeof _translation !== "object") {
    return exercise;
  }

  const translation = _translation as ExerciseTranslationLike;
  return {
    ...exercise,
    name: pickLocalizedValue(exercise.name, translation.englishName, translation.vietnameseName, _language),
    story: pickLocalizedValue(exercise.story, translation.englishStory, translation.vietnameseStory, _language),
    difficulty: pickLocalizedValue(exercise.difficulty, translation.englishDifficulty, translation.vietnameseDifficulty, _language),
    type: pickLocalizedValue(exercise.type, translation.englishType, translation.vietnameseType, _language),
  };
}

export function applyProgressionExerciseTranslation<T extends ProgressionExerciseLike>(
  exercise: T,
  _translation: unknown,
  _language: AppLanguage
): T {
  const localizedExercise = applyExerciseTranslation(exercise, _translation, _language);

  const localizedTiers = Array.isArray(localizedExercise.tiers)
    ? localizedExercise.tiers.map((tier) => {
        if (!tier?.translation || typeof tier.translation !== "object") {
          return tier;
        }
        const translation = tier.translation as ProgressionTranslationLike;
        return {
          ...tier,
          name: pickLocalizedValue(tier.name, translation.englishName, translation.vietnameseName, _language),
          description: pickLocalizedValue(
            tier.description,
            translation.englishDescription,
            translation.vietnameseDescription,
            _language,
          ),
          difficulty: pickLocalizedValue(
            tier.difficulty,
            translation.englishDifficulty,
            translation.vietnameseDifficulty,
            _language,
          ),
        };
      })
    : localizedExercise.tiers;

  const localizedVariations = Array.isArray(localizedExercise.variations)
    ? localizedExercise.variations.map((variation) => {
        if (!variation?.translation || typeof variation.translation !== "object") {
          return variation;
        }
        const translation = variation.translation as ProgressionTranslationLike;
        return {
          ...variation,
          name: pickLocalizedValue(variation.name, translation.englishName, translation.vietnameseName, _language),
          description: pickLocalizedValue(
            variation.description,
            translation.englishDescription,
            translation.vietnameseDescription,
            _language,
          ),
          difficulty: pickLocalizedValue(
            variation.difficulty,
            translation.englishDifficulty,
            translation.vietnameseDifficulty,
            _language,
          ),
        };
      })
    : localizedExercise.variations;

  return {
    ...localizedExercise,
    tiers: localizedTiers,
    variations: localizedVariations,
  };
}
