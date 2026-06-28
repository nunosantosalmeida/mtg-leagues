import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeTiebreakers, sortCompetitiveStandings, CompetitiveStanding, MatchRecord } from "@/lib/points/competitive";
import { isCommanderFormat } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const league = await prisma.league.findUnique({ where: { id }, select: { scoringSystem: true, format: true } });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const leaguePlayers = await prisma.leaguePlayer.findMany({
      where: { leagueId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tablePlayers: {
          include: {
            table: {
              include: {
                round: true,
                players: true,
              },
            },
          },
        },
        pointChanges: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const standings = leaguePlayers.map((lp) => {
      const results = lp.tablePlayers.filter(
        (tp) => tp.result !== "PENDING"
      );

      const penalties = results.filter((tp) => tp.result === "ABSENT").length;
      const losses = league.scoringSystem === "COMPETITIVE"
        ? results.filter((tp) => tp.result === "LOSS").length
        : results.filter((tp) => tp.result !== "WIN" && tp.result !== "DRAW" && tp.result !== "ABSENT").length;
      const matchPoints = results.reduce((sum, tp) => sum + tp.matchPoints, 0);

      return {
        leaguePlayerId: lp.id,
        userId: lp.user.id,
        userName: lp.user.name,
        userEmail: lp.user.email,
        points: Math.round(lp.points),
        matchPoints,
        roundsPlayed: results.length,
        wins: results.filter((tp) => tp.result === "WIN").length,
        draws: results.filter((tp) => tp.result === "DRAW").length,
        losses,
        penalties,
        gamesWon: results.reduce((sum, tp) => sum + tp.gamesWon, 0),
        gamesDrawn: results.reduce((sum, tp) => sum + tp.gamesDrawn, 0),
        gamesLost: results.reduce((sum, tp) => sum + tp.gamesLost, 0),
        omwPercentage: 0,
        gwPercentage: 0,
        ogwPercentage: 0,
        pointHistory: lp.pointChanges.map((pc) => ({
          type: pc.type,
          amount: pc.amount,
          description: pc.description,
          createdAt: pc.createdAt,
        })),
      };
    });

    if (league.scoringSystem === "COMPETITIVE" && !isCommanderFormat(league.format)) {
      const matchRecords = new Map<string, MatchRecord[]>();
      const matchStats = new Map<string, { matchPoints: number; roundsPlayed: number; gamesWon: number; gamesDrawn: number; gamesLost: number }>();

      for (const s of standings) {
        matchStats.set(s.leaguePlayerId, {
          matchPoints: s.matchPoints,
          roundsPlayed: s.roundsPlayed,
          gamesWon: s.gamesWon,
          gamesDrawn: s.gamesDrawn,
          gamesLost: s.gamesLost,
        });
      }

      const lp = leaguePlayers.find((p) => p.id === standings[0]?.leaguePlayerId);
      if (lp) {
        for (const s of standings) {
          const playerLP = leaguePlayers.find((p) => p.id === s.leaguePlayerId);
          if (!playerLP) continue;

          const records: MatchRecord[] = [];
          for (const tp of playerLP.tablePlayers) {
            if (tp.result === "PENDING") continue;
            const opponentsInTable = tp.table.players.filter(
              (p) => p.leaguePlayerId !== s.leaguePlayerId && p.result !== "PENDING"
            );
            for (const opp of opponentsInTable) {
              records.push({
                opponentId: opp.leaguePlayerId,
                result: tp.result as "WIN" | "DRAW" | "ABSENT" | "LOSS",
                gamesWon: tp.gamesWon,
                gamesDrawn: tp.gamesDrawn,
                gamesLost: tp.gamesLost,
                isBye: tp.table.players.length === 1,
              });
            }
            if (opponentsInTable.length === 0 && tp.table.players.length === 1) {
              records.push({
                opponentId: "__bye__",
                result: "WIN",
                gamesWon: 0,
                gamesDrawn: 0,
                gamesLost: 0,
                isBye: true,
              });
            }
          }
          matchRecords.set(s.leaguePlayerId, records);
        }
      }

      const tiebreakers = computeTiebreakers(matchRecords, matchStats);

      for (const s of standings) {
        const tb = tiebreakers.get(s.leaguePlayerId);
        if (tb) {
          s.omwPercentage = tb.omwPercentage;
          s.gwPercentage = tb.gwPercentage;
          s.ogwPercentage = tb.ogwPercentage;
        }
      }

      const sorted = sortCompetitiveStandings(standings.map(s => ({
        leaguePlayerId: s.leaguePlayerId,
        playerName: s.userName,
        matchPoints: s.matchPoints,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        roundsPlayed: s.roundsPlayed,
        omwPercentage: s.omwPercentage,
        gwPercentage: s.gwPercentage,
        ogwPercentage: s.ogwPercentage,
        gamesWon: s.gamesWon,
        gamesDrawn: s.gamesDrawn,
        gamesLost: s.gamesLost,
      })));
      return NextResponse.json(sorted.map(s => ({
        ...standings.find(st => st.leaguePlayerId === s.leaguePlayerId),
        omwPercentage: s.omwPercentage,
        gwPercentage: s.gwPercentage,
        ogwPercentage: s.ogwPercentage,
      })));
    }

    standings.sort((a, b) => b.points - a.points);

    return NextResponse.json(standings);
  } catch (error) {
    console.error("Error fetching standings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
