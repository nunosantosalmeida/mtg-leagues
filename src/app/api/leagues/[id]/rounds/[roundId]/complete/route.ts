import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ScoringService } from "@/lib/services/scoring";
import { isCommanderFormat } from "@/lib/types";
import { calculateBet } from "@/lib/points/calculator";

type CompleteParams = { id: string; roundId: string };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<CompleteParams> },
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
            players: { include: { leaguePlayer: true } },
          },
        },
        absences: { include: { leaguePlayer: true } },
        leagueDay: { select: { type: true, name: true, dayNumber: true } },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const prevRound = await prisma.round.findFirst({
      where: {
        leagueDayId: round.leagueDayId,
        roundNumber: round.roundNumber - 1,
      },
      select: { status: true },
    });
    if (prevRound && prevRound.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Previous round must be completed before closing this round" },
        { status: 400 },
      );
    }

    if (round.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Round is not in progress" },
        { status: 400 },
      );
    }

    const isTraditional = league.scoringSystem === "TRADITIONAL";

    // Auto-resolve bye tables: 1-player tables with PENDING result get a WIN
    if (isTraditional && !isCommanderFormat(league.format)) {
      const BYE_MATCH_POINTS = 3;
      for (const table of round.tables) {
        if (table.players.length === 1 && table.players[0].result === "PENDING") {
          await prisma.tablePlayer.update({
            where: { id: table.players[0].id },
            data: {
              result: "WIN",
              matchPoints: BYE_MATCH_POINTS,
              pointsWagered: 0,
              pointsChange: 0,
              gamesWon: 0,
              gamesDrawn: 0,
              gamesLost: 0,
            },
          });
        }
      }
    }

    // Check all results recorded (re-fetch tables to reflect bye updates)
    const currentTables = await prisma.table.findMany({
      where: { roundId },
      include: { players: true },
    });
    const allRecorded = currentTables.every((table) =>
      table.players.every((p) => p.result !== "PENDING"),
    );

    if (!allRecorded) {
      return NextResponse.json(
        { error: "Not all results have been recorded yet" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId,
        roundNumber: round.roundNumber,
        dayNumber: round.leagueDay.dayNumber,
        dayName: round.leagueDay.name,
        tables: round.tables.map((t) => ({
          tableId: t.id,
          tableNumber: t.tableNumber,
          players: t.players.map((tp) => ({
            leaguePlayerId: tp.leaguePlayerId,
            points: tp.leaguePlayer.points,
            result: tp.result,
            gamesWon: tp.gamesWon,
            gamesDrawn: tp.gamesDrawn,
            gamesLost: tp.gamesLost,
          })),
        })),
        absences: round.absences.map((a) => ({
          leaguePlayerId: a.leaguePlayerId,
          points: a.leaguePlayer.points,
        })),
        format: league.format,
        scoringSystem: league.scoringSystem,
        dayType: round.leagueDay.type,
        roundName: round.name,
      });
    });

    const isPlayoff = round.leagueDay.type === "PLAYOFF";
    const isCommanderSemifinal = round.name === "Semifinals" && isCommanderFormat(league.format);
    const isCommanderFinals = round.name === "Finals" && isCommanderFormat(league.format);
    const isFinalRound = round.name === "Finals" || round.name === "Final";

    if (isCommanderSemifinal) {
      await advanceCommanderSemifinals(id, roundId, round.leagueDayId);
    }

    if (isPlayoff && !isFinalRound && !isCommanderSemifinal) {
      await advancePlayoffWinners(roundId, round.roundNumber, round.leagueDayId);
    }

    if (!isPlayoff && isTraditional && !isCommanderFormat(league.format)) {
      await autoAssignSwissNextRound(id, round.leagueDayId, round.roundNumber);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing round:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function advanceCommanderSemifinals(
  leagueId: string,
  roundId: string,
  leagueDayId: string,
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { tables: { include: { players: { include: { leaguePlayer: true } } } } },
  });
  if (!round) return;

  const podWinners: { leaguePlayerId: string; seed: number }[] = [];

  for (const table of round.tables) {
    const winCounts = new Map<string, number>();
    for (const tp of table.players) {
      if (tp.result === "WIN") {
        winCounts.set(tp.leaguePlayerId, (winCounts.get(tp.leaguePlayerId) || 0) + 1);
      }
    }

    let winnerId: string | null = null;
    let maxWins = -1;
    for (const [playerId, count] of winCounts) {
      if (count > maxWins) {
        maxWins = count;
        winnerId = playerId;
      }
    }

    if (!winnerId) {
      let maxPoints = -1;
      for (const tp of table.players) {
        if (tp.leaguePlayer.points > maxPoints) {
          maxPoints = tp.leaguePlayer.points;
          winnerId = tp.leaguePlayerId;
        }
      }
    }

    if (winnerId) {
      const player = table.players.find((p) => p.leaguePlayerId === winnerId);
      if (player) {
        podWinners.push({
          leaguePlayerId: winnerId,
          seed: table.players.indexOf(player) + 1,
        });
      }
    }
  }

  if (podWinners.length === 0) return;

  const finalsRound = await prisma.round.findFirst({
    where: { leagueDayId, name: "Finals" },
    include: { tables: { include: { players: true } } },
  });

  if (!finalsRound || finalsRound.tables.length === 0) return;
  const finalsTable = finalsRound.tables[0];
  const existingIds = new Set(finalsTable.players.map((p) => p.leaguePlayerId));

  const maxFinalsSeed = finalsTable.players.length;
  let nextSeed = maxFinalsSeed + 1;

  const prePlayoffStandings = await prisma.leaguePlayer.findMany({
    where: { leagueId, isActive: true },
    include: { pointChanges: { include: { round: { include: { leagueDay: true } } } } },
  });

  const playerSeeds = prePlayoffStandings
    .map((p) => {
      const regularPoints = p.pointChanges
        .filter((pc) => pc.round?.leagueDay?.type === "REGULAR")
        .reduce((sum, pc) => sum + pc.amount, 0);
      return { id: p.id, points: regularPoints };
    })
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ id: p.id, seed: i + 1 }));

  const seedMap = new Map(playerSeeds.map((p) => [p.id, p.seed]));

  const sortedWinners = [...podWinners].sort(
    (a, b) => (seedMap.get(a.leaguePlayerId) || 999) - (seedMap.get(b.leaguePlayerId) || 999),
  );

  for (const winner of sortedWinners) {
    if (!existingIds.has(winner.leaguePlayerId)) {
      const playerSeed = seedMap.get(winner.leaguePlayerId) || nextSeed;
      await prisma.tablePlayer.create({
        data: {
          tableId: finalsTable.id,
          leaguePlayerId: winner.leaguePlayerId,
          seatPosition: playerSeed,
          pointsWagered: 0,
        },
      });
      nextSeed++;
    }
  }

  const allFinalsPlayers = await prisma.tablePlayer.findMany({
    where: { tableId: finalsTable.id },
    orderBy: { seatPosition: "asc" },
  });

  for (let i = 0; i < allFinalsPlayers.length; i++) {
    await prisma.tablePlayer.update({
      where: { id: allFinalsPlayers[i].id },
      data: { seatPosition: i + 1 },
    });
  }
}

async function advancePlayoffWinners(
  roundId: string,
  roundNumber: number,
  leagueDayId: string,
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { tables: { include: { players: true } } },
  });
  if (!round) return;

  const winners: { leaguePlayerId: string; tableNumber: number }[] = [];
  for (const table of round.tables) {
    for (const tp of table.players) {
      if (tp.result === "WIN") {
        winners.push({ leaguePlayerId: tp.leaguePlayerId, tableNumber: table.tableNumber });
      }
    }
  }

  if (winners.length === 0) return;

  const nextRound = await prisma.round.findFirst({
    where: { leagueDayId, roundNumber: { gt: roundNumber } },
    orderBy: { roundNumber: "asc" },
    include: { tables: { include: { players: true }, orderBy: { tableNumber: "asc" } } },
  });

  if (!nextRound) return;

  for (const winner of winners) {
    const nextMatch = Math.ceil(winner.tableNumber / 2);
    const seatInMatch = winner.tableNumber % 2 === 1 ? 1 : 2;
    const targetTable = nextRound.tables.find((t) => t.tableNumber === nextMatch);

    if (targetTable) {
      const existing = await prisma.tablePlayer.findFirst({
        where: { tableId: targetTable.id, leaguePlayerId: winner.leaguePlayerId },
      });

      if (!existing) {
        await prisma.tablePlayer.create({
          data: {
            tableId: targetTable.id,
            leaguePlayerId: winner.leaguePlayerId,
            seatPosition: seatInMatch,
            pointsWagered: 0,
          },
        });
      }
    }
  }

  if (nextRound.status === "PLANNED") {
    await prisma.round.update({
      where: { id: nextRound.id },
      data: { status: "IN_PROGRESS" },
    });
  }
}

async function autoAssignSwissNextRound(
  leagueId: string,
  leagueDayId: string,
  roundNumber: number,
) {
  const nextRound = await prisma.round.findFirst({
    where: { leagueDayId, roundNumber: roundNumber + 1 },
    select: { id: true, status: true, roundNumber: true },
  });

  if (!nextRound || nextRound.status !== "PLANNED") return;

  const { assignSwissPairings } = await import("@/lib/pairing/swiss");

  const allPlayers = await prisma.leaguePlayer.findMany({
    where: { leagueId, isActive: true },
  });

  const allTablePlayers = await prisma.tablePlayer.findMany({
    where: {
      table: {
        round: {
          leagueDay: { leagueId },
          status: "COMPLETED",
        },
      },
      result: { not: "PENDING" },
    },
    include: {
      table: {
        include: { players: { select: { leaguePlayerId: true } } },
      },
    },
  });

  const previousMatchups = new Set<string>();
  for (const tp of allTablePlayers) {
    if (tp.table.players.length === 2) {
      const opp = tp.table.players.find((p) => p.leaguePlayerId !== tp.leaguePlayerId);
      if (opp) {
        const key = [tp.leaguePlayerId, opp.leaguePlayerId].sort().join(":");
        previousMatchups.add(key);
      }
    }
  }

  const previousByeTables = await prisma.tablePlayer.findMany({
    where: {
      table: {
        round: {
          leagueDay: { leagueId },
          status: "COMPLETED",
        },
      },
      result: "WIN",
    },
    include: {
      table: { select: { _count: { select: { players: true } } } },
    },
  });

  const previousByes = new Set<string>();
  for (const tp of previousByeTables) {
    if (tp.table._count.players === 1) {
      previousByes.add(tp.leaguePlayerId);
    }
  }

  const playerMatchPoints = new Map<string, number>();
  for (const p of allPlayers) {
    const tpResults = allTablePlayers.filter((tp) => tp.leaguePlayerId === p.id);
    const mp = tpResults.reduce((sum, tp) => sum + tp.matchPoints, 0);
    playerMatchPoints.set(p.id, mp);
  }

  const swissPlayers = allPlayers.map((p) => ({
    id: p.id,
    matchPoints: playerMatchPoints.get(p.id) ?? 0,
  }));

  const swissResult = assignSwissPairings(
    swissPlayers,
    previousMatchups,
    previousByes,
    nextRound.roundNumber,
  );

  const createdTables: { id: string }[] = [];

  for (let i = 0; i < swissResult.pairs.length; i++) {
    const pair = swissResult.pairs[i];
    const p1 = allPlayers.find((p) => p.id === pair.player1Id);
    const p2 = allPlayers.find((p) => p.id === pair.player2Id);
    const table = await prisma.table.create({
      data: {
        roundId: nextRound.id,
        tableNumber: i + 1,
        players: {
          create: [
            { leaguePlayerId: pair.player1Id, seatPosition: 1, pointsWagered: p1 ? calculateBet(p1.points) : 0 },
            { leaguePlayerId: pair.player2Id, seatPosition: 2, pointsWagered: p2 ? calculateBet(p2.points) : 0 },
          ],
        },
      },
    });
    createdTables.push(table);
  }

  if (swissResult.byePlayerId) {
    await prisma.table.create({
      data: {
        roundId: nextRound.id,
        tableNumber: createdTables.length + 1,
        players: {
          create: {
            leaguePlayerId: swissResult.byePlayerId,
            seatPosition: 1,
            result: "PENDING",
            pointsWagered: 0,
            pointsChange: 0,
            matchPoints: 0,
          },
        },
      },
    });
  }

  await prisma.round.update({
    where: { id: nextRound.id },
    data: { status: "IN_PROGRESS" },
  });
}
