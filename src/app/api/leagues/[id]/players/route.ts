import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateStartingPoints } from "@/lib/points/calculator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (admin?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const league = await prisma.league.findUnique({
      where: { id },
      include: {
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingPlayer = await prisma.leaguePlayer.findUnique({
      where: { leagueId_userId: { leagueId: id, userId } },
    });

    if (existingPlayer) {
      return NextResponse.json({ error: "Player already in this league" }, { status: 409 });
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
    const basePoints = calculateStartingPoints(league.scoringSystem, missedRounds);

    const leaguePlayer = await prisma.leaguePlayer.create({
      data: {
        leagueId: id,
        userId,
        points: basePoints,
      },
    });

    await prisma.playerPointChange.create({
      data: {
        leaguePlayerId: leaguePlayer.id,
        type: missedRounds > 0 && league.scoringSystem !== "TRADITIONAL" ? "LATE_ENTRY" : "INITIAL",
        amount: missedRounds > 0 && league.scoringSystem !== "TRADITIONAL" ? basePoints - 1500 : basePoints,
        description: missedRounds > 0 && league.scoringSystem !== "TRADITIONAL"
          ? `Added by admin, missed ${missedRounds} round(s)`
          : "Starting points",
      },
    });

    return NextResponse.json(leaguePlayer, { status: 201 });
  } catch (error) {
    console.error("Error enrolling player:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdmin = currentUser?.role === "ADMIN";
    const isSelf = userId === session.user.id;

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const leaguePlayer = await prisma.leaguePlayer.findUnique({
      where: { leagueId_userId: { leagueId: id, userId } },
    });

    if (!leaguePlayer) {
      return NextResponse.json({ error: "Player not in this league" }, { status: 404 });
    }

    await prisma.tablePlayer.deleteMany({
      where: { leaguePlayerId: leaguePlayer.id },
    });

    await prisma.playerPointChange.deleteMany({
      where: { leaguePlayerId: leaguePlayer.id },
    });

    await prisma.leaguePlayer.delete({
      where: { id: leaguePlayer.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing player:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
