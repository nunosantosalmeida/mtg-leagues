import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateTableResults, calculateBet, TableCalculationInput } from "@/lib/points/calculator";
import { calculateMatchPoints } from "@/lib/points/competitive";

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
        { status: 400 }
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
        { status: 400 }
      );
    }

    const tablePlayers = await prisma.tablePlayer.findMany({
      where: { tableId },
      include: { leaguePlayer: true },
    });

    const scoringSystem = table.round.leagueDay.league.scoringSystem;

    if (scoringSystem === "COMPETITIVE") {
      for (const resultEntry of results) {
        const tp = tablePlayers.find(
          (p) => p.leaguePlayerId === resultEntry.leaguePlayerId
        );
        if (!tp) continue;

        const result = resultEntry.result || "LOSS";
        const matchPoints = calculateMatchPoints(result as "WIN" | "DRAW" | "ABSENT" | "LOSS");
        const gamesWon = resultEntry.gamesWon ?? 0;
        const gamesDrawn = resultEntry.gamesDrawn ?? 0;
        const gamesLost = resultEntry.gamesLost ?? 0;

        await prisma.tablePlayer.update({
          where: { id: tp.id },
          data: {
            result,
            matchPoints,
            gamesWon,
            gamesDrawn,
            gamesLost,
          },
        });
      }

      for (const tp of tablePlayers) {
        const resultEntry = results.find(
          (r: { leaguePlayerId: string }) => r.leaguePlayerId === tp.leaguePlayerId
        );
        if (!resultEntry && tp.result === "PENDING") {
          await prisma.tablePlayer.update({
            where: { id: tp.id },
            data: {
              result: "ABSENT",
              matchPoints: 0,
              gamesWon: 0,
              gamesDrawn: 0,
              gamesLost: 0,
            },
          });
        }
      }
    } else {
      const calcInputs: TableCalculationInput[] = tablePlayers.map((tp) => {
        const resultEntry = results.find(
          (r: { leaguePlayerId: string; result: string }) =>
            r.leaguePlayerId === tp.leaguePlayerId
        );
        return {
          leaguePlayerId: tp.leaguePlayerId,
          points: tp.leaguePlayer.points,
          result: (resultEntry?.result || "ABSENT") as "WIN" | "DRAW" | "ABSENT" | "PENDING",
        };
      });

      const calcResults = calculateTableResults(calcInputs);

      for (const calc of calcResults) {
        const tablePlayer = tablePlayers.find(
          (tp) => tp.leaguePlayerId === calc.leaguePlayerId
        );

        if (tablePlayer) {
          await prisma.tablePlayer.update({
            where: { id: tablePlayer.id },
            data: {
              result: ["WIN", "THREE_PLAYER_BONUS", "FIVE_PLAYER_PENALTY"].includes(calc.changeType)
                ? "WIN"
                : calc.changeType === "DRAW_SHARE"
                  ? "DRAW"
                  : "ABSENT",
              pointsWagered: calc.bet,
              pointsChange: calc.pointsChange,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording results:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
