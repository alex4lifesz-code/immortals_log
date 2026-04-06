/**
 * Seed admin + judy users (with onboarding complete) and make them friends.
 *
 * Usage:  npx tsx scripts/seed-users-and-exercises.ts
 *
 * Idempotent: skips users/friendships that already exist.
 * Does NOT purge existing data.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function generateFriendCode(): string {
  return "IMM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

interface SeedUser {
  username: string;
  password: string;
  name: string;
  role: string;
}

const USERS: SeedUser[] = [
  { username: "admin", password: "admin", name: "Administrator", role: "admin" },
  { username: "judy", password: "judy", name: "Judy", role: "user" },
];

async function main() {
  const prisma = createPrismaClient();

  try {
    console.log("=== Seed Users & Exercises ===\n");

    // ── 1. Upsert users ─────────────────────────────────
    const userIds: Record<string, string> = {};

    for (const u of USERS) {
      const existing = await prisma.user.findFirst({ where: { username: u.username } });

      if (existing) {
        console.log(`  ✓ User "${u.username}" already exists (id=${existing.id})`);
        userIds[u.username] = existing.id;
      } else {
        const hash = await bcrypt.hash(u.password, 10);
        const created = await prisma.user.create({
          data: {
            friendCode: generateFriendCode(),
            username: u.username,
            password: hash,
            name: u.name,
            role: u.role,
            onboardingCompleted: true,
            onboardingSkipped: false,
            onboardingStep: 5,
          },
        });
        console.log(`  + Created user "${u.username}" (id=${created.id})`);
        userIds[u.username] = created.id;
      }

      // Ensure onboarding is marked complete even for pre-existing users
      await prisma.user.update({
        where: { id: userIds[u.username] },
        data: {
          onboardingCompleted: true,
          onboardingStep: 5,
        },
      });
    }

    // ── 2. Make them friends ─────────────────────────────
    const adminId = userIds["admin"];
    const judyId = userIds["judy"];

    if (adminId && judyId) {
      const existingFR = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { requesterId: adminId, receiverId: judyId },
            { requesterId: judyId, receiverId: adminId },
          ],
        },
      });

      if (existingFR) {
        console.log(`  ✓ Friend request already exists (status=${existingFR.status})`);
      } else {
        await prisma.friendRequest.create({
          data: {
            requesterId: adminId,
            receiverId: judyId,
            status: "accepted",
            respondedAt: new Date(),
          },
        });
        console.log("  + Created accepted friend request: admin ↔ judy");
      }
    }

    console.log("\n✓ Users and friendship seeded.\n");
    console.log("  admin / admin  (role: admin)");
    console.log("  judy  / judy   (role: user)");
    console.log("\n⚠ SECURITY: Change default passwords after first login.\n");
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
