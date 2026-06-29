import { describe, it, expect } from "vitest";
import { assignSwissPairings, SwissPlayer } from "@/lib/pairing/swiss";
import { generateBracket, getSeedsFromStandings, getCommanderTopCut } from "@/lib/playoff/bracket";

describe("Swiss Pairing Integration", () => {
  it("generates valid 1v1 bracket from standings", () => {
    const players: SwissPlayer[] = [
      { id: "p1", matchPoints: 15 },
      { id: "p2", matchPoints: 12 },
      { id: "p3", matchPoints: 9 },
      { id: "p4", matchPoints: 6 },
    ];

    const result = assignSwissPairings(players, new Set(), new Set(), 1);

    expect(result.pairs.length).toBe(2);

    const allPlayerIds = players.map(p => p.id);
    for (const pair of result.pairs) {
      expect(allPlayerIds).toContain(pair.player1Id);
      expect(allPlayerIds).toContain(pair.player2Id);
      expect(pair.player1Id).not.toBe(pair.player2Id);
    }

    const pairedIds = result.pairs.flatMap(p => [p.player1Id, p.player2Id]);
    expect(new Set(pairedIds).size).toBe(4);
  });

  it("avoids rematches in swiss pairing", () => {
    const players: SwissPlayer[] = [
      { id: "p1", matchPoints: 15 },
      { id: "p2", matchPoints: 12 },
      { id: "p3", matchPoints: 9 },
      { id: "p4", matchPoints: 6 },
    ];

    const previousMatchups = new Set(["p1:p2"]);
    const result = assignSwissPairings(players, previousMatchups, new Set(), 2);

    expect(result.pairs.length).toBe(2);

    for (const pair of result.pairs) {
      const key = pair.player1Id < pair.player2Id 
        ? `${pair.player1Id}:${pair.player2Id}` 
        : `${pair.player2Id}:${pair.player1Id}`;
      expect(previousMatchups.has(key)).toBe(false);
    }
  });

  it("assigns bye to lowest-ranked player without prior bye", () => {
    const players: SwissPlayer[] = [
      { id: "p1", matchPoints: 15 },
      { id: "p2", matchPoints: 12 },
      { id: "p3", matchPoints: 9 },
    ];

    const previousByes = new Set(["p2"]);
    const result = assignSwissPairings(players, new Set(), previousByes, 2);

    expect(result.byePlayerId).toBe("p3");
  });
});

describe("Bracket Integration", () => {
  it("generates 1v1 bracket for Top 4", () => {
    const seeds = getSeedsFromStandings([
      { leaguePlayerId: "p1", playerName: "Alice", points: 100, wins: 5, losses: 0, draws: 0, opponentMatchWinPercentage: 0.8, gameWinPercentage: 0.9 },
      { leaguePlayerId: "p2", playerName: "Bob", points: 90, wins: 4, losses: 1, draws: 0, opponentMatchWinPercentage: 0.7, gameWinPercentage: 0.8 },
      { leaguePlayerId: "p3", playerName: "Charlie", points: 80, wins: 3, losses: 2, draws: 0, opponentMatchWinPercentage: 0.6, gameWinPercentage: 0.7 },
      { leaguePlayerId: "p4", playerName: "Diana", points: 70, wins: 2, losses: 3, draws: 0, opponentMatchWinPercentage: 0.5, gameWinPercentage: 0.6 },
    ]);

    const bracket = generateBracket(seeds, 4, "1v1");

    expect(bracket.matches.length).toBe(3);
    expect(bracket.totalRounds).toBe(2);
    expect(bracket.matches[0].round).toBe(1);
    expect(bracket.matches[0].matchNumber).toBe(1);
    expect(bracket.matches[2].round).toBe(2);
    expect(bracket.matches[2].matchNumber).toBe(1);
  });

  it("generates 1v1 bracket for Top 8", () => {
    const seeds = getSeedsFromStandings([
      { leaguePlayerId: "p1", playerName: "Alice", points: 100, wins: 7, losses: 0, draws: 0, opponentMatchWinPercentage: 0.8, gameWinPercentage: 0.9 },
      { leaguePlayerId: "p2", playerName: "Bob", points: 90, wins: 6, losses: 1, draws: 0, opponentMatchWinPercentage: 0.7, gameWinPercentage: 0.8 },
      { leaguePlayerId: "p3", playerName: "Charlie", points: 80, wins: 5, losses: 2, draws: 0, opponentMatchWinPercentage: 0.6, gameWinPercentage: 0.7 },
      { leaguePlayerId: "p4", playerName: "Diana", points: 70, wins: 4, losses: 3, draws: 0, opponentMatchWinPercentage: 0.5, gameWinPercentage: 0.6 },
      { leaguePlayerId: "p5", playerName: "Eve", points: 60, wins: 3, losses: 4, draws: 0, opponentMatchWinPercentage: 0.4, gameWinPercentage: 0.5 },
      { leaguePlayerId: "p6", playerName: "Frank", points: 50, wins: 2, losses: 5, draws: 0, opponentMatchWinPercentage: 0.3, gameWinPercentage: 0.4 },
      { leaguePlayerId: "p7", playerName: "Grace", points: 40, wins: 1, losses: 6, draws: 0, opponentMatchWinPercentage: 0.2, gameWinPercentage: 0.3 },
      { leaguePlayerId: "p8", playerName: "Hank", points: 30, wins: 0, losses: 7, draws: 0, opponentMatchWinPercentage: 0.1, gameWinPercentage: 0.2 },
    ]);

    const bracket = generateBracket(seeds, 8, "1v1");

    expect(bracket.matches.length).toBe(7);
    expect(bracket.totalRounds).toBe(3);
  });

  it("generates commander bracket for 6 players", () => {
    const topCut = getCommanderTopCut(6);
    expect(topCut).toBe(4);

    const seeds = getSeedsFromStandings([
      { leaguePlayerId: "p1", playerName: "Alice", points: 100, wins: 5, losses: 0, draws: 0, opponentMatchWinPercentage: 0.8, gameWinPercentage: 0.9 },
      { leaguePlayerId: "p2", playerName: "Bob", points: 90, wins: 4, losses: 1, draws: 0, opponentMatchWinPercentage: 0.7, gameWinPercentage: 0.8 },
      { leaguePlayerId: "p3", playerName: "Charlie", points: 80, wins: 3, losses: 2, draws: 0, opponentMatchWinPercentage: 0.6, gameWinPercentage: 0.7 },
      { leaguePlayerId: "p4", playerName: "Diana", points: 70, wins: 2, losses: 3, draws: 0, opponentMatchWinPercentage: 0.5, gameWinPercentage: 0.6 },
    ]);

    const bracket = generateBracket(seeds, topCut, "COMMANDER");

    expect(bracket.matches.length).toBe(0);
    expect(bracket.pods.length).toBe(0);
    expect(bracket.byes.length).toBe(4);
    expect(bracket.totalRounds).toBe(1);
  });
});
