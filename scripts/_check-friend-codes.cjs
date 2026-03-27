const { PrismaClient } = require("../src/generated/prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL }),
});

async function run() {
  const users = await prisma.user.findMany({
    where: { username: { in: ["admin", "judy"] } },
    select: { id: true, username: true, friendCode: true },
  });

  console.log(JSON.stringify(users, null, 2));

  const missing = users.filter((user) => !user.friendCode || user.friendCode.trim() === "");

  if (missing.length > 0) {
    for (const user of missing) {
      await prisma.user.update({
        where: { id: user.id },
        data: { friendCode: user.id },
      });
    }

    const reloaded = await prisma.user.findMany({
      where: { username: { in: ["admin", "judy"] } },
      select: { id: true, username: true, friendCode: true },
    });

    console.log("BACKFILLED");
    console.log(JSON.stringify(reloaded, null, 2));
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
