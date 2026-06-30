import { describe, it, expect } from "vitest";
import {
  calculateMatchPoints,
  calculateMWP,
  calculateOMW,
  calculateGW,
  calculateOGW,
  computeTiebreakers,
  sortCompetitiveStandings,
  CompetitiveStanding,
  MatchRecord,
  MATCH_WIN,
  MATCH_DRAW,
  MATCH_LOSS,
  BYE_MATCH_POINTS,
  MWP_FLOOR,
} from "./competitive";

describe("calculateMatchPoints", () => {
  it("returns 3 for WIN", () => {
    expect(calculateMatchPoints("WIN")).toBe(3);
  });

  it("returns 1 for DRAW", () => {
    expect(calculateMatchPoints("DRAW")).toBe(1);
  });

  it("returns 0 for ABSENT", () => {
    expect(calculateMatchPoints("ABSENT")).toBe(0);
  });

  it("returns 0 for PENDING", () => {
    expect(calculateMatchPoints("PENDING")).toBe(0);
  });
});

describe("calculateMWP", () => {
  it("returns MWP_FLOOR when no rounds played", () => {
    expect(calculateMWP(0, 0)).toBe(MWP_FLOOR);
  });

  it("calculates MWP correctly for wins", () => {
    // 3 wins = 9 match points out of 9 possible
    expect(calculateMWP(9, 3)).toBe(1.0);
  });

  it("calculates MWP correctly for draws", () => {
    // 3 draws = 3 match points out of 9 possible
    expect(calculateMWP(3, 3)).toBeCloseTo(0.333, 2);
  });

  it("floors at MWP_FLOOR", () => {
    // 0 points in 1 round = 0/3 = 0, floored at 0.33
    expect(calculateMWP(0, 1)).toBe(MWP_FLOOR);
  });

  it("handles mixed results", () => {
    // 1 win + 1 draw + 1 loss = 4 points in 3 rounds
    expect(calculateMWP(4, 3)).toBeCloseTo(4 / 9, 2);
  });
});

describe("calculateOMW", () => {
  it("returns MWP_FLOOR when no opponents", () => {
    expect(calculateOMW([])).toBe(MWP_FLOOR);
  });

  it("returns MWP_FLOOR when all opponents are -1", () => {
    expect(calculateOMW([-1, -1])).toBe(MWP_FLOOR);
  });

  it("calculates average of opponents' MWP", () => {
    // Average of 0.5 and 0.666... = 0.5833...
    expect(calculateOMW([0.5, 0.6667])).toBeCloseTo(0.5833, 2);
  });

  it("filters out -1 values", () => {
    // Only valid opponent is 0.5
    expect(calculateOMW([-1, 0.5])).toBeCloseTo(0.5, 2);
  });

  it("floors individual opponent MWP at MWP_FLOOR", () => {
    // Opponent with 0.2 should be floored to 0.33
    expect(calculateOMW([0.2])).toBe(MWP_FLOOR);
  });
});

describe("calculateGW", () => {
  it("returns MWP_FLOOR when no games played", () => {
    expect(calculateGW(0, 0, 0)).toBe(MWP_FLOOR);
  });

  it("calculates GW correctly for wins only", () => {
    // 6 wins out of 6 games = 18 game points out of 18 possible
    expect(calculateGW(6, 0, 0)).toBe(1.0);
  });

  it("calculates GW correctly for draws", () => {
    // 3 draws out of 3 games = 3 game points out of 9 possible
    expect(calculateGW(0, 3, 0)).toBeCloseTo(0.333, 2);
  });

  it("floors at MWP_FLOOR", () => {
    // 0 wins in 3 games = 0 game points, floored at 0.33
    expect(calculateGW(0, 0, 3)).toBe(MWP_FLOOR);
  });

  it("handles mixed results", () => {
    // 4 wins + 1 draw + 1 loss = 13 game points out of 18 possible
    expect(calculateGW(4, 1, 1)).toBeCloseTo(13 / 18, 2);
  });
});

describe("calculateOGW", () => {
  it("returns MWP_FLOOR when no opponents", () => {
    expect(calculateOGW([])).toBe(MWP_FLOOR);
  });

  it("returns MWP_FLOOR when all opponents are -1", () => {
    expect(calculateOGW([-1, -1])).toBe(MWP_FLOOR);
  });

  it("calculates average of opponents' GWP", () => {
    // Average of 0.5 and 0.666... = 0.5833...
    expect(calculateOGW([0.5, 0.6667])).toBeCloseTo(0.5833, 2);
  });

  it("filters out -1 values", () => {
    // Only valid opponent is 0.5
    expect(calculateOGW([-1, 0.5])).toBeCloseTo(0.5, 2);
  });

  it("floors individual opponent GWP at MWP_FLOOR", () => {
    // Opponent with 0.2 should be floored to 0.33
    expect(calculateOGW([0.2])).toBe(MWP_FLOOR);
  });
});

describe("computeTiebreakers", () => {
  it("computes tiebreakers for players with match records", () => {
    const matchRecords = new Map<string, MatchRecord[]>();
    const matchStats = new Map<string, { matchPoints: number; roundsPlayed: number; gamesWon: number; gamesDrawn: number; gamesLost: number }>();

    // Player A: 2 wins against B and C
    matchRecords.set("A", [
      { opponentId: "B", result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0, isBye: false },
      { opponentId: "C", result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0, isBye: false },
    ]);
    matchStats.set("A", { matchPoints: 6, roundsPlayed: 2, gamesWon: 4, gamesDrawn: 0, gamesLost: 0 });

    // Player B: 1 win against C, 1 loss to A
    matchRecords.set("B", [
      { opponentId: "C", result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0, isBye: false },
      { opponentId: "A", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 2, isBye: false },
    ]);
    matchStats.set("B", { matchPoints: 3, roundsPlayed: 2, gamesWon: 2, gamesDrawn: 0, gamesLost: 2 });

    // Player C: 2 losses
    matchRecords.set("C", [
      { opponentId: "B", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 2, isBye: false },
      { opponentId: "A", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 2, isBye: false },
    ]);
    matchStats.set("C", { matchPoints: 0, roundsPlayed: 2, gamesWon: 0, gamesDrawn: 0, gamesLost: 4 });

    const result = computeTiebreakers(matchRecords, matchStats);

    expect(result.size).toBe(3);
    expect(result.get("A")!.omwPercentage).toBeGreaterThan(0);
    expect(result.get("A")!.gwPercentage).toBe(1.0);
    expect(result.get("B")!.omwPercentage).toBeGreaterThan(0);
    expect(result.get("B")!.gwPercentage).toBeCloseTo(0.5, 2);
    expect(result.get("C")!.omwPercentage).toBeGreaterThan(0);
    expect(result.get("C")!.gwPercentage).toBe(MWP_FLOOR);
  });

  it("handles bye matches correctly", () => {
    const matchRecords = new Map<string, MatchRecord[]>();
    const matchStats = new Map<string, { matchPoints: number; roundsPlayed: number; gamesWon: number; gamesDrawn: number; gamesLost: number }>();

    // Player A: 1 win against B, 1 bye
    matchRecords.set("A", [
      { opponentId: "B", result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0, isBye: false },
      { opponentId: "__bye__", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 0, isBye: true },
    ]);
    matchStats.set("A", { matchPoints: 6, roundsPlayed: 2, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 });

    // Player B: 1 loss to A
    matchRecords.set("B", [
      { opponentId: "A", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 2, isBye: false },
    ]);
    matchStats.set("B", { matchPoints: 0, roundsPlayed: 1, gamesWon: 0, gamesDrawn: 0, gamesLost: 2 });

    const result = computeTiebreakers(matchRecords, matchStats);

    // A's bye should not be included in OMW calculation
    expect(result.get("A")!.omwPercentage).toBeCloseTo(MWP_FLOOR, 2);
    expect(result.get("A")!.gwPercentage).toBe(1.0);
  });
});

describe("sortCompetitiveStandings", () => {
  it("sorts by matchPoints descending", () => {
    const standings: CompetitiveStanding[] = [
      { leaguePlayerId: "1", playerName: "A", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
      { leaguePlayerId: "2", playerName: "B", matchPoints: 6, wins: 2, draws: 0, losses: 0, roundsPlayed: 2, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 4, gamesDrawn: 0, gamesLost: 0 },
      { leaguePlayerId: "3", playerName: "C", matchPoints: 0, wins: 0, draws: 0, losses: 2, roundsPlayed: 2, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 0, gamesDrawn: 0, gamesLost: 4 },
    ];

    const sorted = sortCompetitiveStandings(standings);
    expect(sorted[0].playerName).toBe("B");
    expect(sorted[1].playerName).toBe("A");
    expect(sorted[2].playerName).toBe("C");
  });

  it("sorts by OMW% when matchPoints are equal", () => {
    const standings: CompetitiveStanding[] = [
      { leaguePlayerId: "1", playerName: "A", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.6, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
      { leaguePlayerId: "2", playerName: "B", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.4, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
    ];

    const sorted = sortCompetitiveStandings(standings);
    expect(sorted[0].playerName).toBe("A");
    expect(sorted[1].playerName).toBe("B");
  });

  it("sorts by GW% when matchPoints and OMW% are equal", () => {
    const standings: CompetitiveStanding[] = [
      { leaguePlayerId: "1", playerName: "A", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.5, gwPercentage: 0.8, ogwPercentage: 0.5, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
      { leaguePlayerId: "2", playerName: "B", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
    ];

    const sorted = sortCompetitiveStandings(standings);
    expect(sorted[0].playerName).toBe("A");
    expect(sorted[1].playerName).toBe("B");
  });

  it("sorts by OGW% when all other criteria are equal", () => {
    const standings: CompetitiveStanding[] = [
      { leaguePlayerId: "1", playerName: "A", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.7, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
      { leaguePlayerId: "2", playerName: "B", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.4, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
    ];

    const sorted = sortCompetitiveStandings(standings);
    expect(sorted[0].playerName).toBe("A");
    expect(sorted[1].playerName).toBe("B");
  });

  it("does not mutate original array", () => {
    const standings: CompetitiveStanding[] = [
      { leaguePlayerId: "1", playerName: "A", matchPoints: 3, wins: 1, draws: 0, losses: 0, roundsPlayed: 1, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
      { leaguePlayerId: "2", playerName: "B", matchPoints: 6, wins: 2, draws: 0, losses: 0, roundsPlayed: 2, omwPercentage: 0.5, gwPercentage: 0.5, ogwPercentage: 0.5, gamesWon: 4, gamesDrawn: 0, gamesLost: 0 },
    ];

    const originalFirst = standings[0].playerName;
    sortCompetitiveStandings(standings);
    expect(standings[0].playerName).toBe(originalFirst);
  });
});

describe("tiebreaker integration: winners have higher GW% than losers", () => {
  it("winner GW% > 0.33 when gamesWon=1", () => {
    const gw = calculateGW(1, 0, 0);
    expect(gw).toBeGreaterThan(MWP_FLOOR);
  });

  it("loser GW% is floored at 0.33", () => {
    const gw = calculateGW(0, 0, 1);
    expect(gw).toBe(MWP_FLOOR);
  });

  it("drawer GW% equals exactly the floor (1 draw game point / 3 possible = 1/3, floored to 0.33)", () => {
    const gw = calculateGW(0, 1, 0);
    // 1*1 / (1*3) = 0.3333... which is > MWP_FLOOR (0.33), so not floored
    expect(gw).toBeCloseTo(1 / 3, 6);
  });

  it("multi-round: 2-0 record has GW% = 1.0", () => {
    const gw = calculateGW(2, 0, 0);
    expect(gw).toBe(1.0);
  });

  it("multi-round: 1-1 record has GW% above floor", () => {
    const gw = calculateGW(1, 0, 1);
    expect(gw).toBeGreaterThan(MWP_FLOOR);
  });
});

describe("realistic tiebreaker scenario: 4 players, 2 rounds", () => {
  it("correctly ranks players by MP > OMW% > GW% > OGW%", () => {
    const matchRecords = new Map<string, MatchRecord[]>();
    const matchStats = new Map<string, { matchPoints: number; roundsPlayed: number; gamesWon: number; gamesDrawn: number; gamesLost: number }>();

    // Round 1: A beats B, C beats D
    // Round 2: A beats C, B beats D
    // Final: A=6, B=3, C=3, D=0

    // A: 2 wins (beat B, C)
    matchRecords.set("A", [
      { opponentId: "B", result: "WIN", gamesWon: 1, gamesDrawn: 0, gamesLost: 0, isBye: false },
      { opponentId: "C", result: "WIN", gamesWon: 1, gamesDrawn: 0, gamesLost: 0, isBye: false },
    ]);
    matchStats.set("A", { matchPoints: 6, roundsPlayed: 2, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 });

    // B: 1 win (beat D), 1 loss (to A)
    matchRecords.set("B", [
      { opponentId: "A", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 1, isBye: false },
      { opponentId: "D", result: "WIN", gamesWon: 1, gamesDrawn: 0, gamesLost: 0, isBye: false },
    ]);
    matchStats.set("B", { matchPoints: 3, roundsPlayed: 2, gamesWon: 1, gamesDrawn: 0, gamesLost: 1 });

    // C: 1 win (beat D), 1 loss (to A)
    matchRecords.set("C", [
      { opponentId: "D", result: "WIN", gamesWon: 1, gamesDrawn: 0, gamesLost: 0, isBye: false },
      { opponentId: "A", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 1, isBye: false },
    ]);
    matchStats.set("C", { matchPoints: 3, roundsPlayed: 2, gamesWon: 1, gamesDrawn: 0, gamesLost: 1 });

    // D: 2 losses
    matchRecords.set("D", [
      { opponentId: "C", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 1, isBye: false },
      { opponentId: "B", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 1, isBye: false },
    ]);
    matchStats.set("D", { matchPoints: 0, roundsPlayed: 2, gamesWon: 0, gamesDrawn: 0, gamesLost: 2 });

    const tiebreakers = computeTiebreakers(matchRecords, matchStats);

    // A is 2-0: OMW% = avg(B's MWP, C's MWP) = avg(0.5, 0.5) = 0.5
    expect(tiebreakers.get("A")!.gwPercentage).toBe(1.0);
    expect(tiebreakers.get("A")!.omwPercentage).toBeCloseTo(0.5, 2);

    // B is 1-1: OMW% = avg(A's MWP, D's MWP) = avg(1.0, 0.33) = 0.665
    expect(tiebreakers.get("B")!.gwPercentage).toBeCloseTo(0.5, 2);

    // C is 1-1: OMW% = avg(D's MWP, A's MWP) = avg(0.33, 1.0) = 0.665
    expect(tiebreakers.get("C")!.gwPercentage).toBeCloseTo(0.5, 2);

    // D is 0-2: all losses
    expect(tiebreakers.get("D")!.gwPercentage).toBe(MWP_FLOOR);

    // Build standings and sort
    const standings: CompetitiveStanding[] = [
      { leaguePlayerId: "A", playerName: "A", matchPoints: 6, wins: 2, draws: 0, losses: 0, roundsPlayed: 2, omwPercentage: tiebreakers.get("A")!.omwPercentage, gwPercentage: tiebreakers.get("A")!.gwPercentage, ogwPercentage: tiebreakers.get("A")!.ogwPercentage, gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
      { leaguePlayerId: "B", playerName: "B", matchPoints: 3, wins: 1, draws: 0, losses: 1, roundsPlayed: 2, omwPercentage: tiebreakers.get("B")!.omwPercentage, gwPercentage: tiebreakers.get("B")!.gwPercentage, ogwPercentage: tiebreakers.get("B")!.ogwPercentage, gamesWon: 1, gamesDrawn: 0, gamesLost: 1 },
      { leaguePlayerId: "C", playerName: "C", matchPoints: 3, wins: 1, draws: 0, losses: 1, roundsPlayed: 2, omwPercentage: tiebreakers.get("C")!.omwPercentage, gwPercentage: tiebreakers.get("C")!.gwPercentage, ogwPercentage: tiebreakers.get("C")!.ogwPercentage, gamesWon: 1, gamesDrawn: 0, gamesLost: 1 },
      { leaguePlayerId: "D", playerName: "D", matchPoints: 0, wins: 0, draws: 0, losses: 2, roundsPlayed: 2, omwPercentage: tiebreakers.get("D")!.omwPercentage, gwPercentage: tiebreakers.get("D")!.gwPercentage, ogwPercentage: tiebreakers.get("D")!.ogwPercentage, gamesWon: 0, gamesDrawn: 0, gamesLost: 2 },
    ];

    const sorted = sortCompetitiveStandings(standings);
    expect(sorted[0].playerName).toBe("A");
    // B and C have same MP, OMW%, GW%, OGW% — order may vary
    expect(sorted[3].playerName).toBe("D");
  });
});

describe("bye in tiebreakers", () => {
  it("bye is excluded from OMW and OGW calculations", () => {
    const matchRecords = new Map<string, MatchRecord[]>();
    const matchStats = new Map<string, { matchPoints: number; roundsPlayed: number; gamesWon: number; gamesDrawn: number; gamesLost: number }>();

    // A: 1 real win + 1 bye
    matchRecords.set("A", [
      { opponentId: "B", result: "WIN", gamesWon: 1, gamesDrawn: 0, gamesLost: 0, isBye: false },
      { opponentId: "__bye__", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 0, isBye: true },
    ]);
    matchStats.set("A", { matchPoints: 6, roundsPlayed: 2, gamesWon: 1, gamesDrawn: 0, gamesLost: 0 });

    // B: 1 loss
    matchRecords.set("B", [
      { opponentId: "A", result: "WIN", gamesWon: 0, gamesDrawn: 0, gamesLost: 1, isBye: false },
    ]);
    matchStats.set("B", { matchPoints: 0, roundsPlayed: 1, gamesWon: 0, gamesDrawn: 0, gamesLost: 1 });

    const tiebreakers = computeTiebreakers(matchRecords, matchStats);

    // A's OMW should only consider B (not the bye), so OMW = B's MWP = 0.33
    expect(tiebreakers.get("A")!.omwPercentage).toBeCloseTo(MWP_FLOOR, 2);
    // A's GW% = 1.0 (1 game won, 0 lost)
    expect(tiebreakers.get("A")!.gwPercentage).toBe(1.0);
    // A's OGW should only consider B (not the bye)
    expect(tiebreakers.get("A")!.ogwPercentage).toBeCloseTo(MWP_FLOOR, 2);
  });
});

describe("draws affecting GW%", () => {
  it("draws lower GW% compared to wins", () => {
    const winGW = calculateGW(1, 0, 0);
    const drawGW = calculateGW(0, 1, 0);
    expect(winGW).toBeGreaterThan(drawGW);
  });

  it("draws higher GW% compared to losses", () => {
    const drawGW = calculateGW(0, 1, 0);
    const lossGW = calculateGW(0, 0, 1);
    // draw: 1/3 = 0.333... > MWP_FLOOR (0.33), loss: 0/3 = 0 floored to 0.33
    expect(drawGW).toBeGreaterThan(lossGW);
  });
});