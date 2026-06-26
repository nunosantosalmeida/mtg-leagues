import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const league = await prisma.league.findUnique({
    where: { id: "cmqtz7bbi0000uswdywtlsntz" },
    include: {
      days: { orderBy: { dayNumber: "asc" } },
      players: { include: { user: { select: { name: true } } } },
    },
  });

  if (!league) {
    console.log("League not found");
    return;
  }

  console.log("League:", league.name, "Format:", league.format, "Status:", league.status);
  console.log("Players:", league.players.length);
  for (const d of league.days) {
    console.log("  Day", d.dayNumber, "Type:", d.type, "Status:", d.status);
  }

  const hasPlayoff = league.days.some((d) => d.type === "PLAYOFF");
  console.log("Has playoff:", hasPlayoff);

  const regularDays = league.days.filter((d) => d.type === "REGULAR");
  const allRegularClosed = regularDays.length > 0 && regularDays.every((d) => d.status === "COMPLETED");
  console.log("All regular days closed:", allRegularClosed);

  if (allRegularClosed && !hasPlayoff) {
    console.log("\nGenerating playoff...");

    const topCut = league.format === "COMMANDER" ? 4 : 8;
    console.log("Top cut:", topCut);

    const players = await prisma.leaguePlayer.findMany({
      where: { leagueId: league.id, isActive: true },
      include: {
        user: { select: { name: true } },
        pointChanges: {
          include: { round: { include: { leagueDay: true } } },
        },
      },
    });

    const standings = players.map((p) => {
      const regularChanges = p.pointChanges.filter(
        (pc) => pc.round?.leagueDay?.type === "REGULAR"
      );
      let wins = 0;
      let losses = 0;
      let draws = 0;
      for (const change of regularChanges) {
        if (change.type === "WIN") wins++;
        else if (change.type === "ABSENT" || change.type === "NO_SHOW") losses++;
        else if (change.type === "DRAW") draws++;
      }
      return {
        id: p.id,
        name: p.user.name,
        points: p.points,
        wins,
        losses,
        draws,
      };
    }).sort((a, b) => b.wins - a.wins || a.losses - b.losses);

    console.log("\nStandings:");
    standings.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} - ${s.wins}W/${s.losses}L/${s.draws}D (${s.points} pts)`);
    });

    console.log("\nDone. Please generate the playoff from the league detail page in the browser.");
  } else {
    console.log("\nPlayoff conditions not met.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
