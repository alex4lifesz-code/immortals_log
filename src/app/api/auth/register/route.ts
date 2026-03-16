import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { username, password, name } = await req.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate types
    if (typeof username !== "string" || typeof password !== "string" || typeof name !== "string") {
      return NextResponse.json(
        { error: "Invalid field types" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const trimmedName = name.trim().slice(0, 100);

    // Validate username: 2-30 chars, alphanumeric + underscores/hyphens
    if (trimmedUsername.length < 2 || trimmedUsername.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: "Dao name must be 2-30 characters (letters, numbers, underscores, hyphens)" },
        { status: 400 }
      );
    }

    // Validate password minimum length
    if (password.length < 4 || password.length > 100) {
      return NextResponse.json(
        { error: "Secret art must be between 4 and 100 characters" },
        { status: 400 }
      );
    }

    // Validate display name
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return NextResponse.json(
        { error: "Display name must be between 1 and 100 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (existing) {
      return NextResponse.json(
        { error: "Dao name already taken" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if this is the first user — assign admin role
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "admin" : "user";

    const user = await prisma.user.create({
      data: { username: trimmedUsername, password: hashedPassword, name: trimmedName, role },
    });

    return NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
