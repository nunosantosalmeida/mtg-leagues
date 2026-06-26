import { describe, it, expect } from "vitest";
import {
  getCommanderTopCut,
  generateBracket,
  getSeedsFromStandings,
} from "@/lib/playoff/bracket";

describe("getCommanderTopCut", () => {
  it("returns 0 for 5 or fewer players", () => {
    expect(getCommanderTopCut(5)).toBe(0);
    expect(getCommanderTopCut(3)).toBe(0);
  });

  it("returns 4 for 6-16 players", () => {
    expect(getCommanderTopCut(6)).toBe(4);
    expect(getCommanderTopCut(16)).toBe(4);
  });

  it("returns increasing values for larger counts", () => {
    expect(getCommanderTopCut(17)).toBeGreaterThan(4);
    expect(getCommanderTopCut(64)).toBe(16);
  });
});

describe("generateBracket", () => {
  it("throws for less than 2 players", () => {
    expect(() => generateBracket([], 4, "COMMANDER")).toThrow("Need at least 2 players");
  });

  it("generates 1v1 bracket for Standard format", () => {
    const seeds = [
      { seed: 1, leaguePlayerId: "a", playerName: "A", points: 1500 },
      { seed: 2, leaguePlayerId: "b", playerName: "B", points: 1400 },
      { seed: 3, leaguePlayerId: "c", playerName: "C", points: 1300 },
      { seed: 4, leaguePlayerId: "d", playerName: "D", points: 1200 },
    ];

    const bracket = generateBracket(seeds, 4, "STANDARD");
    expect(bracket.matches.length).toBeGreaterThan(0);
    expect(bracket.totalRounds).toBe(2);
  });

  it("generates Commander playoff for 8 players", () => {
    const seeds = Array.from({ length: 8 }, (_, i) => ({
      seed: i + 1,
      leaguePlayerId: `p${i + 1}`,
      playerName: `Player ${i + 1}`,
      points: 1500 - i * 100,
    }));

    const bracket = generateBracket(seeds, 8, "COMMANDER");
    expect(bracket.matches.length).toBeGreaterThan(0);
  });
});

describe("getSeedsFromStandings", () => {
  it("sorts by points descending", () => {
    const players = [
      { leaguePlayerId: "a", playerName: "A", points: 1200, wins: 2, losses: 2, draws: 0, opponentMatchWinPercentage: 0.5, gameWinPercentage: 0.5 },
      { leaguePlayerId: "b", playerName: "B", points: 1500, wins: 4, losses: 0, draws: 0, opponentMatchWinPercentage: 0.6, gameWinPercentage: 0.7 },
      { leaguePlayerId: "c", playerName: "C", points: 1300, wins: 3, losses: 1, draws: 0, opponentMatchWinPercentage: 0.5, gameWinPercentage: 0.6 },
    ];

    const seeds = getSeedsFromStandings(players);
    expect(seeds[0].leaguePlayerId).toBe("b");
    expect(seeds[1].leaguePlayerId).toBe("c");
    expect(seeds[2].leaguePlayerId).toBe("a");
  });

  it("assigns sequential seeds", () => {
    const players = [
      { leaguePlayerId: "a", playerName: "A", points: 1500, wins: 4, losses: 0, draws: 0, opponentMatchWinPercentage: 0.6, gameWinPercentage: 0.7 },
      { leaguePlayerId: "b", playerName: "B", points: 1400, wins: 3, losses: 1, draws: 0, opponentMatchWinPercentage: 0.5, gameWinPercentage: 0.6 },
    ];

    const seeds = getSeedsFromStandings(players);
    expect(seeds[0].seed).toBe(1);
    expect(seeds[1].seed).toBe(2);
  });

  it("handles empty array", () => {
    expect(getSeedsFromStandings([])).toEqual([]);
  });

  it("uses wins as tiebreaker", () => {
    const players = [
      { leaguePlayerId: "a", playerName: "A", points: 1500, wins: 3, losses: 1, draws: 0, opponentMatchWinPercentage: 0.5, gameWinPercentage: 0.5 },
      { leaguePlayerId: "b", playerName: "B", points: 1500, wins: 4, losses: 0, draws: 0, opponentMatchWinPercentage: 0.6, gameWinPercentage: 0.7 },
    ];

    const seeds = getSeedsFromStandings(players);
    expect(seeds[0].leaguePlayerId).toBe("b");
  });
});
