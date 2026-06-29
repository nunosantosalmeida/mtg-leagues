import type { Prisma } from "@/generated/prisma/client";
import {
  calculateTableResults as calcTableResults,
  calculateBet,
  type TableCalculationInput,
} from "@/lib/points/calculator";
import { isCommanderFormat } from "@/lib/types";

type TxClient = Prisma.TransactionClient;

export interface CloseRoundTableContext {
  tableId: string;
  tableNumber: number;
  players: {
    leaguePlayerId: string;
    points: number;
    result: string;
  }[];
}

export interface CloseRoundContext {
  roundId: string;
  roundNumber: number;
  dayNumber: number;
  dayName: string | null;
  tables: CloseRoundTableContext[];
  absences: { leaguePlayerId: string; points: number }[];
  format: string;
  scoringSystem: string;
  dayType: string;
  roundName: string | null;
}

export class ScoringService {
  static calculateTableResults(inputs: TableCalculationInput[]) {
    return calcTableResults(inputs);
  }

  static calculateAbsencePenalty(points: number): number {
    return calculateBet(points);
  }

  static async closeRound(
    tx: TxClient,
    ctx: CloseRoundContext,
  ): Promise<void> {
    const isCompetitive = ctx.scoringSystem === "COMPETITIVE";
    const isCommanderSemifinal = ctx.roundName === "Semifinals" && isCommanderFormat(ctx.format);
    const isCommanderFinals = ctx.roundName === "Finals" && isCommanderFormat(ctx.format);
    const skipPointCalc = isCommanderSemifinal || isCommanderFinals;

    if (skipPointCalc) {
      await tx.round.update({
        where: { id: ctx.roundId },
        data: { status: "COMPLETED" },
      });
      return;
    }

    if (!isCompetitive) {
      await ScoringService.closeBetLeagueRound(tx, ctx);
    } else {
      await ScoringService.closeCompetitiveRound(tx, ctx);
    }

    await tx.round.update({
      where: { id: ctx.roundId },
      data: { status: "COMPLETED" },
    });
  }

  private static async closeBetLeagueRound(
    tx: TxClient,
    ctx: CloseRoundContext,
  ): Promise<void> {
    for (const table of ctx.tables) {
      const calcInputs: TableCalculationInput[] = table.players.map((tp) => ({
        leaguePlayerId: tp.leaguePlayerId,
        points: tp.points,
        result: tp.result as "WIN" | "DRAW" | "LOSS" | "PENDING",
      }));

      const calcResults = calcTableResults(calcInputs);

      for (const calc of calcResults) {
        await tx.tablePlayer.updateMany({
          where: { tableId: table.tableId, leaguePlayerId: calc.leaguePlayerId },
          data: {
            pointsWagered: calc.bet,
            pointsChange: calc.pointsChange,
          },
        });

        await tx.leaguePlayer.update({
          where: { id: calc.leaguePlayerId },
          data: { points: calc.pointsAfter },
        });

        const changeType = calc.changeType === "LOSS" ? "LOSS" : calc.changeType;

        await tx.playerPointChange.create({
          data: {
            leaguePlayerId: calc.leaguePlayerId,
            roundId: ctx.roundId,
            type: changeType,
            amount: calc.pointsChange,
            description: `Day ${ctx.dayNumber} (${ctx.dayName || "Regular"}) - Round ${ctx.roundNumber} - Table ${table.tableNumber} - ${calc.changeType}`,
          },
        });
      }
    }

    for (const absence of ctx.absences) {
      const bet = calculateBet(absence.points);

      await tx.leaguePlayer.update({
        where: { id: absence.leaguePlayerId },
        data: { points: { decrement: bet } },
      });

      await tx.playerPointChange.create({
        data: {
          leaguePlayerId: absence.leaguePlayerId,
          roundId: ctx.roundId,
          type: "ABSENT",
          amount: -bet,
          description: `Day ${ctx.dayNumber} (${ctx.dayName || "Regular"}) - Round ${ctx.roundNumber} - Absent`,
        },
      });
    }
  }

  private static async closeCompetitiveRound(
    tx: TxClient,
    ctx: CloseRoundContext,
  ): Promise<void> {
    for (const table of ctx.tables) {
      for (const tp of table.players) {
        const matchPoints = tp.result === "WIN" ? 3 : tp.result === "DRAW" ? 1 : 0;
        const currentPoints = tp.points;
        const newPoints = currentPoints + matchPoints;

        await tx.leaguePlayer.update({
          where: { id: tp.leaguePlayerId },
          data: { points: newPoints },
        });

        if (matchPoints !== 0) {
          await tx.playerPointChange.create({
            data: {
              leaguePlayerId: tp.leaguePlayerId,
              roundId: ctx.roundId,
              type: matchPoints > 0 ? "WIN" : "DRAW",
              amount: matchPoints,
              description: `Day ${ctx.dayNumber} (${ctx.dayName || "Regular"}) - Round ${ctx.roundNumber} - Table ${table.tableNumber} - ${matchPoints} MP`,
            },
          });
        }
      }
    }

    for (const absence of ctx.absences) {
      await tx.playerPointChange.create({
        data: {
          leaguePlayerId: absence.leaguePlayerId,
          roundId: ctx.roundId,
          type: "ABSENT",
          amount: 0,
          description: `Day ${ctx.dayNumber} (${ctx.dayName || "Regular"}) - Round ${ctx.roundNumber} - Absent`,
        },
      });
    }
  }
}
