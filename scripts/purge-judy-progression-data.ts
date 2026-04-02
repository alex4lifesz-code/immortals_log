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
      throw new Error("Could not find user 'judy'.");
    }

    const levels = await prisma.userProgressionLevel.findMany({
      where: { userId: judy.id },
      select: { id: true },
    });

    const levelIds = levels.map((l) => l.id);

    const logDeleteResult = levelIds.length > 0
      ? await prisma.progressionLog.deleteMany({ where: { userProgressionId: { in: levelIds } } })
      : { count: 0 };

    const levelDeleteResult = await prisma.userProgressionLevel.deleteMany({ where: { userId: judy.id } });

    console.log("Judy progression purge complete.");
    console.log(`User: ${judy.username || judy.name || judy.id} (${judy.id})`);
    console.log(`Deleted logs: ${logDeleteResult.count}`);
    console.log(`Deleted user progression rows: ${levelDeleteResult.count}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to purge Judy progression data:", error);
  process.exitCode = 1;
});
