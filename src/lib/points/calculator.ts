const BET_PERCENTAGE = 0.07;
const STARTING_POINTS = 1500;
const LATE_ENTRY_MULTIPLIER = 0.93;
const FIVE_PLAYER_PENALTY = 0.80;

export function calculateBet(points: number): number {
  return Math.floor(points * BET_PERCENTAGE * 100) / 100;
}

export function calculateLateEntryPoints(missedRounds: number): number {
  let points = STARTING_POINTS;
  for (let i = 0; i < missedRounds; i++) {
    points *= LATE_ENTRY_MULTIPLIER;
  }
  return Math.floor(points * 100) / 100;
}

export function calculateWinnerPot(bets: number[], tableSize: number): number {
  const totalBets = bets.reduce((sum, bet) => sum + bet, 0);

  if (tableSize === 3) {
    const lowestBet = Math.min(...bets);
    return Math.floor((totalBets + lowestBet) * 100) / 100;
  }

  if (tableSize === 5) {
    return Math.floor(totalBets * FIVE_PLAYER_PENALTY * 100) / 100;
  }

  return Math.floor(totalBets * 100) / 100;
}

export function calculateDrawSplit(totalPot: number, tableSize: number): number {
  if (tableSize === 5) {
    return Math.floor((totalPot * FIVE_PLAYER_PENALTY) / tableSize * 100) / 100;
  }
  return Math.floor((totalPot / tableSize) * 100) / 100;
}

export function calculateNoShowPenalty(points: number): number {
  return Math.floor(points * BET_PERCENTAGE * 100) / 100;
}

export interface TableCalculationInput {
  leaguePlayerId: string;
  points: number;
  result: "WIN" | "DRAW" | "ABSENT" | "PENDING";
}

export interface TableCalculationResult {
  leaguePlayerId: string;
  bet: number;
  pointsChange: number;
  pointsAfter: number;
  changeType: "WIN" | "DRAW_SHARE" | "NO_SHOW" | "THREE_PLAYER_BONUS" | "FIVE_PLAYER_PENALTY" | "BET";
}

export function calculateTableResults(players: TableCalculationInput[]): TableCalculationResult[] {
  const tableSize = players.length;
  const bets = players.map(p => calculateBet(p.points));
  const totalBets = bets.reduce((sum, bet) => sum + bet, 0);

  return players.map((player, index) => {
    const bet = bets[index];

    if (player.result === "ABSENT") {
      return {
        leaguePlayerId: player.leaguePlayerId,
        bet,
        pointsChange: -bet,
        pointsAfter: Math.floor((player.points - bet) * 100) / 100,
        changeType: "NO_SHOW",
      };
    }

    if (player.result === "WIN") {
      const winnerPot = calculateWinnerPot(bets, tableSize);
      let pointsChange = tableSize === 1 ? bet : winnerPot - bet;
      let changeType: TableCalculationResult["changeType"] = "WIN";

      if (tableSize === 3) {
        changeType = "THREE_PLAYER_BONUS";
      } else if (tableSize === 5) {
        pointsChange = winnerPot - bet;
        changeType = "FIVE_PLAYER_PENALTY";
      }

      return {
        leaguePlayerId: player.leaguePlayerId,
        bet,
        pointsChange: Math.floor(pointsChange * 100) / 100,
        pointsAfter: Math.floor((player.points + pointsChange) * 100) / 100,
        changeType,
      };
    }

    if (player.result === "DRAW") {
      const drawShare = calculateDrawSplit(totalBets, tableSize);
      const netChange = Math.floor((drawShare - bet) * 100) / 100;

      return {
        leaguePlayerId: player.leaguePlayerId,
        bet,
        pointsChange: netChange,
        pointsAfter: Math.floor((player.points + netChange) * 100) / 100,
        changeType: "DRAW_SHARE",
      };
    }

    return {
      leaguePlayerId: player.leaguePlayerId,
      bet,
      pointsChange: 0,
      pointsAfter: player.points,
      changeType: "BET",
    };
  });
}
