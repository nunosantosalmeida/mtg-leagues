import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateBracket, getSeedsFromStandings, getCommanderTopCut } from "@/lib/playoff/bracket";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, dayId } = await params;
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
    const { status } = body;

    if (!["PLANNED", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const day = await prisma.leagueDay.update({
      where: { id: dayId },
      data: { status },
    });

    let playoffGenerated = false;
    let leagueCompleted = false;
    if (status === "COMPLETED") {
      const allDays = await prisma.leagueDay.findMany({
        where: { leagueId: id },
        orderBy: { dayNumber: "asc" },
      });

      const allDaysClosed = allDays.every((d) => d.status === "COMPLETED");
      if (allDaysClosed) {
        await prisma.league.update({
          where: { id },
          data: { status: "COMPLETED" },
        });
        leagueCompleted = true;
      }

      const regularDays = allDays.filter((d) => d.type === "REGULAR");

      const allRegularClosed = regularDays.every((d) => d.status === "COMPLETED");
      const existingPlayoff = await prisma.leagueDay.findFirst({
        where: { leagueId: id, type: "PLAYOFF" },
      });

      if (allRegularClosed && !existingPlayoff) {
        const players = await prisma.leaguePlayer.findMany({
          where: { leagueId: id, isActive: true },
          include: {
            user: { select: { name: true } },
            pointChanges: {
              include: { round: { include: { leagueDay: true } } },
            },
          },
        });

        const standings = players
          .map((p) => {
            const regularChanges = p.pointChanges.filter(
              (pc) => pc.round?.leagueDay?.type === "REGULAR"
            );
            let wins = 0, losses = 0, draws = 0;
            for (const c of regularChanges) {
              if (c.type === "WIN") wins++;
              else if (c.type === "ABSENT" || c.type === "NO_SHOW") losses++;
              else if (c.type === "DRAW") draws++;
            }
            const matchesPlayed = wins + losses + draws;
            return {
              leaguePlayerId: p.id,
              playerName: p.user.name,
              points: p.points,
              wins, losses, draws,
              matchesPlayed,
              opponentMatchWinPercentage: 0.5,
              gameWinPercentage: matchesPlayed > 0 ? wins / matchesPlayed : 0,
            };
          })
          .sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses || b.gameWinPercentage - a.gameWinPercentage);

        const topCut = league.format === "COMMANDER"
          ? getCommanderTopCut(standings.length)
          : Math.min(8, standings.length);

        if (standings.length >= topCut) {
          const qualified = standings.slice(0, topCut);
          const seeds = getSeedsFromStandings(qualified);
          const bracket = generateBracket(seeds, topCut, league.format);

          const lastRegularDay = regularDays[regularDays.length - 1];
          const playoffDate = new Date();
          if (lastRegularDay) {
            playoffDate.setTime(lastRegularDay.date.getTime() + 7 * 24 * 60 * 60 * 1000);
          }

          const playoffDay = await prisma.leagueDay.create({
            data: {
              leagueId: id,
              dayNumber: (lastRegularDay?.dayNumber ?? 0) + 1,
              date: playoffDate,
              status: "PLANNED",
              type: "PLAYOFF",
              name: `Top ${topCut}`,
            },
          });

          const maxRound = await prisma.round.aggregate({
            where: { leagueDay: { leagueId: id } },
            _max: { roundNumber: true },
          });
          let nextRoundNumber = (maxRound._max.roundNumber ?? 0) + 1;

          if (league.format === "COMMANDER") {
            const hasSemifinals = bracket.pods.length > 0;

            if (hasSemifinals) {
              const semisRound = await prisma.round.create({
                data: {
                  leagueDayId: playoffDay.id,
                  roundNumber: nextRoundNumber,
                  status: "PLANNED",
                  name: "Semifinals",
                },
              });
              for (const pod of bracket.pods) {
                const table = await prisma.table.create({
                  data: { roundId: semisRound.id, tableNumber: pod.podNumber },
                });
                await prisma.tablePlayer.createMany({
                  data: pod.players.map((p, i) => ({
                    tableId: table.id,
                    leaguePlayerId: p.leaguePlayerId,
                    seatPosition: i + 1,
                    pointsWagered: 0,
                  })),
                });
              }
              nextRoundNumber++;
            }

            const finalsRound = await prisma.round.create({
              data: {
                leagueDayId: playoffDay.id,
                roundNumber: nextRoundNumber,
                status: "PLANNED",
                name: "Finals",
              },
            });
            const finalsTable = await prisma.table.create({
              data: { roundId: finalsRound.id, tableNumber: 1 },
            });
            await prisma.tablePlayer.createMany({
              data: bracket.byes.map((p, i) => ({
                tableId: finalsTable.id,
                leaguePlayerId: p.leaguePlayerId,
                seatPosition: i + 1,
                pointsWagered: 0,
              })),
            });
          } else {
            const totalRounds = bracket.totalRounds;
            const roundsMap: Record<number, string> = {};
            for (let r = 0; r < totalRounds; r++) {
              const roundsFromEnd = totalRounds - 1 - r;
              const roundName = roundsFromEnd === 0 ? "Final"
                : roundsFromEnd === 1 ? "Semifinals"
                : roundsFromEnd === 2 ? "Quarterfinals"
                : `Round of ${Math.pow(2, roundsFromEnd + 1)}`;
              const round = await prisma.round.create({
                data: { leagueDayId: playoffDay.id, roundNumber: nextRoundNumber + r, status: "PLANNED", name: roundName },
              });
              roundsMap[r] = round.id;
            }
            for (const match of bracket.matches) {
              const table = await prisma.table.create({
                data: { roundId: roundsMap[match.round - 1], tableNumber: match.matchNumber },
              });
              if (match.leaguePlayerId1 && match.leaguePlayerId2) {
                await prisma.tablePlayer.createMany({
                  data: [
                    { tableId: table.id, leaguePlayerId: match.leaguePlayerId1, seatPosition: 1, pointsWagered: 0 },
                    { tableId: table.id, leaguePlayerId: match.leaguePlayerId2, seatPosition: 2, pointsWagered: 0 },
                  ],
                });
              }
            }
          }

          playoffGenerated = true;
        }
      }
    }

    return NextResponse.json({ ...day, playoffGenerated, leagueCompleted });
  } catch (error) {
    console.error("Error updating day:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
