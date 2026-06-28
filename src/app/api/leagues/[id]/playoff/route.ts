import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateBracket, getSeedsFromStandings, getCommanderTopCut } from "@/lib/playoff/bracket";
import { isCommanderFormat } from "@/lib/types";
import { computeTiebreakers, sortCompetitiveStandings, CompetitiveStanding, MatchRecord } from "@/lib/points/competitive";

type PlayoffParams = { id: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<PlayoffParams> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { topCut: requestedTopCut, absentPlayerIds = [] } = body;

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

    const existingPlayoff = await prisma.leagueDay.findFirst({
      where: { leagueId: id, type: "PLAYOFF" },
    });
    if (existingPlayoff) {
      return NextResponse.json({ error: "Playoff day already exists" }, { status: 400 });
    }

    const players = await prisma.leaguePlayer.findMany({
      where: { leagueId: id, isActive: true },
      include: {
        user: { select: { name: true } },
        pointChanges: {
          include: { round: { include: { leagueDay: true } } },
        },
        tablePlayers: {
          include: {
            table: {
              include: {
                players: {
                  select: { leaguePlayerId: true, result: true },
                },
              },
            },
          },
        },
      },
    });

    const activePlayers = players.filter((p) => !absentPlayerIds.includes(p.id));

    const topCut = isCommanderFormat(league.format)
      ? getCommanderTopCut(activePlayers.length)
      : requestedTopCut;

    if (!topCut || topCut < 2) {
      return NextResponse.json({ error: "Not enough players for a playoff" }, { status: 400 });
    }

    if (activePlayers.length < topCut) {
      return NextResponse.json(
        { error: `Only ${activePlayers.length} active players, need ${topCut} for the selected top cut` },
        { status: 400 }
      );
    }

    const standings = computeStandings(activePlayers, league.scoringSystem === "COMPETITIVE");

    const qualified = standings.slice(0, topCut);
    const seeds = getSeedsFromStandings(
      qualified.map((p) => ({
        leaguePlayerId: p.leaguePlayerId,
        playerName: p.playerName,
        points: p.points,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        opponentMatchWinPercentage: p.opponentMatchWinPercentage,
        gameWinPercentage: p.gameWinPercentage,
      }))
    );

    const bracket = generateBracket(seeds, topCut, league.format);

    const lastRegularDay = await prisma.leagueDay.findFirst({
      where: { leagueId: id, type: "REGULAR" },
      orderBy: { dayNumber: "desc" },
    });

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

    if (isCommanderFormat(league.format)) {
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
            data: {
              roundId: semisRound.id,
              tableNumber: pod.podNumber,
            },
          });

          const seatAssignment = generateCommanderSeats(pod.players.length);

          await prisma.tablePlayer.createMany({
            data: pod.players.map((p, i) => ({
              tableId: table.id,
              leaguePlayerId: p.leaguePlayerId,
              seatPosition: seatAssignment[i],
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
        data: {
          roundId: finalsRound.id,
          tableNumber: 1,
        },
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
          data: {
            leagueDayId: playoffDay.id,
            roundNumber: nextRoundNumber + r,
            status: "PLANNED",
            name: roundName,
          },
        });
        roundsMap[r] = round.id;
      }

      for (const match of bracket.matches) {
        const table = await prisma.table.create({
          data: {
            roundId: roundsMap[match.round - 1],
            tableNumber: match.matchNumber,
          },
        });

        if (match.leaguePlayerId1 && match.leaguePlayerId2) {
          await prisma.tablePlayer.createMany({
            data: [
              {
                tableId: table.id,
                leaguePlayerId: match.leaguePlayerId1,
                seatPosition: 1,
                pointsWagered: 0,
              },
              {
                tableId: table.id,
                leaguePlayerId: match.leaguePlayerId2,
                seatPosition: 2,
                pointsWagered: 0,
              },
            ],
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      playoffDay,
      seeds,
      bracket: {
        matches: bracket.matches,
        pods: bracket.pods,
        byes: bracket.byes,
      },
    });
  } catch (error) {
    console.error("Error generating playoff:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generateCommanderSeats(playerCount: number): number[] {
  const seats = Array.from({ length: playerCount }, (_, i) => i + 1);
  for (let i = seats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [seats[i], seats[j]] = [seats[j], seats[i]];
  }
  return seats;
}

interface PlayerStanding {
  leaguePlayerId: string;
  playerName: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  opponentMatchWinPercentage: number;
  gameWinPercentage: number;
}

function computeStandings(
  players: {
    id: string;
    points: number;
    user: { name: string };
    pointChanges: {
      type: string;
      amount: number;
      round: {
        leagueDay: { type: string };
      } | null;
    }[];
    tablePlayers: {
      result: string;
      matchPoints: number;
      gamesWon: number;
      gamesDrawn: number;
      gamesLost: number;
      table: {
        players: {
          leaguePlayerId: string;
          result: string;
        }[];
      };
    }[];
  }[],
  isCompetitive: boolean,
): PlayerStanding[] {
  const playerStats: PlayerStanding[] = [];

  for (const player of players) {
    const regularChanges = player.pointChanges.filter(
      (pc) => pc.round?.leagueDay?.type === "REGULAR"
    );

    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const change of regularChanges) {
      if (change.type === "WIN") wins++;
      else if (change.type === "ABSENT" || change.type === "NO_SHOW") losses++;
      else if (change.type === "DRAW") draws++;
    }

    const matchesPlayed = wins + losses + draws;
    const gameWinPercentage = matchesPlayed > 0 ? wins / matchesPlayed : 0;
    const opponentMatchWinPercentage = 0.5;

    playerStats.push({
      leaguePlayerId: player.id,
      playerName: player.user.name,
      points: player.points,
      wins,
      losses,
      draws,
      matchesPlayed,
      opponentMatchWinPercentage,
      gameWinPercentage,
    });
  }

  if (isCompetitive && !isCommanderFormat("1v1")) {
    const matchRecords = new Map<string, MatchRecord[]>();
    const matchStats = new Map<string, { matchPoints: number; roundsPlayed: number; gamesWon: number; gamesDrawn: number; gamesLost: number }>();

    for (const player of players) {
      const standing = playerStats.find(s => s.leaguePlayerId === player.id);
      if (!standing) continue;

      matchStats.set(player.id, {
        matchPoints: standing.wins * 3 + standing.draws,
        roundsPlayed: standing.matchesPlayed,
        gamesWon: player.tablePlayers.reduce((sum, tp) => sum + tp.gamesWon, 0),
        gamesDrawn: player.tablePlayers.reduce((sum, tp) => sum + tp.gamesDrawn, 0),
        gamesLost: player.tablePlayers.reduce((sum, tp) => sum + tp.gamesLost, 0),
      });

      const records: MatchRecord[] = [];
      for (const tp of player.tablePlayers) {
        if (tp.result === "PENDING" || tp.table.players.length <= 1) continue;
        const opponents = tp.table.players.filter(p => p.leaguePlayerId !== player.id && p.result !== "PENDING");
        for (const opp of opponents) {
          records.push({
            opponentId: opp.leaguePlayerId,
            result: tp.result as "WIN" | "DRAW" | "ABSENT" | "LOSS",
            gamesWon: tp.gamesWon,
            gamesDrawn: tp.gamesDrawn,
            gamesLost: tp.gamesLost,
            isBye: false,
          });
        }
      }
      matchRecords.set(player.id, records);
    }

    const tiebreakers = computeTiebreakers(matchRecords, matchStats);

    for (const standing of playerStats) {
      const tb = tiebreakers.get(standing.leaguePlayerId);
      if (tb) {
        standing.opponentMatchWinPercentage = tb.omwPercentage;
        standing.gameWinPercentage = tb.gwPercentage;
      }
    }

    return sortCompetitiveStandings(
      playerStats.map(s => {
        const player = players.find(p => p.id === s.leaguePlayerId);
        const stats = matchStats.get(s.leaguePlayerId);
        return {
          leaguePlayerId: s.leaguePlayerId,
          playerName: s.playerName,
          matchPoints: stats?.matchPoints ?? 0,
          roundsPlayed: s.matchesPlayed,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          omwPercentage: s.opponentMatchWinPercentage,
          gwPercentage: s.gameWinPercentage,
          ogwPercentage: 0,
          gamesWon: player?.tablePlayers.reduce((sum, tp) => sum + tp.gamesWon, 0) ?? 0,
          gamesDrawn: player?.tablePlayers.reduce((sum, tp) => sum + tp.gamesDrawn, 0) ?? 0,
          gamesLost: player?.tablePlayers.reduce((sum, tp) => sum + tp.gamesLost, 0) ?? 0,
        };
      })
    ).map(s => ({
      ...playerStats.find(ps => ps.leaguePlayerId === s.leaguePlayerId)!,
      opponentMatchWinPercentage: s.omwPercentage,
      gameWinPercentage: s.gwPercentage,
    }));
  }

  return playerStats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.gameWinPercentage - a.gameWinPercentage;
  });
}
