import { prisma } from "@/lib/prisma";

export const IMMORTAL_FRIEND_CODE_REGEX = /^immortal\d{4}$/;

export function normalizeFriendCode(friendCode: unknown): string {
  return typeof friendCode === "string" ? friendCode.trim().toLowerCase() : "";
}

export function isImmortalFriendCode(friendCode: string): boolean {
  return IMMORTAL_FRIEND_CODE_REGEX.test(friendCode);
}

export function createImmortalFriendCodeCandidate(): string {
  const digits = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `immortal${digits}`;
}

export async function generateUniqueImmortalFriendCode(maxAttempts = 30): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = createImmortalFriendCodeCandidate();
    const existing = await prisma.user.findUnique({
      where: { friendCode: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique friend code");
}
