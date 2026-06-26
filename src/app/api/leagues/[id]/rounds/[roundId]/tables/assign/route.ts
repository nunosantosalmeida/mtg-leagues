import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { assignRandomTables, randomizeSeats } from "@/lib/pairing/random";
import { calculateBet } from "@/lib/points/calculator";

type AssignParams = { id: string; roundId: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<AssignParams> }
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
          include: {
            players: {
              include: { leaguePlayer: { select: { id: true } } },
              orderBy: { seatPosition: "asc" },
            },
          },
          orderBy: { tableNumber: "asc" },
        },
        leagueDay: { select: { type: true, name: true, dayNumber: true } },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    if (round.tables.length > 0) {
      const hasResults = await prisma.tablePlayer.findFirst({
        where: {
          table: { roundId: roundId },
          result: { not: "PENDING" },
        },
      });

      if (hasResults) {
        return NextResponse.json(
          { error: "Cannot re-assign: results already recorded for this round" },
          { status: 400 }
        );
      }

      await prisma.tablePlayer.deleteMany({
        where: { table: { roundId: roundId } },
      });

      await prisma.table.deleteMany({
        where: { roundId: roundId },
      });
    }

    const absentPlayerIds = await prisma.roundAbsence.findMany({
      where: { roundId },
      select: { leaguePlayerId: true },
    });
    const absentIds = new Set(absentPlayerIds.map((a) => a.leaguePlayerId));

    const activePlayers = await prisma.leaguePlayer.findMany({
      where: { leagueId: id, isActive: true },
      include: { user: { select: { name: true } } },
    });

    const isPlayoff = round.leagueDay.type === "PLAYOFF";

    if (isPlayoff) {
      const roundInfo = await prisma.round.findUnique({
        where: { id: roundId },
        select: { name: true },
      });
      const isFinalsOrSemis = roundInfo?.name === "Finals" || roundInfo?.name === "Semifinals";

      if (isFinalsOrSemis) {
        const allStandings = [...activePlayers]
          .filter((p) => !absentIds.has(p.id))
          .sort((a, b) => b.points - a.points);

        const requiredPlayers = round.name === "Finals" ? 4 : (league.format === "COMMANDER" ? 4 : 2);
        const finalsPlayers = allStandings.slice(0, requiredPlayers);

        const table = await prisma.table.create({
          data: {
            roundId: roundId,
            tableNumber: 1,
            players: {
              create: finalsPlayers.map((p, i) => ({
                leaguePlayerId: p.id,
                seatPosition: i + 1,
                pointsWagered: 0,
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

        await prisma.round.update({
          where: { id: roundId },
          data: { status: "IN_PROGRESS" },
        });

        return NextResponse.json([table], { status: 201 });
      }

      const assignedPlayerIds = new Set(
        round.tables.flatMap((t) => t.players.map((p) => p.leaguePlayerId))
      );

      const allStandings = [...activePlayers].sort((a, b) => b.points - a.points);
      const absentAssigned = [...assignedPlayerIds].filter((pid) => absentIds.has(pid));
      const availableReserves = allStandings
        .filter((p) => !assignedPlayerIds.has(p.id) && !absentIds.has(p.id))
        .slice(0, absentAssigned.length);

      const replacementMap = new Map<string, string>();
      for (let i = 0; i < absentAssigned.length; i++) {
        if (availableReserves[i]) {
          replacementMap.set(absentAssigned[i], availableReserves[i].id);
        }
      }

      const createdTables: Awaited<ReturnType<typeof prisma.table.create>>[] = [];

      for (const oldTable of round.tables) {
        const newPlayers = oldTable.players.map((tp) => {
          const actualId = replacementMap.get(tp.leaguePlayerId) || tp.leaguePlayerId;
          const player = activePlayers.find((p) => p.id === actualId);
          return {
            leaguePlayerId: actualId,
            seatPosition: tp.seatPosition,
            pointsWagered: player ? calculateBet(player.points) : 0,
          };
        });

        const table = await prisma.table.create({
          data: {
            roundId: roundId,
            tableNumber: oldTable.tableNumber,
            players: {
              create: newPlayers,
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

        createdTables.push(table);
      }

      await prisma.round.update({
        where: { id: roundId },
        data: { status: "IN_PROGRESS" },
      });

      return NextResponse.json(createdTables, { status: 201 });
    }

    const playingPlayers = activePlayers.filter((p) => !absentIds.has(p.id));

    const minPlayers = 2;
    if (playingPlayers.length < minPlayers) {
      return NextResponse.json(
        { error: `Need at least ${minPlayers} playing players to create tables` },
        { status: 400 }
      );
    }

    const playerIds = playingPlayers.map((p: { id: string }) => p.id);
    const tables = assignRandomTables(playerIds, league.format === "COMMANDER" ? 4 : 2);

    const byePlayerId = (league.format !== "COMMANDER" && playerIds.length % 2 !== 0)
      ? playerIds[playerIds.length - 1]
      : null;

    const createdTables: Awaited<ReturnType<typeof prisma.table.create>>[] = [];

    for (let i = 0; i < tables.length; i++) {
      const tablePlayers = tables[i];
      const seats = randomizeSeats(tablePlayers);

      const table = await prisma.table.create({
        data: {
          roundId: roundId,
          tableNumber: i + 1,
          players: {
            create: seats.map((seat) => {
              const player = activePlayers.find((p: { id: string; points: number }) => p.id === seat.playerId);
              return {
                leaguePlayerId: seat.playerId,
                seatPosition: seat.seatPosition,
                pointsWagered: player ? calculateBet(player.points) : 0,
              };
            }),
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

      createdTables.push(table);
    }

    if (byePlayerId) {
      const byePlayer = activePlayers.find((p) => p.id === byePlayerId);
      if (byePlayer) {
        const bet = calculateBet(byePlayer.points);

        await prisma.table.create({
          data: {
            roundId: roundId,
            tableNumber: createdTables.length + 1,
            players: {
              create: {
                leaguePlayerId: byePlayerId,
                seatPosition: 1,
                result: "WIN",
                pointsWagered: bet,
                pointsChange: bet,
              },
            },
          },
        });

        await prisma.leaguePlayer.update({
          where: { id: byePlayerId },
          data: { points: { increment: bet } },
        });

        await prisma.playerPointChange.create({
          data: {
            leaguePlayerId: byePlayerId,
            roundId: roundId,
            type: "WIN",
            amount: bet,
            description: `Day ${round.leagueDay.dayNumber} (${round.leagueDay.name || "Regular"}) - Round ${round.roundNumber} - Bye`,
          },
        });
      }
    }

    await prisma.round.update({
      where: { id: roundId },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json(createdTables, { status: 201 });
  } catch (error) {
    console.error("Error assigning tables:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
