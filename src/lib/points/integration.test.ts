import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateBet, calculateLateEntryPoints, calculateWinnerPot, calculateDrawSplit, calculateTableResults } from "@/lib/points/calculator";

vi.mock("@/lib/prisma", () => ({
  default: {
    league: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    leaguePlayer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    leagueDay: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    round: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    table: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    tablePlayer: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    playerPointChange: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    roundAbsence: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fns: any[]) => {
      if (Array.isArray(fns)) {
        return Promise.all(fns);
      }
      return fns;
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("Calculator Integration", () => {
  describe("calculateBet", () => {
    it("calculates 7% of points", () => {
      expect(calculateBet(1500)).toBe(105);
    });

    it("rounds down to 2 decimal places", () => {
      expect(calculateBet(100)).toBe(7);
    });
  });

  describe("calculateLateEntryPoints", () => {
    it("returns starting points for 0 missed rounds", () => {
      expect(calculateLateEntryPoints(0)).toBe(1500);
    });

    it("applies 93% multiplier per missed round", () => {
      expect(calculateLateEntryPoints(1)).toBe(1395);
    });
  });

  describe("calculateWinnerPot", () => {
    it("returns total bets for 2-player table", () => {
      expect(calculateWinnerPot([100, 80], 2)).toBe(180);
    });

    it("returns total bets for 4-player table", () => {
      expect(calculateWinnerPot([100, 80, 60, 40], 4)).toBe(280);
    });

    it("adds lowest bet for 3-player table", () => {
      const bets = [100, 80, 60];
      expect(calculateWinnerPot(bets, 3)).toBe(300);
    });

    it("takes 80% for 5-player table", () => {
      const bets = [100, 80, 60, 40, 20];
      expect(calculateWinnerPot(bets, 5)).toBe(240);
    });
  });

  describe("calculateDrawSplit", () => {
    it("splits total bets equally for 2 players", () => {
      expect(calculateDrawSplit(200, 2)).toBe(100);
    });

    it("splits total bets equally for 4 players", () => {
      expect(calculateDrawSplit(400, 4)).toBe(100);
    });
  });

  describe("calculateTableResults", () => {
    it("calculates WIN for 2-player table", () => {
      const results = calculateTableResults([
        { leaguePlayerId: "p1", points: 1000, result: "WIN" },
        { leaguePlayerId: "p2", points: 1000, result: "LOSS" },
      ]);

      const p1 = results.find((r) => r.leaguePlayerId === "p1");
      const p2 = results.find((r) => r.leaguePlayerId === "p2");

      expect(p1?.changeType).toBe("WIN");
      expect(p1?.bet).toBe(70);
      expect(p1?.pointsChange).toBe(70);
      expect(p1?.pointsAfter).toBe(1070);

      expect(p2?.changeType).toBe("LOSS");
      expect(p2?.pointsChange).toBe(-70);
      expect(p2?.pointsAfter).toBe(930);
    });

    it("calculates DRAW for 2-player table", () => {
      const results = calculateTableResults([
        { leaguePlayerId: "p1", points: 1000, result: "DRAW" },
        { leaguePlayerId: "p2", points: 1000, result: "DRAW" },
      ]);

      const p1 = results.find((r) => r.leaguePlayerId === "p1");
      expect(p1?.changeType).toBe("DRAW_SHARE");
      expect(p1?.pointsChange).toBe(0);
    });

    it("calculates WIN for 3-player table", () => {
      const results = calculateTableResults([
        { leaguePlayerId: "p1", points: 1000, result: "WIN" },
        { leaguePlayerId: "p2", points: 1000, result: "LOSS" },
        { leaguePlayerId: "p3", points: 1000, result: "LOSS" },
      ]);

      const p1 = results.find((r) => r.leaguePlayerId === "p1");
      expect(p1?.changeType).toBe("THREE_PLAYER_BONUS");
      expect(p1?.pointsChange).toBeGreaterThan(70);
    });

    it("calculates WIN for 4-player table", () => {
      const results = calculateTableResults([
        { leaguePlayerId: "p1", points: 1000, result: "WIN" },
        { leaguePlayerId: "p2", points: 1000, result: "LOSS" },
        { leaguePlayerId: "p3", points: 1000, result: "LOSS" },
        { leaguePlayerId: "p4", points: 1000, result: "LOSS" },
      ]);

      const p1 = results.find((r) => r.leaguePlayerId === "p1");
      expect(p1?.changeType).toBe("WIN");
      expect(p1?.pointsChange).toBe(210);
    });

    it("calculates WIN for 5-player table", () => {
      const results = calculateTableResults([
        { leaguePlayerId: "p1", points: 1000, result: "WIN" },
        { leaguePlayerId: "p2", points: 1000, result: "LOSS" },
        { leaguePlayerId: "p3", points: 1000, result: "LOSS" },
        { leaguePlayerId: "p4", points: 1000, result: "LOSS" },
        { leaguePlayerId: "p5", points: 1000, result: "LOSS" },
      ]);

      const p1 = results.find((r) => r.leaguePlayerId === "p1");
      expect(p1?.changeType).toBe("FIVE_PLAYER_PENALTY");
      expect(p1?.pointsChange).toBe(210);
    });

    it("single-player bye returns full bet", () => {
      const results = calculateTableResults([
        { leaguePlayerId: "p1", points: 1000, result: "WIN" },
      ]);

      const p1 = results.find((r) => r.leaguePlayerId === "p1");
      expect(p1?.changeType).toBe("WIN");
      expect(p1?.bet).toBe(70);
      expect(p1?.pointsChange).toBe(70);
      expect(p1?.pointsAfter).toBe(1070);
    });
  });
});
