/**
 * Reset Database & Create Default Admin
 * 
 * Purges ALL existing user accounts and associated data,
 * then creates a default administrator account.
 * 
 * Default credentials (rotate immediately after first login):
 *   Username: admin
 *   Password: admin
 * 
 * Usage: node scripts/reset-and-seed-admin.js
 */

import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Wuxia Cultivation Tracker — Database Reset ===\n');

  // Count existing users
  const existingUsers = await prisma.user.findMany();
  console.log(`Found ${existingUsers.length} existing user(s). Purging all data...\n`);

  // Purge in dependency order
  console.log('  Deleting check-in notes...');
  const deletedNotes = await prisma.checkInNote.deleteMany();
  console.log(`    → ${deletedNotes.count} note(s) removed`);

  console.log('  Deleting check-ins...');
  const deletedCheckins = await prisma.checkIn.deleteMany();
  console.log(`    → ${deletedCheckins.count} check-in(s) removed`);

  console.log('  Deleting simplified workout exercises...');
  const deletedSimplified = await prisma.simplifiedWorkoutExercise.deleteMany();
  console.log(`    → ${deletedSimplified.count} record(s) removed`);

  console.log('  Deleting detailed workout exercises...');
  const deletedDetailed = await prisma.detailedWorkoutExercise.deleteMany();
  console.log(`    → ${deletedDetailed.count} record(s) removed`);

  console.log('  Deleting workouts...');
  const deletedWorkouts = await prisma.workout.deleteMany();
  console.log(`    → ${deletedWorkouts.count} workout(s) removed`);

  console.log('  Deleting user settings...');
  const deletedSettings = await prisma.userSettings.deleteMany();
  console.log(`    → ${deletedSettings.count} setting(s) removed`);

  console.log('  Deleting users...');
  const deletedUsers = await prisma.user.deleteMany();
  console.log(`    → ${deletedUsers.count} user(s) removed`);

  console.log('\n✓ All user data purged successfully.\n');

  // Create default admin account
  console.log('Creating default administrator account...');
  const hashedPassword = await bcrypt.hash('admin', 10);
  
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      name: 'Administrator',
      role: 'admin',
    },
  });

  console.log(`\n✓ Admin account created successfully.`);
  console.log(`  ID:       ${admin.id}`);
  console.log(`  Username: admin`);
  console.log(`  Password: admin`);
  console.log(`  Role:     ${admin.role}`);
  console.log(`\n⚠ SECURITY: Change the default password immediately after first login.\n`);

  // Verify
  const finalCount = await prisma.user.count();
  console.log(`Database now contains ${finalCount} user(s).`);
  console.log('=== Reset complete ===');
}

main()
  .catch((e) => {
    console.error('Error during reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
