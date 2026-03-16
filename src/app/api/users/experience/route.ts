import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, xp, source, difficulty } = await req.json();
    
    if (!userId || typeof userId !== "string" || xp === undefined) {
      return NextResponse.json(
        { error: "User ID and XP amount are required" },
        { status: 400 }
      );
    }

    const xpNum = Number(xp);
    if (isNaN(xpNum) || xpNum < 0 || xpNum > 1000) {
      return NextResponse.json(
        { error: "XP must be a number between 0 and 1000" },
        { status: 400 }
      );
    }

    // Update user experience
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        experience: {
          increment: xpNum,
        },
      },
    });

    return NextResponse.json({ 
      newExperience: user.experience,
      xpAwarded: xpNum,
      source,
      difficulty 
    });
    
  } catch (error) {
    console.error("Experience award error:", error);
    return NextResponse.json(
      { error: "Failed to award experience" },
      { status: 500 }
    );
  }
}

// Get user experience
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        username: true,
        name: true,
        experience: true 
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      user: {
        ...user,
        experience: user.experience || 0,
      }
    });
    
  } catch (error) {
    console.error("Experience fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user experience" },
      { status: 500 }
    );
  }
}