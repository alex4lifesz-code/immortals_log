import "dotenv/config";
import { prisma } from "./lib/prisma";
import { runAddFriends } from "./data/add-friends";

async function main() {
  const [, , category, action, ...restArgs] = process.argv;

  if (!category || !action) {
    console.log("Usage: tsx scripts/cli.ts <category> <action> [args]");
    console.log("Examples:");
    console.log("  tsx scripts/cli.ts data add-friends admin judy");
    process.exit(1);
  }

  if (category === "data" && action === "add-friends") {
    await runAddFriends(restArgs);
    return;
  }

  console.error(`Unknown script command: ${category} ${action}`);
  process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
