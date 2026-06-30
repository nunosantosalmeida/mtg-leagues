import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { ScoringService, type CloseRoundContext } from "./scoring";

let prisma: PrismaClient;
let leagueId: string;
let leagueDayId: string;

beforeEach(async () => {
  const adapter = new PrismaBetterSqlite3({ url: "file::memory:" });
  prisma = new PrismaClient({ adapter });

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "League" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'STANDARD',
      "scoringSystem" TEXT NOT NULL DEFAULT 'POINTS',
      "createdBy" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'REGISTRATION',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'PLAYER'
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LeaguePlayer" (
      id TEXT PRIMARY KEY,
      "leagueId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      points REAL NOT NULL DEFAULT 0,
      "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isActive" BOOLEAN NOT NULL DEFAULT 1
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LeagueDay" (
      id TEXT PRIMARY KEY,
      "leagueId" TEXT NOT NULL,
      "dayNumber" INTEGER NOT NULL,
      name TEXT,
      type TEXT NOT NULL DEFAULT 'REGULAR',
      status TEXT NOT NULL DEFAULT 'PLANNED',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Round" (
      id TEXT PRIMARY KEY,
      "leagueDayId" TEXT NOT NULL,
      "roundNumber" INTEGER NOT NULL,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Table" (
      id TEXT PRIMARY KEY,
      "roundId" TEXT NOT NULL,
      "tableNumber" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TablePlayer" (
      id TEXT PRIMARY KEY,
      "tableId" TEXT NOT NULL,
      "leaguePlayerId" TEXT NOT NULL,
      "seatPosition" INTEGER NOT NULL,
      result TEXT NOT NULL DEFAULT 'PENDING',
      "pointsWagered" REAL NOT NULL DEFAULT 0,
      "pointsChange" REAL NOT NULL DEFAULT 0,
      "matchPoints" INTEGER NOT NULL DEFAULT 0,
      "gamesWon" INTEGER NOT NULL DEFAULT 0,
      "gamesDrawn" INTEGER NOT NULL DEFAULT 0,
      "gamesLost" INTEGER NOT NULL DEFAULT 0
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlayerPointChange" (
      id TEXT PRIMARY KEY,
      "leaguePlayerId" TEXT NOT NULL,
      "roundId" TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      description TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RoundAbsence" (
      id TEXT PRIMARY KEY,
      "roundId" TEXT NOT NULL,
      "leaguePlayerId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  leagueId = "test-league";
  leagueDayId = "test-day";
  await prisma.$executeRawUnsafe(`INSERT INTO "League" (id, name, format, "scoringSystem", "createdBy", status) VALUES (?, ?, ?, ?, ?, ?)`, leagueId, "Test League", "STANDARD", "TRADITIONAL", "user1", "ACTIVE");
  await prisma.$executeRawUnsafe(`INSERT INTO "LeagueDay" (id, "leagueId", "dayNumber", name, type, status) VALUES (?, ?, ?, ?, ?, ?)`, leagueDayId, leagueId, 1, "Day 1", "REGULAR", "ACTIVE");
});

afterEach(async () => {
  await prisma.$disconnect();
});

function createPlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    userId: `user-${i + 1}`,
    leaguePlayerId: `lp-${i + 1}`,
  }));
}

async function setupRound(players: ReturnType<typeof createPlayers>) {
  const roundId = "test-round";
  await prisma.$executeRawUnsafe(`INSERT INTO "Round" (id, "leagueDayId", "roundNumber", name, status) VALUES (?, ?, ?, ?, ?)`, roundId, leagueDayId, 1, null, "IN_PROGRESS");
  for (const p of players) {
    await prisma.$executeRawUnsafe(`INSERT INTO "User" (id, name, email, role) VALUES (?, ?, ?, ?)`, p.userId, p.userId, `${p.userId}@test.com`, "PLAYER");
    await prisma.$executeRawUnsafe(`INSERT INTO "LeaguePlayer" (id, "leagueId", "userId", points) VALUES (?, ?, ?, ?)`, p.leaguePlayerId, leagueId, p.userId, 0);
  }
  return roundId;
}

async function createTable(roundId: string, tableNumber: number, players: { leaguePlayerId: string; seatPosition: number; result: string }[]) {
  const tableId = `table-${tableNumber}`;
  await prisma.$executeRawUnsafe(`INSERT INTO "Table" (id, "roundId", "tableNumber") VALUES (?, ?, ?)`, tableId, roundId, tableNumber);
  for (const p of players) {
    await prisma.$executeRawUnsafe(`INSERT INTO "TablePlayer" (id, "tableId", "leaguePlayerId", "seatPosition", result, "pointsWagered", "pointsChange", "matchPoints", "gamesWon", "gamesDrawn", "gamesLost") VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`, `tp-${tableNumber}-${p.seatPosition}`, tableId, p.leaguePlayerId, p.seatPosition, p.result);
  }
  return tableId;
}

describe("ScoringService.closeRound - Traditional scoring", () => {
  it("writes correct matchPoints and game data for WIN (2-0)", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "LOSS" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 0, result: "LOSS", gamesWon: 0, gamesDrawn: 0, gamesLost: 2 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    const winnerTP = await prisma.$queryRawUnsafe<{ matchPoints: number; gamesWon: number; gamesDrawn: number; gamesLost: number }[]>(
      `SELECT "matchPoints", "gamesWon", "gamesDrawn", "gamesLost" FROM "TablePlayer" WHERE "leaguePlayerId" = ?`, players[0].leaguePlayerId
    );
    expect(winnerTP[0].matchPoints).toBe(3);
    expect(winnerTP[0].gamesWon).toBe(2);
    expect(winnerTP[0].gamesDrawn).toBe(0);
    expect(winnerTP[0].gamesLost).toBe(0);

    const loserTP = await prisma.$queryRawUnsafe<{ matchPoints: number; gamesWon: number; gamesDrawn: number; gamesLost: number }[]>(
      `SELECT "matchPoints", "gamesWon", "gamesDrawn", "gamesLost" FROM "TablePlayer" WHERE "leaguePlayerId" = ?`, players[1].leaguePlayerId
    );
    expect(loserTP[0].matchPoints).toBe(0);
    expect(loserTP[0].gamesWon).toBe(0);
    expect(loserTP[0].gamesDrawn).toBe(0);
    expect(loserTP[0].gamesLost).toBe(2);
  });

  it("writes correct game data for DRAW (1-1)", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "DRAW" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "DRAW" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "DRAW", gamesWon: 1, gamesDrawn: 1, gamesLost: 1 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 0, result: "DRAW", gamesWon: 1, gamesDrawn: 1, gamesLost: 1 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    for (const p of players) {
      const tp = await prisma.$queryRawUnsafe<{ matchPoints: number; gamesWon: number; gamesDrawn: number; gamesLost: number }[]>(
        `SELECT "matchPoints", "gamesWon", "gamesDrawn", "gamesLost" FROM "TablePlayer" WHERE "leaguePlayerId" = ?`, p.leaguePlayerId
      );
      expect(tp[0].matchPoints).toBe(1);
      expect(tp[0].gamesWon).toBe(1);
      expect(tp[0].gamesDrawn).toBe(1);
      expect(tp[0].gamesLost).toBe(1);
    }
  });

  it("updates leaguePlayer cumulative points correctly", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "LOSS" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 0, result: "LOSS", gamesWon: 0, gamesDrawn: 0, gamesLost: 2 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    const winnerLP = await prisma.$queryRawUnsafe<{ points: number }[]>(
      `SELECT points FROM "LeaguePlayer" WHERE id = ?`, players[0].leaguePlayerId
    );
    expect(winnerLP[0].points).toBe(3);

    const loserLP = await prisma.$queryRawUnsafe<{ points: number }[]>(
      `SELECT points FROM "LeaguePlayer" WHERE id = ?`, players[1].leaguePlayerId
    );
    expect(loserLP[0].points).toBe(0);
  });

  it("creates PlayerPointChange records for non-zero results", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "LOSS" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 0, result: "LOSS", gamesWon: 0, gamesDrawn: 0, gamesLost: 2 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    const changes = await prisma.$queryRawUnsafe<{ "leaguePlayerId": string; type: string; amount: number }[]>(
      `SELECT "leaguePlayerId", type, amount FROM "PlayerPointChange" WHERE "roundId" = ? ORDER BY amount DESC`, roundId
    );
    expect(changes.length).toBe(1);
    expect(changes[0].leaguePlayerId).toBe(players[0].leaguePlayerId);
    expect(changes[0].type).toBe("WIN");
    expect(changes[0].amount).toBe(3);
  });

  it("handles bye (1-player table) correctly", async () => {
    const players = createPlayers(1);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "WIN", gamesWon: 1, gamesDrawn: 0, gamesLost: 0 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    const tp = await prisma.$queryRawUnsafe<{ matchPoints: number; gamesWon: number; gamesDrawn: number; gamesLost: number }[]>(
      `SELECT "matchPoints", "gamesWon", "gamesDrawn", "gamesLost" FROM "TablePlayer" WHERE "leaguePlayerId" = ?`, players[0].leaguePlayerId
    );
    expect(tp[0].matchPoints).toBe(3);
    expect(tp[0].gamesWon).toBe(1);
    expect(tp[0].gamesDrawn).toBe(0);
    expect(tp[0].gamesLost).toBe(0);

    const lp = await prisma.$queryRawUnsafe<{ points: number }[]>(
      `SELECT points FROM "LeaguePlayer" WHERE id = ?`, players[0].leaguePlayerId
    );
    expect(lp[0].points).toBe(3);
  });

  it("marks round as COMPLETED", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "LOSS" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 0, result: "LOSS", gamesWon: 0, gamesDrawn: 0, gamesLost: 2 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    const round = await prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM "Round" WHERE id = ?`, roundId
    );
    expect(round[0].status).toBe("COMPLETED");
  });
});

describe("ScoringService.closeRound - Bet League scoring", () => {
  it("writes correct pointsWagered and pointsChange for WIN", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    await prisma.$executeRawUnsafe(`UPDATE "LeaguePlayer" SET points = 1500 WHERE id = ?`, players[0].leaguePlayerId);
    await prisma.$executeRawUnsafe(`UPDATE "LeaguePlayer" SET points = 1500 WHERE id = ?`, players[1].leaguePlayerId);

    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "LOSS" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 1500, result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 1500, result: "LOSS", gamesWon: 0, gamesDrawn: 0, gamesLost: 2 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "POINTS", dayType: "REGULAR", roundName: null,
      });
    });

    const winnerTP = await prisma.$queryRawUnsafe<{ pointsWagered: number; pointsChange: number }[]>(
      `SELECT "pointsWagered", "pointsChange" FROM "TablePlayer" WHERE "leaguePlayerId" = ?`, players[0].leaguePlayerId
    );
    expect(winnerTP[0].pointsWagered).toBeGreaterThan(0);
    expect(winnerTP[0].pointsChange).toBeGreaterThan(0);

    const loserTP = await prisma.$queryRawUnsafe<{ pointsWagered: number; pointsChange: number }[]>(
      `SELECT "pointsWagered", "pointsChange" FROM "TablePlayer" WHERE "leaguePlayerId" = ?`, players[1].leaguePlayerId
    );
    expect(loserTP[0].pointsWagered).toBeGreaterThan(0);
    expect(loserTP[0].pointsChange).toBeLessThan(0);
  });
});

describe("Reopen round preserves results and game data", () => {
  it("WIN/LOSS: results and game scores preserved, scoring totals reset", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "LOSS" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "WIN", gamesWon: 2, gamesDrawn: 0, gamesLost: 0 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 0, result: "LOSS", gamesWon: 0, gamesDrawn: 0, gamesLost: 2 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    const beforeReopen = await prisma.$queryRawUnsafe<{ result: string; matchPoints: number; gamesWon: number; gamesLost: number }[]>(
      `SELECT result, "matchPoints", "gamesWon", "gamesLost" FROM "TablePlayer" WHERE "tableId" = ? ORDER BY "seatPosition"`, tableId
    );
    expect(beforeReopen[0].result).toBe("WIN");
    expect(beforeReopen[0].matchPoints).toBe(3);
    expect(beforeReopen[0].gamesWon).toBe(2);
    expect(beforeReopen[1].result).toBe("LOSS");
    expect(beforeReopen[1].matchPoints).toBe(0);
    expect(beforeReopen[1].gamesLost).toBe(2);

    // Simulate reopen
    const pointChanges = await prisma.$queryRawUnsafe<{ id: string; "leaguePlayerId": string; amount: number }[]>(
      `SELECT id, "leaguePlayerId", amount FROM "PlayerPointChange" WHERE "roundId" = ?`, roundId
    );
    for (const pc of pointChanges) {
      await prisma.$executeRawUnsafe(`UPDATE "LeaguePlayer" SET points = points - ? WHERE id = ?`, pc.amount, pc.leaguePlayerId);
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "PlayerPointChange" WHERE "roundId" = ?`, roundId);
    const tablePlayers = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "TablePlayer" WHERE "tableId" = ?`, tableId
    );
    for (const tp of tablePlayers) {
      await prisma.$executeRawUnsafe(
        `UPDATE "TablePlayer" SET "matchPoints" = 0, "pointsChange" = 0, "pointsWagered" = 0 WHERE id = ?`, tp.id
      );
    }
    await prisma.$executeRawUnsafe(`UPDATE "Round" SET status = 'IN_PROGRESS' WHERE id = ?`, roundId);

    const afterReopen = await prisma.$queryRawUnsafe<{ result: string; matchPoints: number; gamesWon: number; gamesDrawn: number; gamesLost: number; pointsChange: number }[]>(
      `SELECT result, "matchPoints", "gamesWon", "gamesDrawn", "gamesLost", "pointsChange" FROM "TablePlayer" WHERE "tableId" = ? ORDER BY "seatPosition"`, tableId
    );
    expect(afterReopen[0].result).toBe("WIN");
    expect(afterReopen[0].gamesWon).toBe(2);
    expect(afterReopen[0].gamesDrawn).toBe(0);
    expect(afterReopen[0].gamesLost).toBe(0);
    expect(afterReopen[0].matchPoints).toBe(0);
    expect(afterReopen[0].pointsChange).toBe(0);
    expect(afterReopen[1].result).toBe("LOSS");
    expect(afterReopen[1].gamesWon).toBe(0);
    expect(afterReopen[1].gamesDrawn).toBe(0);
    expect(afterReopen[1].gamesLost).toBe(2);
    expect(afterReopen[1].matchPoints).toBe(0);
    expect(afterReopen[1].pointsChange).toBe(0);

    for (const p of players) {
      const lp = await prisma.$queryRawUnsafe<{ points: number }[]>(
        `SELECT points FROM "LeaguePlayer" WHERE id = ?`, p.leaguePlayerId
      );
      expect(lp[0].points).toBe(0);
    }

    const remainingChanges = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM "PlayerPointChange" WHERE "roundId" = ?`, roundId
    );
    expect(Number(remainingChanges[0].count)).toBe(0);
  });

  it("DRAW: results and game scores preserved after reopen", async () => {
    const players = createPlayers(2);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "DRAW" },
      { leaguePlayerId: players[1].leaguePlayerId, seatPosition: 2, result: "DRAW" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "DRAW", gamesWon: 1, gamesDrawn: 1, gamesLost: 1 },
            { leaguePlayerId: players[1].leaguePlayerId, points: 0, result: "DRAW", gamesWon: 1, gamesDrawn: 1, gamesLost: 1 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    // Simulate reopen
    const pointChanges = await prisma.$queryRawUnsafe<{ id: string; "leaguePlayerId": string; amount: number }[]>(
      `SELECT id, "leaguePlayerId", amount FROM "PlayerPointChange" WHERE "roundId" = ?`, roundId
    );
    for (const pc of pointChanges) {
      await prisma.$executeRawUnsafe(`UPDATE "LeaguePlayer" SET points = points - ? WHERE id = ?`, pc.amount, pc.leaguePlayerId);
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "PlayerPointChange" WHERE "roundId" = ?`, roundId);
    const tablePlayers = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "TablePlayer" WHERE "tableId" = ?`, tableId
    );
    for (const tp of tablePlayers) {
      await prisma.$executeRawUnsafe(
        `UPDATE "TablePlayer" SET "matchPoints" = 0, "pointsChange" = 0, "pointsWagered" = 0 WHERE id = ?`, tp.id
      );
    }
    await prisma.$executeRawUnsafe(`UPDATE "Round" SET status = 'IN_PROGRESS' WHERE id = ?`, roundId);

    const afterReopen = await prisma.$queryRawUnsafe<{ result: string; matchPoints: number; gamesWon: number; gamesDrawn: number; gamesLost: number }[]>(
      `SELECT result, "matchPoints", "gamesWon", "gamesDrawn", "gamesLost" FROM "TablePlayer" WHERE "tableId" = ? ORDER BY "seatPosition"`, tableId
    );
    expect(afterReopen[0].result).toBe("DRAW");
    expect(afterReopen[0].gamesWon).toBe(1);
    expect(afterReopen[0].gamesDrawn).toBe(1);
    expect(afterReopen[0].gamesLost).toBe(1);
    expect(afterReopen[0].matchPoints).toBe(0);
    expect(afterReopen[1].result).toBe("DRAW");
    expect(afterReopen[1].gamesWon).toBe(1);
    expect(afterReopen[1].gamesDrawn).toBe(1);
    expect(afterReopen[1].gamesLost).toBe(1);
    expect(afterReopen[1].matchPoints).toBe(0);
  });

  it("bye: result and game data preserved after reopen", async () => {
    const players = createPlayers(1);
    const roundId = await setupRound(players);
    const tableId = await createTable(roundId, 1, [
      { leaguePlayerId: players[0].leaguePlayerId, seatPosition: 1, result: "WIN" },
    ]);

    await prisma.$transaction(async (tx) => {
      await ScoringService.closeRound(tx, {
        roundId, roundNumber: 1, dayNumber: 1, dayName: "Day 1",
        tables: [{
          tableId, tableNumber: 1,
          players: [
            { leaguePlayerId: players[0].leaguePlayerId, points: 0, result: "WIN", gamesWon: 1, gamesDrawn: 0, gamesLost: 0 },
          ],
        }],
        absences: [], format: "STANDARD", scoringSystem: "TRADITIONAL", dayType: "REGULAR", roundName: null,
      });
    });

    // Simulate reopen
    const pointChanges = await prisma.$queryRawUnsafe<{ id: string; "leaguePlayerId": string; amount: number }[]>(
      `SELECT id, "leaguePlayerId", amount FROM "PlayerPointChange" WHERE "roundId" = ?`, roundId
    );
    for (const pc of pointChanges) {
      await prisma.$executeRawUnsafe(`UPDATE "LeaguePlayer" SET points = points - ? WHERE id = ?`, pc.amount, pc.leaguePlayerId);
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "PlayerPointChange" WHERE "roundId" = ?`, roundId);
    const tablePlayers = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "TablePlayer" WHERE "tableId" = ?`, tableId
    );
    for (const tp of tablePlayers) {
      await prisma.$executeRawUnsafe(
        `UPDATE "TablePlayer" SET "matchPoints" = 0, "pointsChange" = 0, "pointsWagered" = 0 WHERE id = ?`, tp.id
      );
    }
    await prisma.$executeRawUnsafe(`UPDATE "Round" SET status = 'IN_PROGRESS' WHERE id = ?`, roundId);

    const afterReopen = await prisma.$queryRawUnsafe<{ result: string; matchPoints: number; gamesWon: number }[]>(
      `SELECT result, "matchPoints", "gamesWon" FROM "TablePlayer" WHERE "tableId" = ?`, tableId
    );
    expect(afterReopen[0].result).toBe("WIN");
    expect(afterReopen[0].gamesWon).toBe(1);
    expect(afterReopen[0].matchPoints).toBe(0);

    const lp = await prisma.$queryRawUnsafe<{ points: number }[]>(
      `SELECT points FROM "LeaguePlayer" WHERE id = ?`, players[0].leaguePlayerId
    );
    expect(lp[0].points).toBe(0);
  });
});
