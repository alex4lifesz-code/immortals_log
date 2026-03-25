import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/validation";
import { CONFIG } from "@/lib/config";

export const POST = withAuth(async (req, { auth }) => {
  const { currentPassword, newPassword } = await req.json();

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Current and new passwords are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const validCurrent = await bcrypt.compare(currentPassword, user.password);
  if (!validCurrent) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return NextResponse.json({ error: passwordValidation.errors.join(". ") }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, CONFIG.auth.bcryptRounds);
  await prisma.user.update({ where: { id: auth.userId }, data: { password: hashedPassword } });

  return NextResponse.json({ success: true });
});
