import { prisma } from "@/lib/prisma";

export async function getAllUserIdsForCheckins() {
  const users = await prisma.user.findMany({ select: { id: true } });
  return users.map((user) => user.id);
}

export async function getCheckinsAndWorkoutLogsForUsers(userIds: string[]) {
  const [checkins, workoutLogs] = await Promise.all([
    prisma.checkIn.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.progressionLog.findMany({
      where: {
        userProgression: {
          userId: {
            in: userIds,
          },
        },
      },
      select: {
        createdAt: true,
        userProgression: {
          select: {
            userId: true,
          },
        },
      },
    }),
  ]);

  return { checkins, workoutLogs };
}

export async function upsertCheckinsByDate(params: {
  date: Date;
  entries: Record<string, { present?: boolean; weight?: number | string | null; comment?: string | null }>;
}) {
  const operations = Object.entries(params.entries).map(([userId, data]) => {
    const parsedWeight =
      data.weight === undefined || data.weight === null || String(data.weight).trim() === ""
        ? null
        : parseFloat(String(data.weight));
    const weight =
      parsedWeight !== null && !Number.isNaN(parsedWeight) && parsedWeight >= 0 && parsedWeight <= 1000
        ? parsedWeight
        : null;
    const comment = data.comment == null ? null : String(data.comment).slice(0, 500);
    const presentUpdate = typeof data.present === "boolean" ? { present: data.present } : {};

    return prisma.checkIn.upsert({
      where: {
        date_userId: { date: params.date, userId },
      },
      create: {
        date: params.date,
        userId,
        present: typeof data.present === "boolean" ? data.present : false,
        weight,
        comment,
      },
      update: {
        ...presentUpdate,
        weight,
        comment,
      },
    });
  });

  await Promise.all(operations);
}

export async function deleteCheckinNotesByDate(date: string) {
  return prisma.checkInNote.deleteMany({ where: { date } });
}

export async function deleteCheckinsByDate(date: Date) {
  return prisma.checkIn.deleteMany({ where: { date } });
}

export async function deleteAllCheckins() {
  return prisma.checkIn.deleteMany({});
}

export async function findLatestWeightByUserId(userId: string) {
  return prisma.checkIn.findFirst({
    where: {
      userId,
      weight: { not: null },
    },
    orderBy: { date: "desc" },
    select: { weight: true, date: true },
  });
}

export async function findCheckinNotes(params: {
  userIds: string[];
  date?: string;
  futureToday?: string;
}) {
  let where: Record<string, unknown> = {
    userId: {
      in: params.userIds,
    },
  };

  if (params.futureToday) {
    where = { ...where, date: { gt: params.futureToday } };
  } else if (params.date) {
    where = { ...where, date: params.date };
  }

  return prisma.checkInNote.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
}

export async function findCheckinNoteByDateAndUser(date: string, userId: string) {
  return prisma.checkInNote.findFirst({
    where: { date, userId },
  });
}

export async function createCheckinNote(params: { date: string; userId: string; content: string }) {
  return prisma.checkInNote.create({
    data: {
      date: params.date,
      userId: params.userId,
      content: params.content,
    },
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
  });
}

export async function updateCheckinNoteContent(noteId: string, content: string) {
  return prisma.checkInNote.update({
    where: { id: noteId },
    data: { content },
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
  });
}

export async function findCheckinNoteById(noteId: string) {
  return prisma.checkInNote.findUnique({
    where: { id: noteId },
  });
}

export async function updateCheckinNotePinned(noteId: string, pinned: boolean) {
  return prisma.checkInNote.update({
    where: { id: noteId },
    data: { pinned },
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
  });
}

export async function deleteCheckinNoteById(noteId: string) {
  return prisma.checkInNote.delete({ where: { id: noteId } });
}
