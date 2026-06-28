export const MATCH_WIN = 3;
export const MATCH_DRAW = 1;
export const MATCH_LOSS = 0;
export const BYE_MATCH_POINTS = 3;
export const MWP_FLOOR = 0.33;

export function calculateMatchPoints(result: "WIN" | "DRAW" | "ABSENT" | "LOSS" | "PENDING"): number {
  switch (result) {
    case "WIN": return MATCH_WIN;
    case "DRAW": return MATCH_DRAW;
    case "ABSENT": return MATCH_LOSS;
    case "LOSS": return MATCH_LOSS;
    case "PENDING": return 0;
  }
}

export function calculateMWP(matchPoints: number, roundsPlayed: number): number {
  if (roundsPlayed === 0) return MWP_FLOOR;
  return Math.max(MWP_FLOOR, matchPoints / (roundsPlayed * MATCH_WIN));
}

export function calculateOMW(opponentsMWP: number[]): number {
  const valid = opponentsMWP.filter((m) => m !== -1);
  if (valid.length === 0) return MWP_FLOOR;
  const sum = valid.reduce((acc, mwp) => acc + Math.max(MWP_FLOOR, mwp), 0);
  return sum / valid.length;
}

export function calculateGW(gamesWon: number, gamesDrawn: number, gamesLost: number): number {
  const totalGames = gamesWon + gamesDrawn + gamesLost;
  if (totalGames === 0) return MWP_FLOOR;
  const gamePoints = gamesWon * MATCH_WIN + gamesDrawn * MATCH_DRAW;
  return Math.max(MWP_FLOOR, gamePoints / (totalGames * MATCH_WIN));
}

export function calculateOGW(opponentsGWP: number[]): number {
  const valid = opponentsGWP.filter((g) => g !== -1);
  if (valid.length === 0) return MWP_FLOOR;
  const sum = valid.reduce((acc, gwp) => acc + Math.max(MWP_FLOOR, gwp), 0);
  return sum / valid.length;
}

export interface CompetitiveStanding {
  leaguePlayerId: string;
  playerName: string;
  matchPoints: number;
  wins: number;
  draws: number;
  losses: number;
  roundsPlayed: number;
  omwPercentage: number;
  gwPercentage: number;
  ogwPercentage: number;
  gamesWon: number;
  gamesDrawn: number;
  gamesLost: number;
}

export interface MatchRecord {
  opponentId: string;
  result: "WIN" | "DRAW" | "ABSENT" | "LOSS";
  gamesWon: number;
  gamesDrawn: number;
  gamesLost: number;
  isBye: boolean;
}

export function computeTiebreakers(
  playerMatchRecords: Map<string, MatchRecord[]>,
  playerMatchStats: Map<string, { matchPoints: number; roundsPlayed: number; gamesWon: number; gamesDrawn: number; gamesLost: number }>
): Map<string, { omwPercentage: number; gwPercentage: number; ogwPercentage: number }> {
  const result = new Map<string, { omwPercentage: number; gwPercentage: number; ogwPercentage: number }>();

  const mwpCache = new Map<string, number>();
  for (const [playerId, stats] of playerMatchStats) {
    mwpCache.set(playerId, calculateMWP(stats.matchPoints, stats.roundsPlayed));
  }

  const gwpCache = new Map<string, number>();
  for (const [playerId, stats] of playerMatchStats) {
    gwpCache.set(playerId, calculateGW(stats.gamesWon, stats.gamesDrawn, stats.gamesLost));
  }

  for (const [playerId, records] of playerMatchRecords) {
    const nonByeOpponents = records.filter((r) => !r.isBye);
    const opponentsMWP = nonByeOpponents.map((r) => mwpCache.get(r.opponentId) ?? MWP_FLOOR);
    const opponentsGWP = nonByeOpponents.map((r) => gwpCache.get(r.opponentId) ?? MWP_FLOOR);

    const stats = playerMatchStats.get(playerId)!;
    const gwPercentage = calculateGW(stats.gamesWon, stats.gamesDrawn, stats.gamesLost);

    result.set(playerId, {
      omwPercentage: calculateOMW(opponentsMWP),
      gwPercentage,
      ogwPercentage: calculateOGW(opponentsGWP),
    });
  }

  return result;
}

export function sortCompetitiveStandings(
  standings: CompetitiveStanding[]
): CompetitiveStanding[] {
  return [...standings].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.omwPercentage !== a.omwPercentage) return b.omwPercentage - a.omwPercentage;
    if (b.gwPercentage !== a.gwPercentage) return b.gwPercentage - a.gwPercentage;
    if (b.ogwPercentage !== a.ogwPercentage) return b.ogwPercentage - a.ogwPercentage;
    return 0;
  });
}
