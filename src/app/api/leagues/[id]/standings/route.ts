import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { StandingsService } from "@/lib/services/standings";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const standings = await StandingsService.getStandings(id);
    return NextResponse.json(standings);
  } catch (error) {
    console.error("Error fetching standings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
