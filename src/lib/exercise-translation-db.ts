export type AppLanguage = "english";

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
  return "english";
}

export function applyExerciseTranslation<T extends ExerciseLike>(
  exercise: T,
  _translation: unknown,
  _language: AppLanguage
): T {
  return exercise;
}

export function applyProgressionExerciseTranslation<T extends ProgressionExerciseLike>(
  exercise: T,
  _translation: unknown,
  _language: AppLanguage
): T {
  return exercise;
}
