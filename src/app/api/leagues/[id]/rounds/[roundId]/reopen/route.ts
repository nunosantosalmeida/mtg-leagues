import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateBet } from "@/lib/points/calculator";

type ReopenParams = { id: string; roundId: string };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<ReopenParams> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, roundId } = await params;
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

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tables: {
          include: { players: true },
        },
        leagueDay: {
          select: { status: true },
        },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    if (round.leagueDay.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot re-open rounds after the day has been closed" },
        { status: 400 }
      );
    }

    if (round.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Only completed rounds can be re-opened" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const pointChanges = await tx.playerPointChange.findMany({
        where: { roundId },
      });

      for (const change of pointChanges) {
        await tx.leaguePlayer.update({
          where: { id: change.leaguePlayerId },
          data: {
            points: {
              decrement: change.amount,
            },
          },
        });
      }

      await tx.playerPointChange.deleteMany({
        where: { roundId },
      });

      const playerIds = round.tables.flatMap((t) => t.players.map((tp) => tp.leaguePlayerId));
      const refreshedPlayers = await tx.leaguePlayer.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, points: true },
      });
      const refreshedPoints = new Map(refreshedPlayers.map((p) => [p.id, p.points]));

      for (const table of round.tables) {
        for (const tp of table.players) {
          const currentPoints = refreshedPoints.get(tp.leaguePlayerId) ?? 1500;
          await tx.tablePlayer.update({
            where: { id: tp.id },
            data: {
              result: "PENDING",
              pointsWagered: calculateBet(currentPoints),
              pointsChange: 0,
            },
          });
        }
      }

      await tx.roundAbsence.deleteMany({
        where: { roundId },
      });

      await tx.round.update({
        where: { id: roundId },
        data: { status: "IN_PROGRESS" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error re-opening round:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
