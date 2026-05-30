import "dotenv/config";
import { prisma } from "../lib/prisma";

export async function runAddFriends(args: string[]) {
  const [user1Name, user2Name] = args;

  if (!user1Name || !user2Name) {
    console.log("Usage: npm run add-friends -- <username1> <username2>");
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

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { requesterId: user1.id, receiverId: user2.id },
        { requesterId: user2.id, receiverId: user1.id },
      ],
    },
  });

  if (existing && existing.status === "accepted") {
    console.log(`OK: ${user1Name} and ${user2Name} are already friends`);
    return;
  }

  if (existing) {
    await prisma.friendRequest.delete({ where: { id: existing.id } });
  }

  const friendRequest = await prisma.friendRequest.create({
    data: {
      requesterId: user1.id,
      receiverId: user2.id,
      status: "accepted",
      respondedAt: new Date(),
    },
    include: {
      requester: { select: { id: true, name: true, username: true } },
      receiver: { select: { id: true, name: true, username: true } },
    },
  });

  console.log(`OK: Successfully made ${user1Name} and ${user2Name} friends!`);
  console.log(`  Request ID: ${friendRequest.id}`);
  console.log(`  From: ${friendRequest.requester.username}`);
  console.log(`  To: ${friendRequest.receiver.username}`);
}
