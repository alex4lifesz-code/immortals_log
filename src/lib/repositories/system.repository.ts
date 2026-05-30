import { prisma } from "@/lib/prisma";

export async function checkDatabaseReachable() {
  await prisma.$queryRawUnsafe("SELECT 1");
}
