import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateLateEntryPoints } from "@/lib/points/calculator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        players: true,
        days: {
          include: {
            rounds: {
              include: {
                tables: {
                  include: { players: { select: { result: true } } },
                },
              },
            },
          },
          orderBy: { dayNumber: "asc" },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.status !== "REGISTRATION") {
      return NextResponse.json(
        { error: "Can only join leagues in registration phase" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const existingPlayer = league.players.find(
      (p: { userId: string }) => p.userId === userId
    );

    if (existingPlayer) {
      return NextResponse.json(
        { error: "Already joined this league" },
        { status: 409 }
      );
    }

    const totalRounds = league.days.reduce(
      (sum: number, day: { rounds: { status: string; tables: { players: { result: string }[] }[] }[] }) =>
        sum + day.rounds.filter((r) => {
          if (r.status === "COMPLETED") return true;
          if (r.status === "IN_PROGRESS" && r.tables.length > 0) {
            return r.tables.every((t) => t.players.every((p) => p.result !== "PENDING"));
          }
          return false;
        }).length,
      0
    );

    const missedRounds = league.status === "REGISTRATION" ? 0 : totalRounds;
    const startingPoints =
      missedRounds > 0 ? calculateLateEntryPoints(missedRounds) : 1500;

    const leaguePlayer = await prisma.leaguePlayer.create({
      data: {
        leagueId: id,
        userId: userId,
        points: startingPoints,
      },
    });

    if (missedRounds > 0) {
      await prisma.playerPointChange.create({
        data: {
          leaguePlayerId: leaguePlayer.id,
          type: "LATE_ENTRY",
          amount: startingPoints - 1500,
          description: `Joined late, missed ${missedRounds} round(s)`,
        },
      });
    } else {
      await prisma.playerPointChange.create({
        data: {
          leaguePlayerId: leaguePlayer.id,
          type: "INITIAL",
          amount: 1500,
          description: "Starting points",
        },
      });
    }

    return NextResponse.json(leaguePlayer, { status: 201 });
  } catch (error) {
    console.error("Error joining league:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
