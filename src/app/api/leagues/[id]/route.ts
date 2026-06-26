import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateLeagueSchema } from "@/lib/validations/league";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        days: {
          include: {
            rounds: {
              include: {
                absences: {
                  select: { leaguePlayerId: true },
                },
                tables: {
                  include: {
                    players: {
                      include: {
                        leaguePlayer: {
                          include: {
                            user: { select: { id: true, name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { dayNumber: "asc" },
        },
        creator: { select: { name: true, email: true } },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    return NextResponse.json(league);
  } catch (error) {
    console.error("Error fetching league:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

    const body = await request.json();
    const validated = updateLeagueSchema.parse(body);

    const updated = await prisma.league.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.message }, { status: 400 });
    }
    console.error("Error updating league:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const league = await prisma.league.findUnique({ where: { id } });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const leaguePlayerIds = (await tx.leaguePlayer.findMany({ where: { leagueId: id }, select: { id: true } })).map(lp => lp.id);
      await tx.playerPointChange.deleteMany({ where: { leaguePlayerId: { in: leaguePlayerIds } } });
      const days = await tx.leagueDay.findMany({ where: { leagueId: id }, select: { id: true } });
      for (const day of days) {
        const rounds = await tx.round.findMany({ where: { leagueDayId: day.id }, select: { id: true } });
        for (const round of rounds) {
          await tx.tablePlayer.deleteMany({ where: { table: { roundId: round.id } } });
          await tx.table.deleteMany({ where: { roundId: round.id } });
          await tx.roundAbsence.deleteMany({ where: { roundId: round.id } });
        }
        await tx.round.deleteMany({ where: { leagueDayId: day.id } });
      }
      await tx.leagueDay.deleteMany({ where: { leagueId: id } });
      await tx.leaguePlayer.deleteMany({ where: { leagueId: id } });
      await tx.league.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting league:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
