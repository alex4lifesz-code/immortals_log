import { prisma } from "@/lib/prisma";

export async function findUserByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

export async function createUser(params: {
  username: string;
  password: string;
  name: string;
  role: "user" | "admin" | "system";
  friendCode?: string;
}) {
  return prisma.user.create({
    data: {
      username: params.username,
      password: params.password,
      name: params.name,
      role: params.role,
      friendCode: params.friendCode,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function getUsersWithProgressionCounts() {
  const [users, progressionLevels] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        settings: {
          select: {
            pinnedNavItems: true,
          },
        },
        _count: {
          select: {
            checkIns: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userProgressionLevel.findMany({
      select: {
        userId: true,
        _count: {
          select: {
            logs: true,
          },
        },
      },
    }),
  ]);

  return { users, progressionLevels };
}

export async function findUserIdAndRoleById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
}

export async function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function findAuthUserProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      onboardingCompleted: true,
      onboardingSkipped: true,
      onboardingStep: true,
    },
  });
}

export async function findUserForLoginByUsernameInsensitive(username: string) {
  const users = await prisma.$queryRaw<
    Array<{
      id: string;
      username: string;
      password: string;
      name: string;
      role: string;
      onboardingCompleted: number;
      onboardingSkipped: number;
    }>
  >`
    SELECT id, username, password, name, role, onboardingCompleted, onboardingSkipped
    FROM "User"
    WHERE lower(username) = lower(${username})
    LIMIT 1
  `;

  return users[0] ?? null;
}

export async function countUsersByRole(role: "user" | "admin" | "system") {
  return prisma.user.count({ where: { role } });
}

export async function updateUserById(
  userId: string,
  data: { name?: string; password?: string; role?: string },
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, username: true, name: true, role: true },
  });
}

export async function findUsersPublicByIds(userIds: string[]) {
  return prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      username: true,
      name: true,
      createdAt: true,
      settings: {
        select: {
          pinnedNavItems: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findUserSettingsByUserId(userId: string) {
  return prisma.userSettings.findUnique({
    where: { userId },
  });
}

export async function upsertUserSettings(params: {
  userId: string;
  pinnedNavItems: string;
  hiddenNavItems: string;
  panelPosition?: string;
  dualPageView?: boolean;
  combinedView?: boolean;
}) {
  return prisma.userSettings.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      pinnedNavItems: params.pinnedNavItems,
      hiddenNavItems: params.hiddenNavItems,
      panelPosition: params.panelPosition ?? "left",
      dualPageView: params.dualPageView ?? false,
      combinedView: params.combinedView ?? false,
    },
    update: {
      pinnedNavItems: params.pinnedNavItems,
      hiddenNavItems: params.hiddenNavItems,
    },
  });
}

export async function findUserIdByFriendCode(friendCode: string) {
  const user = await prisma.user.findUnique({
    where: { friendCode },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function findOnboardingStateByUserId(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompleted: true,
      onboardingSkipped: true,
      onboardingStep: true,
      profile: {
        select: {
          fitnessBackground: true,
          primaryGoal: true,
          trainingDaysPerWeek: true,
          assessmentAnswers: true,
          recommendedTier: true,
          currentTier: true,
        },
      },
    },
  });
}

export async function updateOnboardingStep(userId: string, step: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { onboardingStep: step },
  });
}

export async function markOnboardingComplete(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      onboardingCompleted: true,
      onboardingStep: 5,
    },
  });
}

export async function markOnboardingSkipped(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      onboardingSkipped: true,
      onboardingStep: 5,
    },
  });
}

export async function upsertUserAssessmentProfile(params: {
  userId: string;
  fitnessBackground: string;
  primaryGoal: string;
  trainingDaysPerWeek: number;
  assessmentAnswers: string;
  recommendedTier: string;
  currentTier: string;
}) {
  return prisma.userProfile.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      fitnessBackground: params.fitnessBackground,
      primaryGoal: params.primaryGoal,
      trainingDaysPerWeek: params.trainingDaysPerWeek,
      assessmentAnswers: params.assessmentAnswers,
      recommendedTier: params.recommendedTier,
      currentTier: params.currentTier,
    },
    update: {
      fitnessBackground: params.fitnessBackground,
      primaryGoal: params.primaryGoal,
      trainingDaysPerWeek: params.trainingDaysPerWeek,
      assessmentAnswers: params.assessmentAnswers,
      recommendedTier: params.recommendedTier,
      currentTier: params.currentTier,
    },
  });
}

export async function findUserSettingsNavPrefs(userId: string) {
  return prisma.userSettings.findUnique({
    where: { userId },
    select: {
      pinnedNavItems: true,
      hiddenNavItems: true,
      panelPosition: true,
      dualPageView: true,
      combinedView: true,
    },
  });
}

export async function upsertUserSettingsPinnedNavPrefs(params: {
  userId: string;
  pinnedNavItems: string;
  hiddenNavItems: string;
  panelPosition: string;
  dualPageView: boolean;
  combinedView: boolean;
}) {
  return prisma.userSettings.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      pinnedNavItems: params.pinnedNavItems,
      hiddenNavItems: params.hiddenNavItems,
      panelPosition: params.panelPosition,
      dualPageView: params.dualPageView,
      combinedView: params.combinedView,
    },
    update: {
      pinnedNavItems: params.pinnedNavItems,
    },
  });
}
