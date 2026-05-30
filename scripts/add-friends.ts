import "dotenv/config";
import { prisma } from "./lib/prisma";
import { runAddFriends } from "./data/add-friends";

async function main() {
  const [, , ...args] = process.argv;
  await runAddFriends(args);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
