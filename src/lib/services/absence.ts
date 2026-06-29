import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

export class AbsenceService {
  static async saveAbsences(
    tx: TxClient,
    roundId: string,
    absentPlayerIds: string[],
  ): Promise<void> {
    await tx.roundAbsence.deleteMany({ where: { roundId } });

    if (absentPlayerIds.length > 0) {
      await tx.roundAbsence.createMany({
        data: absentPlayerIds.map((leaguePlayerId) => ({
          roundId,
          leaguePlayerId,
        })),
      });
    }
  }
}
