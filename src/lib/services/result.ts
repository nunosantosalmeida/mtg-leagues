import type { Prisma } from "@/generated/prisma/client";
import { calculateMatchPoints } from "@/lib/points/competitive";

export type TxClient = Prisma.TransactionClient;

const VALID_RESULTS = new Set(["WIN", "DRAW", "LOSS"]);

export interface ResultInput {
  leaguePlayerId: string;
  result: string;
  gamesWon?: number;
  gamesDrawn?: number;
  gamesLost?: number;
}

export interface NormalizedResult {
  leaguePlayerId: string;
  result: "WIN" | "DRAW" | "LOSS";
  gamesWon: number;
  gamesDrawn: number;
  gamesLost: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedResults: NormalizedResult[];
}

export class ResultService {
  static validateResults(
    results: ResultInput[],
    tablePlayerIds: string[],
  ): ValidationResult {
    if (!Array.isArray(results) || results.length === 0) {
      return { valid: false, error: "Results must be a non-empty array", normalizedResults: [] };
    }

    const playerIds = new Set(tablePlayerIds);
    const seen = new Set<string>();
    const normalizedResults: NormalizedResult[] = [];

    for (const entry of results) {
      if (!entry.leaguePlayerId || !entry.result) {
        return { valid: false, error: "Each result must have leaguePlayerId and result", normalizedResults: [] };
      }

      if (!playerIds.has(entry.leaguePlayerId)) {
        return { valid: false, error: `Player ${entry.leaguePlayerId} is not at this table`, normalizedResults: [] };
      }

      if (seen.has(entry.leaguePlayerId)) {
        return { valid: false, error: `Duplicate result for player ${entry.leaguePlayerId}`, normalizedResults: [] };
      }
      seen.add(entry.leaguePlayerId);

      const upperResult = entry.result.toUpperCase();
      if (!VALID_RESULTS.has(upperResult)) {
        return { valid: false, error: `Invalid result "${entry.result}". Must be WIN, DRAW, or LOSS`, normalizedResults: [] };
      }

      normalizedResults.push({
        leaguePlayerId: entry.leaguePlayerId,
        result: upperResult as "WIN" | "DRAW" | "LOSS",
        gamesWon: entry.gamesWon ?? 0,
        gamesDrawn: entry.gamesDrawn ?? 0,
        gamesLost: entry.gamesLost ?? 0,
      });
    }

    return { valid: true, normalizedResults };
  }

  static async recordResults(
    tx: TxClient,
    tableId: string,
    results: NormalizedResult[],
    isCompetitive: boolean,
  ): Promise<void> {
    for (const entry of results) {
      const data: Record<string, unknown> = { result: entry.result };

      if (isCompetitive) {
        data.matchPoints = calculateMatchPoints(entry.result);
        data.gamesWon = entry.gamesWon;
        data.gamesDrawn = entry.gamesDrawn;
        data.gamesLost = entry.gamesLost;
      }

      await tx.tablePlayer.updateMany({
        where: { tableId, leaguePlayerId: entry.leaguePlayerId },
        data,
      });
    }
  }
}
