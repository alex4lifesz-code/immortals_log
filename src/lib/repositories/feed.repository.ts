import { prisma } from "@/lib/prisma";

export async function getAllUserIdsForFeed() {
  const users = await prisma.user.findMany({ select: { id: true } });
  return users.map((user) => user.id);
}

export async function getFeedExercisesForUsers(userIds: string[]) {
  return prisma.progressionExercise.findMany({
    include: {
      tiers: { orderBy: { level: "asc" } },
      variations: true,
      modifiers: true,
      userProgress: {
        where: {
          userId: {
            in: userIds,
          },
        },
        include: {
          logs: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFeedUsersByIds(userIds: string[]) {
  return prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      name: true,
      username: true,
    },
  });
}
