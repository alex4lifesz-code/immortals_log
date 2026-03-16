import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Dao name and secret art are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (!user) {
      return NextResponse.json(
        { error: "Cultivator not found in the sect records" },
        { status: 404 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect secret art" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
