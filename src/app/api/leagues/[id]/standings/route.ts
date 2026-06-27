import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const leaguePlayers = await prisma.leaguePlayer.findMany({
      where: { leagueId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tablePlayers: {
          include: {
            table: {
              include: {
                round: true,
              },
            },
          },
        },
        pointChanges: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const standings = leaguePlayers.map((lp) => {
      const results = lp.tablePlayers.filter(
        (tp) => tp.result !== "PENDING"
      );

      const penalties = results.filter((tp) => tp.result === "ABSENT").length;
      const losses = results.filter((tp) => tp.result !== "WIN" && tp.result !== "DRAW" && tp.result !== "ABSENT").length;

      return {
        leaguePlayerId: lp.id,
        userId: lp.user.id,
        userName: lp.user.name,
        userEmail: lp.user.email,
        points: Math.round(lp.points),
        roundsPlayed: results.length,
        wins: results.filter((tp) => tp.result === "WIN").length,
        draws: results.filter((tp) => tp.result === "DRAW").length,
        losses,
        penalties,
        pointHistory: lp.pointChanges.map((pc) => ({
          type: pc.type,
          amount: pc.amount,
          description: pc.description,
          createdAt: pc.createdAt,
        })),
      };
    });

    standings.sort((a, b) => b.points - a.points);

    return NextResponse.json(standings);
  } catch (error) {
    console.error("Error fetching standings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
