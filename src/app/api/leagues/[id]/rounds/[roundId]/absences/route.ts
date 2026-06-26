import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type AbsenceParams = { id: string; roundId: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<AbsenceParams> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, roundId } = await params;
    const league = await prisma.league.findUnique({ where: { id } });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.createdBy !== session.user.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (user?.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { tables: { include: { players: true } } },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    if (round.status !== "PLANNED" && round.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Can only set absences for planned or in-progress rounds" },
        { status: 400 }
      );
    }

    const hasResults = round.tables.some((t) =>
      t.players.some((p) => p.result !== "PENDING")
    );
    if (hasResults) {
      return NextResponse.json(
        { error: "Cannot change absences after results have been recorded" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { absentPlayerIds } = body;

    if (!Array.isArray(absentPlayerIds)) {
      return NextResponse.json(
        { error: "absentPlayerIds must be an array" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.roundAbsence.deleteMany({ where: { roundId } });

      if (absentPlayerIds.length > 0) {
        await tx.roundAbsence.createMany({
          data: absentPlayerIds.map((leaguePlayerId: string) => ({
            roundId,
            leaguePlayerId,
          })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting absences:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
