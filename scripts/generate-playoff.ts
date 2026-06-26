import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { generateBracket, getSeedsFromStandings, getCommanderTopCut } from "../src/lib/playoff/bracket";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const leagueId = "cmqtz7bbi0000uswdywtlsntz";

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      days: { orderBy: { dayNumber: "asc" } },
      players: { include: { user: { select: { name: true } } } },
    },
  });

  if (!league) { console.log("League not found"); return; }

  console.log("League:", league.name, "Format:", league.format);

  const existingPlayoff = await prisma.leagueDay.findFirst({
    where: { leagueId, type: "PLAYOFF" },
  });
  if (existingPlayoff) {
    console.log("Playoff already exists, skipping.");
    return;
  }

  const players = await prisma.leaguePlayer.findMany({
    where: { leagueId, isActive: true },
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
    let wins = 0, losses = 0, draws = 0;
    for (const c of regularChanges) {
      if (c.type === "WIN") wins++;
      else if (c.type === "ABSENT" || c.type === "NO_SHOW") losses++;
      else if (c.type === "DRAW") draws++;
    }
    const matchesPlayed = wins + losses + draws;
    return {
      leaguePlayerId: p.id,
      playerName: p.user.name,
      points: p.points,
      wins, losses, draws,
      matchesPlayed,
      opponentMatchWinPercentage: 0.5,
      gameWinPercentage: matchesPlayed > 0 ? wins / matchesPlayed : 0,
    };
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses || b.gameWinPercentage - a.gameWinPercentage);

  console.log("\nStandings:");
  standings.forEach((s, i) => console.log(`  ${i + 1}. ${s.playerName} - ${s.wins}W/${s.losses}L/${s.draws}D (${s.points} pts)`));

  const topCut = league.format === "COMMANDER"
    ? getCommanderTopCut(standings.length)
    : Math.min(8, standings.length);

  console.log(`\nTop cut: ${topCut}`);

  const qualified = standings.slice(0, topCut);
  const seeds = getSeedsFromStandings(qualified);
  const bracket = generateBracket(seeds, topCut, league.format);

  console.log("\nSeeds:");
  seeds.forEach((s) => console.log(`  #${s.seed} ${s.playerName}`));

  if (bracket.pods.length > 0) {
    console.log("\nSemifinal Pods:");
    for (const pod of bracket.pods) {
      console.log(`  Pod ${pod.podNumber}: ${pod.players.map((p) => `#${p.seed} ${p.playerName}`).join(", ")}`);
    }
  }
  if (bracket.byes.length > 0) {
    console.log("\nByes to Finals:");
    bracket.byes.forEach((b) => console.log(`  #${b.seed} ${b.playerName}`));
  }
  if (bracket.matches.length > 0) {
    console.log("\nBracket Matches:");
    bracket.matches.forEach((m) => console.log(`  R${m.round} M${m.matchNumber}: #${m.seed1} ${m.playerName1} vs #${m.seed2} ${m.playerName2}`));
  }

  const lastRegularDay = await prisma.leagueDay.findFirst({
    where: { leagueId, type: "REGULAR" },
    orderBy: { dayNumber: "desc" },
  });

  const playoffDate = new Date();
  if (lastRegularDay) {
    playoffDate.setTime(lastRegularDay.date.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const playoffDay = await prisma.leagueDay.create({
    data: {
      leagueId,
      dayNumber: (lastRegularDay?.dayNumber ?? 0) + 1,
      date: playoffDate,
      status: "PLANNED",
      type: "PLAYOFF",
      name: `Top ${topCut}`,
    },
  });

  const maxRound = await prisma.round.aggregate({
    where: { leagueDay: { leagueId } },
    _max: { roundNumber: true },
  });
  let nextRoundNumber = (maxRound._max.roundNumber ?? 0) + 1;

  if (league.format === "COMMANDER") {
    const hasSemifinals = bracket.pods.length > 0;

    if (hasSemifinals) {
      const semisRound = await prisma.round.create({
        data: {
          leagueDayId: playoffDay.id,
          roundNumber: nextRoundNumber,
          status: "PLANNED",
          name: "Semifinals",
        },
      });

      for (const pod of bracket.pods) {
        const table = await prisma.table.create({
          data: { roundId: semisRound.id, tableNumber: pod.podNumber },
        });
        await prisma.tablePlayer.createMany({
          data: pod.players.map((p, i) => ({
            tableId: table.id,
            leaguePlayerId: p.leaguePlayerId,
            seatPosition: i + 1,
            pointsWagered: 0,
          })),
        });
      }

      nextRoundNumber++;
    }

    const finalsRound = await prisma.round.create({
      data: {
        leagueDayId: playoffDay.id,
        roundNumber: nextRoundNumber,
        status: "PLANNED",
        name: "Finals",
      },
    });
    const finalsTable = await prisma.table.create({
      data: { roundId: finalsRound.id, tableNumber: 1 },
    });
    await prisma.tablePlayer.createMany({
      data: bracket.byes.map((p, i) => ({
        tableId: finalsTable.id,
        leaguePlayerId: p.leaguePlayerId,
        seatPosition: i + 1,
        pointsWagered: 0,
      })),
    });
  } else {
    const totalRounds = bracket.totalRounds;
    const roundsMap: Record<number, string> = {};

    for (let r = 0; r < totalRounds; r++) {
      const roundsFromEnd = totalRounds - 1 - r;
      const roundName = roundsFromEnd === 0 ? "Final"
        : roundsFromEnd === 1 ? "Semifinals"
        : roundsFromEnd === 2 ? "Quarterfinals"
        : `Round of ${Math.pow(2, roundsFromEnd + 1)}`;
      const round = await prisma.round.create({
        data: { leagueDayId: playoffDay.id, roundNumber: nextRoundNumber + r, status: "PLANNED", name: roundName },
      });
      roundsMap[r] = round.id;
    }

    for (const match of bracket.matches) {
      const table = await prisma.table.create({
        data: { roundId: roundsMap[match.round - 1], tableNumber: match.matchNumber },
      });

      if (match.leaguePlayerId1 && match.leaguePlayerId2) {
        await prisma.tablePlayer.createMany({
          data: [
            { tableId: table.id, leaguePlayerId: match.leaguePlayerId1, seatPosition: 1, pointsWagered: 0 },
            { tableId: table.id, leaguePlayerId: match.leaguePlayerId2, seatPosition: 2, pointsWagered: 0 },
          ],
        });
      }
    }
  }

  console.log(`\nPlayoff created! Day ${playoffDay.dayNumber} (${playoffDay.id})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
