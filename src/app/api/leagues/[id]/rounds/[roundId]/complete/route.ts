import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateTableResults, calculateBet, TableCalculationInput } from "@/lib/points/calculator";
import { isCommanderFormat } from "@/lib/types";

type CompleteParams = { id: string; roundId: string };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<CompleteParams> }
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
              include: { leaguePlayer: true },
            },
          },
        },
        absences: {
          include: { leaguePlayer: true },
        },
        leagueDay: {
          select: { type: true, name: true, dayNumber: true },
        },
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
        { status: 400 }
      );
    }

    if (round.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Round is not in progress" },
        { status: 400 }
      );
    }

    const allRecorded = round.tables.every((table) =>
      table.players.every((p) => p.result !== "PENDING")
    );

    if (!allRecorded) {
      return NextResponse.json(
        { error: "Not all results have been recorded yet" },
        { status: 400 }
      );
    }

    const isPlayoff = round.leagueDay.type === "PLAYOFF";
    const isCommanderSemifinal = round.name === "Semifinals" && isCommanderFormat(league.format);
    const isCommanderFinals = round.name === "Finals" && isCommanderFormat(league.format);
    const skipPointCalc = isCommanderSemifinal || isCommanderFinals;
    const isFinalRound = round.name === "Finals" || round.name === "Final";
    const isCompetitive = league.scoringSystem === "COMPETITIVE";

    await prisma.$transaction(async (tx) => {
      if (!skipPointCalc && !isCompetitive) {
        for (const table of round.tables) {
          const calcInputs: TableCalculationInput[] = table.players.map((tp) => ({
            leaguePlayerId: tp.leaguePlayerId,
            points: tp.leaguePlayer.points,
            result: tp.result as "WIN" | "DRAW" | "ABSENT" | "PENDING",
          }));

          const calcResults = calculateTableResults(calcInputs);

          for (const calc of calcResults) {
            const tablePlayer = table.players.find(
              (tp) => tp.leaguePlayerId === calc.leaguePlayerId
            );

            if (tablePlayer) {
              await tx.tablePlayer.update({
                where: { id: tablePlayer.id },
                data: {
                  pointsWagered: calc.bet,
                  pointsChange: calc.pointsChange,
                },
              });
            }

            await tx.leaguePlayer.update({
              where: { id: calc.leaguePlayerId },
              data: { points: calc.pointsAfter },
            });

            await tx.playerPointChange.create({
              data: {
                leaguePlayerId: calc.leaguePlayerId,
                roundId,
                type: calc.changeType,
                amount: calc.pointsChange,
                description: `Day ${round.leagueDay.dayNumber} (${round.leagueDay.name || "Regular"}) - Round ${round.roundNumber} - Table ${table.tableNumber} - ${calc.changeType}`,
              },
            });
          }
        }

        for (const absence of round.absences) {
          const bet = calculateBet(absence.leaguePlayer.points);

          await tx.leaguePlayer.update({
            where: { id: absence.leaguePlayerId },
            data: { points: { decrement: bet } },
          });

          await tx.playerPointChange.create({
            data: {
              leaguePlayerId: absence.leaguePlayerId,
              roundId,
              type: "ABSENT",
              amount: -bet,
              description: `Day ${round.leagueDay.dayNumber} (${round.leagueDay.name || "Regular"}) - Round ${round.roundNumber} - Absent`,
            },
          });
        }
      }

      if (isCompetitive && !skipPointCalc) {
        for (const table of round.tables) {
          for (const tp of table.players) {
            const matchPoints = tp.matchPoints;
            const currentPoints = tp.leaguePlayer.points;
            const newPoints = currentPoints + matchPoints;

            await tx.leaguePlayer.update({
              where: { id: tp.leaguePlayerId },
              data: { points: newPoints },
            });

            if (matchPoints !== 0) {
              await tx.playerPointChange.create({
                data: {
                  leaguePlayerId: tp.leaguePlayerId,
                  roundId,
                  type: matchPoints > 0 ? "WIN" : "DRAW",
                  amount: matchPoints,
                  description: `Day ${round.leagueDay.dayNumber} (${round.leagueDay.name || "Regular"}) - Round ${round.roundNumber} - Table ${table.tableNumber} - ${matchPoints} MP`,
                },
              });
            }
          }
        }

        for (const absence of round.absences) {
          await tx.playerPointChange.create({
            data: {
              leaguePlayerId: absence.leaguePlayerId,
              roundId,
              type: "ABSENT",
              amount: 0,
              description: `Day ${round.leagueDay.dayNumber} (${round.leagueDay.name || "Regular"}) - Round ${round.roundNumber} - Absent`,
            },
          });
        }
      }

      await tx.round.update({
        where: { id: roundId },
        data: { status: "COMPLETED" },
      });
    });

    if (isCommanderSemifinal) {
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
        for (const [id, count] of winCounts) {
          if (count > maxWins) {
            maxWins = count;
            winnerId = id;
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

      if (podWinners.length > 0) {
        const finalsRound = await prisma.round.findFirst({
          where: { leagueDayId: round.leagueDayId, name: "Finals" },
          include: {
            tables: {
              include: { players: true },
            },
          },
        });

        if (finalsRound && finalsRound.tables.length > 0) {
          const finalsTable = finalsRound.tables[0];
          const existingIds = new Set(finalsTable.players.map((p) => p.leaguePlayerId));

          const maxFinalsSeed = finalsTable.players.length;
          let nextSeed = maxFinalsSeed + 1;

          const maxRoundSeed = await prisma.round.aggregate({
            where: { leagueDay: { leagueId: id } },
            _max: { roundNumber: true },
          });

          const prePlayoffStandings = await prisma.leaguePlayer.findMany({
            where: { leagueId: id, isActive: true },
            include: { pointChanges: { include: { round: { include: { leagueDay: true } } } } },
          });

          const playerSeeds = prePlayoffStandings
            .map((p) => {
              const regularPoints = p.pointChanges
                .filter((pc) => pc.round?.leagueDay?.type === "REGULAR")
                .reduce((sum, pc) => sum + pc.amount, 0);
              return { id: p.id, points: p.points - regularPoints };
            })
            .sort((a, b) => b.points - a.points)
            .map((p, i) => ({ id: p.id, seed: i + 1 }));

          const seedMap = new Map(playerSeeds.map((p) => [p.id, p.seed]));

          const sortedWinners = [...podWinners].sort(
            (a, b) => (seedMap.get(a.leaguePlayerId) || 999) - (seedMap.get(b.leaguePlayerId) || 999)
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
      }
    }

    if (isPlayoff && !isFinalRound && !isCommanderSemifinal) {
      const winners: { leaguePlayerId: string; tableNumber: number }[] = [];

      for (const table of round.tables) {
        for (const tp of table.players) {
          if (tp.result === "WIN") {
            winners.push({ leaguePlayerId: tp.leaguePlayerId, tableNumber: table.tableNumber });
          }
        }
      }

      if (winners.length > 0) {
        const nextRound = await prisma.round.findFirst({
          where: { leagueDayId: round.leagueDayId, roundNumber: { gt: round.roundNumber } },
          orderBy: { roundNumber: "asc" },
          include: { tables: { include: { players: true }, orderBy: { tableNumber: "asc" } } },
        });

        if (nextRound) {
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
      }
    }

    if (!isPlayoff && isCompetitive && !isCommanderFormat(league.format)) {
      const nextRound = await prisma.round.findFirst({
        where: { leagueDayId: round.leagueDayId, roundNumber: round.roundNumber + 1 },
        select: { id: true, status: true, roundNumber: true },
      });

      if (nextRound && nextRound.status === "PLANNED") {
        const { assignSwissPairings } = await import("@/lib/pairing/swiss");
        const { calculateBet } = await import("@/lib/points/calculator");

        const allPlayers = await prisma.leaguePlayer.findMany({
          where: { leagueId: id, isActive: true },
        });

        const allTablePlayers = await prisma.tablePlayer.findMany({
          where: {
            table: {
              round: {
                leagueDay: { leagueId: id },
                status: "COMPLETED",
              },
            },
            result: { not: "PENDING" },
          },
          include: {
            table: {
              include: {
                players: { select: { leaguePlayerId: true } },
              },
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
                leagueDay: { leagueId: id },
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
          const tpResults = allTablePlayers.filter(
            (tp) => tp.leaguePlayerId === p.id
          );
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

        const createdTables: Awaited<ReturnType<typeof prisma.table.create>>[] = [];

        for (let i = 0; i < swissResult.pairs.length; i++) {
          const pair = swissResult.pairs[i];
          const table = await prisma.table.create({
            data: {
              roundId: nextRound.id,
              tableNumber: i + 1,
              players: {
                create: [
                  { leaguePlayerId: pair.player1Id, seatPosition: 1, pointsWagered: 0 },
                  { leaguePlayerId: pair.player2Id, seatPosition: 2, pointsWagered: 0 },
                ],
              },
            },
          });
          createdTables.push(table);
        }

        if (swissResult.byePlayerId) {
          const BYE_MATCH_POINTS = 3;
          await prisma.table.create({
            data: {
              roundId: nextRound.id,
              tableNumber: createdTables.length + 1,
              players: {
                create: {
                  leaguePlayerId: swissResult.byePlayerId,
                  seatPosition: 1,
                  result: "WIN",
                  pointsWagered: 0,
                  pointsChange: 0,
                  matchPoints: BYE_MATCH_POINTS,
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing round:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
