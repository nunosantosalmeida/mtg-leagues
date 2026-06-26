import { describe, it, expect } from "vitest";
import { assignRandomTables, hasBye, getByePlayerId, randomizeSeats } from "@/lib/pairing/random";

describe("assignRandomTables", () => {
  describe("4-player tables (Commander)", () => {
    it("returns empty for less than 3 players", () => {
      expect(assignRandomTables(["a", "b"], 4)).toEqual([]);
      expect(assignRandomTables(["a"], 4)).toEqual([]);
      expect(assignRandomTables([], 4)).toEqual([]);
    });

    it("returns single table for 3-5 players", () => {
      const result = assignRandomTables(["a", "b", "c"], 4);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(3);
    });

    it("returns single table for 5 players", () => {
      const result = assignRandomTables(["a", "b", "c", "d", "e"], 4);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(5);
    });

    it("returns two tables for 6 players", () => {
      const result = assignRandomTables(["a", "b", "c", "d", "e", "f"], 4);
      expect(result).toHaveLength(2);
    });

    it("returns two 4-player tables for 8 players", () => {
      const result = assignRandomTables(
        ["a", "b", "c", "d", "e", "f", "g", "h"],
        4
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(4);
      expect(result[1]).toHaveLength(4);
    });

    it("all players are assigned exactly once", () => {
      const players = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const result = assignRandomTables(players, 4);
      const assigned = result.flat();
      expect(assigned.sort()).toEqual(players.sort());
    });

    it("handles 7 players (3+4)", () => {
      const result = assignRandomTables(
        ["a", "b", "c", "d", "e", "f", "g"],
        4
      );
      expect(result).toHaveLength(2);
      const assigned = result.flat();
      expect(assigned.sort()).toEqual(
        ["a", "b", "c", "d", "e", "f", "g"].sort()
      );
    });
  });

  describe("1v1 tables", () => {
    it("pairs even number of players", () => {
      const result = assignRandomTables(["a", "b", "c", "d"], 2);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(2);
      expect(result[1]).toHaveLength(2);
    });

    it("odd number leaves last unpaired", () => {
      const result = assignRandomTables(["a", "b", "c"], 2);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
    });

    it("single player returns empty", () => {
      const result = assignRandomTables(["a"], 2);
      expect(result).toHaveLength(0);
    });
  });
});

describe("hasBye", () => {
  it("returns true for odd count", () => {
    expect(hasBye(["a", "b", "c"])).toBe(true);
  });

  it("returns false for even count", () => {
    expect(hasBye(["a", "b"])).toBe(false);
  });

  it("returns false for empty", () => {
    expect(hasBye([])).toBe(false);
  });
});

describe("getByePlayerId", () => {
  it("returns null for even count", () => {
    expect(getByePlayerId(["a", "b"])).toBeNull();
  });

  it("returns a player ID for odd count", () => {
    const result = getByePlayerId(["a", "b", "c"]);
    expect(["a", "b", "c"]).toContain(result);
  });

  it("returns null for empty", () => {
    expect(getByePlayerId([])).toBeNull();
  });
});

describe("randomizeSeats", () => {
  it("returns correct number of seats", () => {
    const result = randomizeSeats(["a", "b", "c"]);
    expect(result).toHaveLength(3);
  });

  it("assigns seat positions 1-N", () => {
    const result = randomizeSeats(["a", "b", "c"]);
    const seats = result.map((r) => r.seatPosition).sort();
    expect(seats).toEqual([1, 2, 3]);
  });

  it("all players are included", () => {
    const result = randomizeSeats(["a", "b", "c"]);
    const ids = result.map((r) => r.playerId).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("handles empty array", () => {
    expect(randomizeSeats([])).toEqual([]);
  });
});
