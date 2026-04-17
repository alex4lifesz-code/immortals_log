import { prisma } from "@/lib/prisma";

export const APP_EXERCISE_LIBRARY_USERNAME = "__app_exercise_library__";
export const APP_EXERCISE_LIBRARY_NAME = "Application Exercise Library";

export async function ensureAppExerciseLibraryOwner(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { username: APP_EXERCISE_LIBRARY_USERNAME },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      username: APP_EXERCISE_LIBRARY_USERNAME,
      password: `system:${crypto.randomUUID()}`,
      name: APP_EXERCISE_LIBRARY_NAME,
      role: "system",
      onboardingCompleted: true,
      onboardingSkipped: true,
      onboardingStep: 0,
    },
    select: { id: true },
  });

  return created.id;
}
