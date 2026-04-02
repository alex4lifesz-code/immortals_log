import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const judy = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "judy" },
          { username: "Judy" },
          { name: "judy" },
          { name: "Judy" },
        ],
      },
      select: { id: true, username: true, name: true },
    });

    if (!judy) {
      console.log("Judy not found.");
      return;
    }

    const levels = await prisma.userProgressionLevel.findMany({
      where: { userId: judy.id },
      select: { id: true },
    });

    const logs = levels.length > 0
      ? await prisma.progressionLog.findMany({
          where: { userProgressionId: { in: levels.map((l) => l.id) } },
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const first = logs[0]?.createdAt?.toISOString() ?? null;
    const last = logs[logs.length - 1]?.createdAt?.toISOString() ?? null;

    console.log("Judy progression dataset state:");
    console.log(`User: ${judy.username || judy.name || judy.id} (${judy.id})`);
    console.log(`User progression rows: ${levels.length}`);
    console.log(`Progression logs: ${logs.length}`);
    console.log(`First log date: ${first}`);
    console.log(`Last log date: ${last}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to verify Judy progression state:", error);
  process.exitCode = 1;
});
