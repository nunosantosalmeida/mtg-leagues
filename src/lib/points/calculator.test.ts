import { describe, it, expect } from "vitest";
import {
  calculateBet,
  calculateLateEntryPoints,
  calculateWinnerPot,
  calculateDrawSplit,
  calculateTableResults,
} from "@/lib/points/calculator";

describe("calculateBet", () => {
  it("calculates 7% of points", () => {
    expect(calculateBet(1500)).toBe(105);
  });

  it("rounds down", () => {
    expect(calculateBet(100)).toBe(7);
  });

  it("returns 0.7 for 10 points (floors to 2 decimal places)", () => {
    expect(calculateBet(10)).toBe(0.7);
  });
});

describe("calculateLateEntryPoints", () => {
  it("returns starting points for 0 missed rounds", () => {
    expect(calculateLateEntryPoints(0)).toBe(1500);
  });

  it("applies 93% multiplier per missed round", () => {
    expect(calculateLateEntryPoints(1)).toBe(1395);
  });

  it("compounds correctly over 2 rounds", () => {
    expect(calculateLateEntryPoints(2)).toBe(Math.floor(1500 * 0.93 * 0.93 * 100) / 100);
  });

  it("compounds correctly over many rounds", () => {
    const result = calculateLateEntryPoints(5);
    expect(result).toBe(Math.floor(1500 * Math.pow(0.93, 5) * 100) / 100);
  });
});

describe("calculateWinnerPot", () => {
  it("returns total bets for 2-player table", () => {
    expect(calculateWinnerPot([100, 80], 2)).toBe(180);
  });

  it("returns total bets for 4-player table", () => {
    expect(calculateWinnerPot([100, 80, 60, 40], 4)).toBe(280);
  });

  it("adds lowest bet bonus for 3-player table", () => {
    const bets = [105, 84, 63];
    const totalBets = 252;
    const lowestBet = 63;
    expect(calculateWinnerPot(bets, 3)).toBe(totalBets + lowestBet);
  });

  it("applies 80% penalty for 5-player table", () => {
    const bets = [100, 80, 60, 40, 20];
    const totalBets = 300;
    expect(calculateWinnerPot(bets, 5)).toBe(Math.floor(totalBets * 0.8 * 100) / 100);
  });
});

describe("calculateDrawSplit", () => {
  it("splits pot equally for 2-player table", () => {
    expect(calculateDrawSplit(200, 2)).toBe(100);
  });

  it("splits pot equally for 4-player table", () => {
    expect(calculateDrawSplit(400, 4)).toBe(100);
  });

  it("applies 80% penalty for 5-player table", () => {
    const result = calculateDrawSplit(500, 5);
    expect(result).toBe(Math.floor((500 * 0.8) / 5 * 100) / 100);
  });
});

describe("calculateTableResults", () => {
  it("calculates winner gains correctly for 4-player table", () => {
    const players = [
      { leaguePlayerId: "a", points: 1500, result: "WIN" as const },
      { leaguePlayerId: "b", points: 1500, result: "DRAW" as const },
      { leaguePlayerId: "c", points: 1500, result: "DRAW" as const },
      { leaguePlayerId: "d", points: 1500, result: "DRAW" as const },
    ];

    const results = calculateTableResults(players);
    const winner = results.find((r) => r.leaguePlayerId === "a")!;

    expect(winner.changeType).toBe("WIN");
    expect(winner.pointsChange).toBeGreaterThan(0);
  });

  it("calculates absent player penalty", () => {
    const players = [
      { leaguePlayerId: "a", points: 1500, result: "ABSENT" as const },
      { leaguePlayerId: "b", points: 1500, result: "DRAW" as const },
    ];

    const results = calculateTableResults(players);
    const absent = results.find((r) => r.leaguePlayerId === "a")!;

    expect(absent.changeType).toBe("NO_SHOW");
    expect(absent.pointsChange).toBe(-105);
  });

  it("3-player winner bonus uses correct formula", () => {
    const players = [
      { leaguePlayerId: "a", points: 1500, result: "WIN" as const },
      { leaguePlayerId: "b", points: 1500, result: "DRAW" as const },
      { leaguePlayerId: "c", points: 1500, result: "DRAW" as const },
    ];

    const results = calculateTableResults(players);
    const winner = results.find((r) => r.leaguePlayerId === "a")!;

    expect(winner.changeType).toBe("THREE_PLAYER_BONUS");

    const bets = [105, 105, 105];
    const totalBets = 315;
    const lowestBet = 105;
    const expectedPot = totalBets + lowestBet;
    const expectedChange = expectedPot - 105;

    expect(winner.pointsChange).toBe(Math.floor(expectedChange * 100) / 100);
  });

  it("total points are conserved in 4-player draw", () => {
    const players = [
      { leaguePlayerId: "a", points: 1500, result: "DRAW" as const },
      { leaguePlayerId: "b", points: 1500, result: "DRAW" as const },
      { leaguePlayerId: "c", points: 1500, result: "DRAW" as const },
      { leaguePlayerId: "d", points: 1500, result: "DRAW" as const },
    ];

    const results = calculateTableResults(players);
    const totalChange = results.reduce((sum, r) => sum + r.pointsChange, 0);

    expect(totalChange).toBe(0);
  });

  it("total points are conserved in 2-player win", () => {
    const players = [
      { leaguePlayerId: "a", points: 1500, result: "WIN" as const },
      { leaguePlayerId: "b", points: 1500, result: "ABSENT" as const },
    ];

    const results = calculateTableResults(players);
    const totalChange = results.reduce((sum, r) => sum + r.pointsChange, 0);

    expect(totalChange).toBe(0);
  });

  it("handles empty array", () => {
    expect(calculateTableResults([])).toEqual([]);
  });
});
