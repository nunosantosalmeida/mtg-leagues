import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const leaguePlayers = await prisma.leaguePlayer.findMany({
      where: { userId: session.user.id },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            format: true,
            status: true,
          },
        },
        tablePlayers: {
          where: { result: { not: "PENDING" } },
        },
        pointChanges: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    const stats = {
      totalLeagues: leaguePlayers.length,
      activeLeagues: leaguePlayers.filter((lp) => lp.league.status === "IN_PROGRESS").length,
      completedLeagues: leaguePlayers.filter((lp) => lp.league.status === "COMPLETED").length,
      totalGames: leaguePlayers.reduce((sum, lp) => sum + lp.tablePlayers.length, 0),
      totalWins: leaguePlayers.reduce(
        (sum, lp) => sum + lp.tablePlayers.filter((tp) => tp.result === "WIN").length,
        0
      ),
      totalDraws: leaguePlayers.reduce(
        (sum, lp) => sum + lp.tablePlayers.filter((tp) => tp.result === "DRAW").length,
        0
      ),
    };

    const leagues = leaguePlayers.map((lp) => ({
      id: lp.league.id,
      name: lp.league.name,
      format: lp.league.format,
      status: lp.league.status,
      points: Math.round(lp.points),
      gamesPlayed: lp.tablePlayers.length,
      wins: lp.tablePlayers.filter((tp) => tp.result === "WIN").length,
      draws: lp.tablePlayers.filter((tp) => tp.result === "DRAW").length,
      recentChanges: lp.pointChanges.map((pc) => ({
        type: pc.type,
        amount: pc.amount,
        description: pc.description,
        createdAt: pc.createdAt,
      })),
    }));

    return NextResponse.json({ user, stats, leagues });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
