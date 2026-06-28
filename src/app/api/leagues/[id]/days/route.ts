import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
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

    const existingDays = await prisma.leagueDay.findMany({
      where: { leagueId: id },
    });

    if (existingDays.length > 0) {
      return NextResponse.json(
        { error: "Days already created for this league" },
        { status: 400 }
      );
    }

    const days = [];
    const today = new Date();
    const startDate = new Date(today);
    const currentDayOfWeek = today.getDay();
    let daysUntilTarget = league.weekday - currentDayOfWeek;
    if (daysUntilTarget <= 0) daysUntilTarget += 7;
    startDate.setDate(today.getDate() + daysUntilTarget);

    let roundCounter = 1;

    for (let i = 1; i <= league.totalDays; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + (i - 1) * 7);

      const day = await prisma.leagueDay.create({
        data: {
          leagueId: id,
          dayNumber: i,
          date: dayDate,
          status: "PLANNED",
          type: "REGULAR",
        },
      });

      const roundsData = [];
      for (let r = 0; r < league.roundsPerDay; r++) {
        roundsData.push({
          leagueDayId: day.id,
          roundNumber: roundCounter + r,
          status: "PLANNED" as const,
        });
      }

      await prisma.round.createMany({ data: roundsData });

      roundCounter += league.roundsPerDay;
      days.push(day);
    }

    await prisma.league.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json(days, { status: 201 });
  } catch (error) {
    console.error("Error creating days:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
