import prisma from "@/lib/prisma";
import {
  computeTiebreakers,
  sortCompetitiveStandings,
  type CompetitiveStanding,
  type MatchRecord,
} from "@/lib/points/competitive";
import { isCommanderFormat } from "@/lib/types";

interface LeaguePlayerWithIncludes {
  id: string;
  points: number;
  user: { id: string; name: string; email: string };
  tablePlayers: {
    result: string;
    matchPoints: number;
    gamesWon: number;
    gamesDrawn: number;
    gamesLost: number;
    table: {
      tableNumber: number;
      round: { status: string };
      players: {
        leaguePlayerId: string;
        result: string;
      }[];
    };
  }[];
  pointChanges: {
    type: string;
    amount: number;
    description: string | null;
    createdAt: Date;
  }[];
}

export interface StandingEntry {
  leaguePlayerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  matchPoints: number;
  roundsPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  penalties: number;
  gamesWon: number;
  gamesDrawn: number;
  gamesLost: number;
  omwPercentage: number;
  gwPercentage: number;
  ogwPercentage: number;
  pointHistory: {
    type: string;
    amount: number;
    description: string | null;
    createdAt: Date;
  }[];
}

export class StandingsService {
  static async getStandings(leagueId: string): Promise<StandingEntry[]> {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { scoringSystem: true, format: true },
    });

    if (!league) throw new Error("League not found");

    const leaguePlayers = (await prisma.leaguePlayer.findMany({
      where: { leagueId },
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
    })) as LeaguePlayerWithIncludes[];

    const standings: StandingEntry[] = leaguePlayers.map((lp) => {
      const completedTables = lp.tablePlayers.filter(
        (tp) => tp.result !== "PENDING" && tp.table.round.status === "COMPLETED",
      );
      const results = completedTables;

      const penalties = lp.pointChanges.filter((pc) => pc.type === "ABSENT").length;
      const losses = league.scoringSystem === "TRADITIONAL"
        ? results.filter((tp) => tp.result === "LOSS").length
        : results.filter((tp) => tp.result === "LOSS").length;
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

    if (league.scoringSystem === "TRADITIONAL" && !isCommanderFormat(league.format)) {
      return StandingsService.computeCompetitiveStandings(standings, leaguePlayers);
    }

    standings.sort((a, b) => b.points - a.points);
    return standings;
  }

  private static computeCompetitiveStandings(
    standings: StandingEntry[],
    leaguePlayers: LeaguePlayerWithIncludes[],
  ): StandingEntry[] {
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

    for (const s of standings) {
      const playerLP = leaguePlayers.find((p) => p.id === s.leaguePlayerId);
      if (!playerLP) continue;

      const records: MatchRecord[] = [];
      for (const tp of playerLP.tablePlayers) {
        if (tp.result === "PENDING" || tp.table.round.status !== "COMPLETED") continue;
        const opponentsInTable = tp.table.players.filter(
          (p) => p.leaguePlayerId !== s.leaguePlayerId && p.result !== "PENDING",
        );
        for (const opp of opponentsInTable) {
          records.push({
            opponentId: opp.leaguePlayerId,
                result: tp.result as "WIN" | "DRAW" | "LOSS",
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

    const tiebreakers = computeTiebreakers(matchRecords, matchStats);

    for (const s of standings) {
      const tb = tiebreakers.get(s.leaguePlayerId);
      if (tb) {
        s.omwPercentage = tb.omwPercentage;
        s.gwPercentage = tb.gwPercentage;
        s.ogwPercentage = tb.ogwPercentage;
      }
    }

    const sorted = sortCompetitiveStandings(standings.map((s) => ({
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

    return sorted.map((s) => ({
      ...standings.find((st) => st.leaguePlayerId === s.leaguePlayerId)!,
      omwPercentage: s.omwPercentage,
      gwPercentage: s.gwPercentage,
      ogwPercentage: s.ogwPercentage,
    }));
  }
}
