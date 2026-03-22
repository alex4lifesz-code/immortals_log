const { PrismaClient } = require('./src/generated/prisma');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
require('dotenv/config');
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, username: true, role: true } });
  console.log('Users:', JSON.stringify(users, null, 2));

  // Check existing progression exercises for admin
  const exercises = await prisma.progressionExercise.findMany({
    select: { id: true, name: true, category: true, equipmentType: true, userId: true },
    take: 50,
  });
  console.log('\nExisting progression exercises (' + exercises.length + '):');
  exercises.forEach(e => console.log('  ' + e.name + ' [' + e.category + '] userId=' + e.userId));
}

main().catch(console.error).finally(() => prisma.$disconnect());
