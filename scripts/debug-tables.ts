import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const LEAGUE_ID = "cmqzx91a90000a0wdz98h94ct";
const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const days = await prisma.leagueDay.findMany({
    where: { leagueId: LEAGUE_ID },
    include: {
      rounds: {
        include: {
          tables: {
            include: {
              players: {
                include: { leaguePlayer: { include: { user: { select: { name: true } } } } },
              },
            },
            orderBy: { tableNumber: "asc" },
          },
        },
        orderBy: { roundNumber: "asc" },
      },
    },
    orderBy: { dayNumber: "asc" },
  });

  for (const day of days) {
    console.log(`\nDay ${day.dayNumber} (${day.type}) - Status: ${day.status}`);
    for (const round of day.rounds) {
      console.log(`  Round ${round.roundNumber} (${round.name || "unnamed"}) - Status: ${round.status}`);
      for (const table of round.tables) {
        const players = table.players.map((p) => `${p.leaguePlayer.user.name}(${p.result})`).join(" vs ");
        console.log(`    Table ${table.tableNumber}: ${players || "(empty)"}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
