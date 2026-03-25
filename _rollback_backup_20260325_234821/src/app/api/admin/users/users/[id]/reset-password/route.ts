import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";
import { CONFIG } from "@/lib/config";
import { validatePassword } from "@/lib/validation";

export const POST = withAdmin(async (req, { params }) => {
  const targetId = params.id as string;
  const { newPassword } = await req.json();

  if (typeof newPassword !== "string" || !newPassword) {
    return NextResponse.json({ error: "New password is required" }, { status: 400 });
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return NextResponse.json({ error: passwordValidation.errors.join(". ") }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, CONFIG.auth.bcryptRounds);
  await prisma.user.update({ where: { id: targetId }, data: { password: hashedPassword } });

  return NextResponse.json({ success: true });
});
