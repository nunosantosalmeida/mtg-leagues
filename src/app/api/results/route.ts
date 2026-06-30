import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ResultService, type ResultInput } from "@/lib/services/result";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tableId, results } = body;

    if (!tableId || !results || !Array.isArray(results)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        round: {
          include: {
            leagueDay: {
              include: {
                league: { select: { id: true, createdBy: true, scoringSystem: true } },
              },
            },
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.round.leagueDay.league.createdBy !== session.user.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (user?.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (table.round.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot record results on a completed round" },
        { status: 400 },
      );
    }

    const prevRound = await prisma.round.findFirst({
      where: {
        leagueDayId: table.round.leagueDayId,
        roundNumber: table.round.roundNumber - 1,
      },
      select: { status: true },
    });
    if (prevRound && prevRound.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Previous round must be completed before recording results" },
        { status: 400 },
      );
    }

    const tablePlayers = await prisma.tablePlayer.findMany({
      where: { tableId },
    });

    const validation = ResultService.validateResults(
      results as ResultInput[],
      tablePlayers.map((tp) => tp.leaguePlayerId),
    );

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const isTraditional = table.round.leagueDay.league.scoringSystem === "TRADITIONAL";

    await prisma.$transaction(async (tx) => {
      await ResultService.recordResults(tx, tableId, validation.normalizedResults, isTraditional);

      const pendingPlayers = tablePlayers.filter(
        (tp) => tp.result === "PENDING" && !validation.normalizedResults.find((r) => r.leaguePlayerId === tp.leaguePlayerId),
      );

      for (const tp of pendingPlayers) {
        const data: Record<string, unknown> = { result: "LOSS" };
        if (isTraditional) {
          data.matchPoints = 0;
          data.gamesWon = 0;
          data.gamesDrawn = 0;
          data.gamesLost = 0;
        }
        await tx.tablePlayer.update({ where: { id: tp.id }, data });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording results:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
