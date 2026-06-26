import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type MockParams = { id: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<MockParams> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (admin?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const league = await prisma.league.findUnique({ where: { id } });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const body = await request.json();
    const { count } = body;

    if (!count || typeof count !== "number" || count < 1 || count > 50) {
      return NextResponse.json(
        { error: "Count must be a number between 1 and 50" },
        { status: 400 }
      );
    }

    const existingUsers = await prisma.user.findMany({
      where: { email: { startsWith: "player" } },
      select: { email: true },
    });

    const existingNums = existingUsers.map((u) => {
      const match = u.email.match(/^player(\d+)@/);
      return match ? parseInt(match[1]) : 0;
    });
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    const created = [];

    for (let i = 0; i < count; i++) {
      const num = nextNum + i;
      const name = `Player ${num}`;
      const email = `player${num}@mock.local`;

      const user = await prisma.user.create({
        data: {
          name,
          email,
          role: "PLAYER",
          provider: "credentials",
        },
      });

      const leaguePlayer = await prisma.leaguePlayer.create({
        data: {
          leagueId: id,
          userId: user.id,
        },
      });

      await prisma.playerPointChange.create({
        data: {
          leaguePlayerId: leaguePlayer.id,
          type: "INITIAL",
          amount: 1500,
          description: "Starting points",
        },
      });

      created.push({ id: user.id, name, email });
    }

    return NextResponse.json({ created, count: created.length }, { status: 201 });
  } catch (error) {
    console.error("Error creating mock players:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
