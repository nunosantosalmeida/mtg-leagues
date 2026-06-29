import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLeagueSchema } from "@/lib/validations/league";
import { isCommanderFormat } from "@/lib/types";

export async function GET() {
  try {
    const leagues = await prisma.league.findMany({
      include: {
        _count: { select: { players: true } },
        creator: { select: { name: true, email: true } },
        days: {
          where: { type: "PLAYOFF" },
          include: {
            rounds: {
              where: { name: { in: ["Finals", "Final"] }, status: "COMPLETED" },
              include: {
                tables: {
                  include: {
                    players: {
                      where: { result: "WIN" },
                      include: {
                        leaguePlayer: {
                          include: { user: { select: { name: true } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        players: {
          where: { isActive: true },
          include: { user: { select: { name: true } } },
          orderBy: { points: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leagues);
  } catch (error) {
    console.error("Error fetching leagues:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createLeagueSchema.parse(body);

    const scoringSystem = isCommanderFormat(validated.format) ? "POINTS" : validated.scoringSystem;

    const league = await prisma.league.create({
      data: {
        name: validated.name,
        description: validated.description,
        format: validated.format,
        bestOf: validated.bestOf,
        totalDays: validated.totalDays,
        roundsPerDay: validated.roundsPerDay,
        weekday: validated.weekday,
        scoringSystem,
        status: "REGISTRATION",
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(league, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.message }, { status: 400 });
    }
    console.error("Error creating league:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
