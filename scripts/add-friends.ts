import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const adapter = new PrismaLibSql({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [, , user1Name, user2Name] = process.argv;
  
  if (!user1Name || !user2Name) {
    console.log('Usage: npx tsx scripts/add-friends.ts <username1> <username2>');
    process.exit(1);
  }

  console.log(`Making ${user1Name} and ${user2Name} friends...`);

  const user1 = await prisma.user.findUnique({ where: { username: user1Name } });
  const user2 = await prisma.user.findUnique({ where: { username: user2Name } });

  if (!user1) {
    console.error(`User not found: ${user1Name}`);
    process.exit(1);
  }

  if (!user2) {
    console.error(`User not found: ${user2Name}`);
    process.exit(1);
  }

  // Check if they're already friends
  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { requesterId: user1.id, receiverId: user2.id },
        { requesterId: user2.id, receiverId: user1.id },
      ],
    },
  });

  if (existing && existing.status === 'accepted') {
    console.log(`✓ ${user1Name} and ${user2Name} are already friends`);
    process.exit(0);
  }

  if (existing) {
    // Delete any existing non-accepted request
    await prisma.friendRequest.delete({ where: { id: existing.id } });
  }

  // Create accepted friend request
  const friendRequest = await prisma.friendRequest.create({
    data: {
      requesterId: user1.id,
      receiverId: user2.id,
      status: 'accepted',
      respondedAt: new Date(),
    },
    include: {
      requester: { select: { id: true, name: true, username: true } },
      receiver: { select: { id: true, name: true, username: true } },
    },
  });

  console.log(`✓ Successfully made ${user1Name} and ${user2Name} friends!`);
  console.log(`  Request ID: ${friendRequest.id}`);
  console.log(`  From: ${friendRequest.requester.username}`);
  console.log(`  To: ${friendRequest.receiver.username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
