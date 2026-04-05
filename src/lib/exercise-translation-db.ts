import { prisma } from "@/lib/prisma";

export type AppLanguage = "english" | "vietnamese";

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

type ExerciseLike = {
  name?: string | null;
  story?: string | null;
  difficulty?: string | null;
  type?: string | null;
};

type ProgressionExerciseTranslationLike = ExerciseTranslationLike;

type ProgressionExerciseLike = {
  name?: string | null;
  story?: string | null;
  difficulty?: string | null;
  type?: string | null;
  tiers?: Array<{
    name?: string | null;
    description?: string | null;
    difficulty?: string | null;
    translation?: {
      englishName?: string | null;
      vietnameseName?: string | null;
      englishDescription?: string | null;
      vietnameseDescription?: string | null;
      englishDifficulty?: string | null;
      vietnameseDifficulty?: string | null;
    } | null;
  }>;
  variations?: Array<{
    name?: string | null;
    description?: string | null;
    difficulty?: string | null;
    translation?: {
      englishName?: string | null;
      vietnameseName?: string | null;
      englishDescription?: string | null;
      vietnameseDescription?: string | null;
      englishDifficulty?: string | null;
      vietnameseDifficulty?: string | null;
    } | null;
  }>;
};

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed JSON and fallback to default language.
  }
  return null;
}

export async function getUserLanguageMode(userId: string): Promise<AppLanguage> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { hiddenNavItems: true },
  });

  const displaySettings = parseJsonObject(settings?.hiddenNavItems);
  const mode = displaySettings?.languageMode;
  return mode === "vietnamese" ? "vietnamese" : "english";
}

export function applyExerciseTranslation<T extends ExerciseLike>(
  exercise: T,
  translation: ExerciseTranslationLike | null | undefined,
  language: AppLanguage
): T {
  if (!translation) return exercise;

  if (language === "vietnamese") {
    return {
      ...exercise,
      name: translation.vietnameseName || exercise.name,
      story: translation.vietnameseStory || exercise.story,
      difficulty: translation.vietnameseDifficulty || exercise.difficulty,
      type: translation.vietnameseType || exercise.type,
    };
  }

  return {
    ...exercise,
    name: translation.englishName || exercise.name,
    story: translation.englishStory || exercise.story,
    difficulty: translation.englishDifficulty || exercise.difficulty,
    type: translation.englishType || exercise.type,
  };
}

export function applyProgressionExerciseTranslation<T extends ProgressionExerciseLike>(
  exercise: T,
  translation: ProgressionExerciseTranslationLike | null | undefined,
  language: AppLanguage
): T {
  const translatedExercise = applyExerciseTranslation(exercise, translation, language);

  return {
    ...translatedExercise,
    tiers: (translatedExercise.tiers ?? []).map((tier) => {
      const tierTranslation = tier.translation;
      if (!tierTranslation) return tier;
      if (language === "vietnamese") {
        return {
          ...tier,
          name: tierTranslation.vietnameseName || tier.name,
          description: tierTranslation.vietnameseDescription || tier.description,
          difficulty: tierTranslation.vietnameseDifficulty || tier.difficulty,
        };
      }
      return {
        ...tier,
        name: tierTranslation.englishName || tier.name,
        description: tierTranslation.englishDescription || tier.description,
        difficulty: tierTranslation.englishDifficulty || tier.difficulty,
      };
    }),
    variations: (translatedExercise.variations ?? []).map((variation) => {
      const variationTranslation = variation.translation;
      if (!variationTranslation) return variation;
      if (language === "vietnamese") {
        return {
          ...variation,
          name: variationTranslation.vietnameseName || variation.name,
          description: variationTranslation.vietnameseDescription || variation.description,
          difficulty: variationTranslation.vietnameseDifficulty || variation.difficulty,
        };
      }
      return {
        ...variation,
        name: variationTranslation.englishName || variation.name,
        description: variationTranslation.englishDescription || variation.description,
        difficulty: variationTranslation.englishDifficulty || variation.difficulty,
      };
    }),
  };
}
