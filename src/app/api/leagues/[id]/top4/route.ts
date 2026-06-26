import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateBet, calculateWinnerPot } from "@/lib/points/calculator";

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
        players: {
          include: { user: { select: { name: true } } },
          orderBy: { points: "desc" },
        },
        days: {
          include: {
            rounds: {
              include: {
                tables: {
                  include: {
                    players: { where: { result: "WIN" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.createdBy !== session.user.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (user?.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const activePlayers = league.players.filter((p) => p.isActive);
    if (activePlayers.length < 4) {
      return NextResponse.json(
        { error: "Need at least 4 active players for Top 4" },
        { status: 400 }
      );
    }

    const top4 = activePlayers.slice(0, 4);

    const lastDay = league.days[league.days.length - 1];
    if (!lastDay) {
      return NextResponse.json({ error: "No league days found" }, { status: 400 });
    }

    const finalRound = await prisma.round.create({
      data: {
        leagueDayId: lastDay.id,
        roundNumber: 99,
        status: "PLANNED",
      },
    });

    const finalTable = await prisma.table.create({
      data: {
        roundId: finalRound.id,
        tableNumber: 1,
        players: {
          create: top4.map((player, index) => ({
            leaguePlayerId: player.id,
            seatPosition: index + 1,
            pointsWagered: calculateBet(player.points),
          })),
        },
      },
      include: {
        players: {
          include: {
            leaguePlayer: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    await prisma.league.update({
      where: { id },
      data: { status: "TOP4" },
    });

    return NextResponse.json({
      round: finalRound,
      table: finalTable,
      qualifiers: top4.map((p) => ({
        id: p.id,
        name: p.user.name,
        points: Math.round(p.points),
      })),
    });
  } catch (error) {
    console.error("Error setting up Top 4:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const league = await prisma.league.findUnique({ where: { id } });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.createdBy !== session.user.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (user?.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { winnerId } = body;

    if (!winnerId) {
      return NextResponse.json({ error: "Winner ID required" }, { status: 400 });
    }

    const finalRound = await prisma.round.findFirst({
      where: {
        leagueDay: { leagueId: id },
        roundNumber: 99,
      },
      include: { tables: true },
    });

    if (!finalRound || finalRound.tables.length === 0) {
      return NextResponse.json({ error: "Top 4 final not set up" }, { status: 400 });
    }

    const finalTable = finalRound.tables[0];
    const tablePlayers = await prisma.tablePlayer.findMany({
      where: { tableId: finalTable.id },
      include: { leaguePlayer: true },
    });

    const winnerPlayer = tablePlayers.find((tp) => tp.leaguePlayerId === winnerId);
    if (!winnerPlayer) {
      return NextResponse.json({ error: "Winner not found at final table" }, { status: 400 });
    }

    const bets = tablePlayers.map((tp) => tp.pointsWagered);
    const winnerPot = calculateWinnerPot(bets, 4);

    for (const tp of tablePlayers) {
      const isWinner = tp.leaguePlayerId === winnerId;
      const pointsChange = isWinner ? winnerPot : -tp.pointsWagered;
      const pointsAfter = tp.leaguePlayer.points + pointsChange;

      await prisma.tablePlayer.update({
        where: { id: tp.id },
        data: {
          result: isWinner ? "WIN" : "ABSENT",
          pointsChange,
        },
      });

      await prisma.leaguePlayer.update({
        where: { id: tp.leaguePlayerId },
        data: { points: pointsAfter },
      });

      await prisma.playerPointChange.create({
        data: {
          leaguePlayerId: tp.leaguePlayerId,
          roundId: finalRound.id,
          type: isWinner ? "WIN" : "BET",
          amount: pointsChange,
          description: isWinner ? "Top 4 Final Winner" : "Top 4 Final - Lost",
        },
      });
    }

    await prisma.round.update({
      where: { id: finalRound.id },
      data: { status: "COMPLETED" },
    });

    await prisma.league.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    const standings = await prisma.leaguePlayer.findMany({
      where: { leagueId: id },
      include: { user: { select: { name: true } } },
      orderBy: { points: "desc" },
    });

    const rankings = standings.map((p, index) => ({
      position: index + 1,
      name: p.user.name,
      points: Math.round(p.points),
    }));

    return NextResponse.json({ winnerId, rankings });
  } catch (error) {
    console.error("Error completing Top 4:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
