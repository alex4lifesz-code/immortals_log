import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { CONFIG } from "@/lib/config";
import { validatePassword } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || typeof token !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors.join(". ") }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, CONFIG.auth.bcryptRounds);

    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.update({ where: { tokenHash }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
