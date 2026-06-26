import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const playoff = await prisma.leagueDay.findFirst({ where: { type: "PLAYOFF" } });
  if (playoff) {
    await prisma.tablePlayer.deleteMany({ where: { table: { round: { leagueDayId: playoff.id } } } });
    await prisma.table.deleteMany({ where: { round: { leagueDayId: playoff.id } } });
    await prisma.roundAbsence.deleteMany({ where: { round: { leagueDayId: playoff.id } } });
    await prisma.round.deleteMany({ where: { leagueDayId: playoff.id } });
    await prisma.leagueDay.delete({ where: { id: playoff.id } });
    console.log("Deleted old playoff day:", playoff.id);
  } else {
    console.log("No playoff day found");
  }
  await prisma.$disconnect();
}
main();
