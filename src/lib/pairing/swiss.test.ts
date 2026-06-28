import { describe, it, expect } from "vitest";
import {
  assignSwissPairings,
  SwissPlayer,
} from "./swiss";

function makePlayers(count: number, matchPoints?: number[]): SwissPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    matchPoints: matchPoints?.[i] ?? 0,
  }));
}

describe("assignSwissPairings", () => {
  it("pairs all players with no byes when even count", () => {
    const players = makePlayers(4, [6, 6, 3, 3]);
    const result = assignSwissPairings(players, new Set(), new Set(), 2);

    expect(result.pairs.length).toBe(2);
    expect(result.byePlayerId).toBeNull();

    const allIds = result.pairs.flatMap((p) => [p.player1Id, p.player2Id]);
    expect(new Set(allIds).size).toBe(4);
  });

  it("gives bye to lowest-ranked player without a prior bye", () => {
    const players = makePlayers(5, [6, 6, 3, 3, 0]);
    const result = assignSwissPairings(players, new Set(), new Set(), 2);

    expect(result.byePlayerId).toBe("p5");
    expect(result.pairs.length).toBe(2);
  });

  it("avoids rematches", () => {
    const players = makePlayers(4, [6, 6, 3, 3]);
    const matchups = new Set(["p1:p2"]);
    const result = assignSwissPairings(players, matchups, new Set(), 2);

    for (const pair of result.pairs) {
      const key =
        pair.player1Id < pair.player2Id
          ? `${pair.player1Id}:${pair.player2Id}`
          : `${pair.player2Id}:${pair.player1Id}`;
      expect(matchups.has(key)).toBe(false);
    }
  });

  it("skips player who already had a bye for bye assignment", () => {
    const players = makePlayers(5, [6, 3, 3, 0, 0]);
    const byes = new Set(["p5"]);
    const result = assignSwissPairings(players, new Set(), byes, 2);

    expect(result.byePlayerId).not.toBe("p5");
    expect(result.byePlayerId).toBe("p4");
  });

  it("round 1 pairs randomly without considering match points", () => {
    const players = makePlayers(4, [0, 0, 0, 0]);
    const result = assignSwissPairings(players, new Set(), new Set(), 1);

    expect(result.pairs.length).toBe(2);
    expect(result.byePlayerId).toBeNull();
  });

  it("handles 2 players", () => {
    const players = makePlayers(2, [3, 0]);
    const result = assignSwissPairings(players, new Set(), new Set(), 2);

    expect(result.pairs.length).toBe(1);
    expect(result.byePlayerId).toBeNull();
  });

  it("handles single player with bye", () => {
    const players = makePlayers(1, [3]);
    const result = assignSwissPairings(players, new Set(), new Set(), 2);

    expect(result.pairs.length).toBe(0);
    expect(result.byePlayerId).toBe("p1");
  });

  it("pairs within score brackets when all same record", () => {
    const players = makePlayers(6, [6, 6, 6, 6, 6, 6]);
    const result = assignSwissPairings(players, new Set(), new Set(), 2);

    expect(result.pairs.length).toBe(3);
    expect(result.byePlayerId).toBeNull();
  });

  it("handles three different score brackets", () => {
    const players = makePlayers(6, [9, 6, 6, 3, 3, 0]);
    const result = assignSwissPairings(players, new Set(), new Set(), 3);

    expect(result.pairs.length).toBe(3);
    expect(result.byePlayerId).toBeNull();
  });

  it("all players are paired exactly once", () => {
    const players = makePlayers(8, [9, 9, 6, 6, 3, 3, 0, 0]);
    const result = assignSwissPairings(players, new Set(), new Set(), 2);

    expect(result.pairs.length).toBe(4);
    const allIds = result.pairs.flatMap((p) => [p.player1Id, p.player2Id]);
    expect(new Set(allIds).size).toBe(8);
  });
});
