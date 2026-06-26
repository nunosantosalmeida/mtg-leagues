export interface BracketSeed {
  seed: number;
  leaguePlayerId: string;
  playerName: string;
  points: number;
}

export interface BracketMatch {
  round: number;
  matchNumber: number;
  seed1: number;
  seed2: number;
  leaguePlayerId1: string | null;
  leaguePlayerId2: string | null;
  playerName1: string | null;
  playerName2: string | null;
}

export interface PodAssignment {
  podNumber: number;
  players: { seed: number; leaguePlayerId: string; playerName: string }[];
}

export interface PlayoffBracket {
  matches: BracketMatch[];
  pods: PodAssignment[];
  byes: { seed: number; leaguePlayerId: string; playerName: string }[];
  totalRounds: number;
}

function generateSeededBracket1v1(topCut: number): { round: number; matchNumber: number; seed1: number; seed2: number }[] {
  if (topCut === 4) {
    return [
      { round: 1, matchNumber: 1, seed1: 1, seed2: 4 },
      { round: 1, matchNumber: 2, seed1: 2, seed2: 3 },
      { round: 2, matchNumber: 1, seed1: 0, seed2: 0 },
    ];
  }

  if (topCut === 8) {
    return [
      { round: 1, matchNumber: 1, seed1: 1, seed2: 8 },
      { round: 1, matchNumber: 2, seed1: 4, seed2: 5 },
      { round: 1, matchNumber: 3, seed1: 2, seed2: 7 },
      { round: 1, matchNumber: 4, seed1: 3, seed2: 6 },
      { round: 2, matchNumber: 1, seed1: 0, seed2: 0 },
      { round: 2, matchNumber: 2, seed1: 0, seed2: 0 },
      { round: 3, matchNumber: 1, seed1: 0, seed2: 0 },
    ];
  }

  const matches: { round: number; matchNumber: number; seed1: number; seed2: number }[] = [];
  const totalRounds = Math.log2(topCut);

  const firstRoundMatches: { seed1: number; seed2: number }[] = [];
  for (let i = 0; i < topCut / 2; i++) {
    const topSeed = i + 1;
    const bottomSeed = topCut - i;
    firstRoundMatches.push({ seed1: topSeed, seed2: bottomSeed });
  }

  let matchNum = 1;
  for (const m of firstRoundMatches) {
    matches.push({ round: 1, matchNumber: matchNum++, seed1: m.seed1, seed2: m.seed2 });
  }

  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = topCut / Math.pow(2, round);
    for (let m = 1; m <= matchesInRound; m++) {
      matches.push({ round, matchNumber: m, seed1: 0, seed2: 0 });
    }
  }

  return matches;
}

export function getCommanderTopCut(playerCount: number): number {
  if (playerCount <= 5) return 0;
  if (playerCount <= 16) return 4;
  if (playerCount <= 24) return 7;
  if (playerCount <= 32) return 10;
  if (playerCount <= 40) return 13;
  if (playerCount <= 64) return 16;
  if (playerCount <= 128) return 16;
  if (playerCount <= 256) return 40;
  if (playerCount <= 512) return 40;
  return 64;
}

function generateCommanderPlayoff(seeds: BracketSeed[], topCut: number): PlayoffBracket {
  if (topCut <= 4) {
    return {
      matches: [],
      pods: [],
      byes: seeds.map((s) => ({ seed: s.seed, leaguePlayerId: s.leaguePlayerId, playerName: s.playerName })),
      totalRounds: 1,
    };
  }

  const numSemifinalPods = Math.ceil((topCut - 4) / 3);
  const numByes = topCut - numSemifinalPods * 4;

  const byeSeeds = seeds.filter((s) => s.seed <= numByes);
  const semifinalSeeds = seeds.filter((s) => s.seed > numByes);

  const pods: PodAssignment[] = [];
  for (let p = 0; p < numSemifinalPods; p++) {
    pods.push({ podNumber: p + 1, players: [] });
  }

  for (let i = 0; i < semifinalSeeds.length; i++) {
    const podIndex = i % numSemifinalPods;
    const roundInPod = Math.floor(i / numSemifinalPods);
    const isReversed = roundInPod % 2 === 1;
    const actualPodIndex = isReversed ? (numSemifinalPods - 1 - podIndex) : podIndex;
    pods[actualPodIndex].players.push({
      seed: semifinalSeeds[i].seed,
      leaguePlayerId: semifinalSeeds[i].leaguePlayerId,
      playerName: semifinalSeeds[i].playerName,
    });
  }

  const matches: BracketMatch[] = [];
  for (const pod of pods) {
    for (let i = 0; i < pod.players.length; i++) {
      for (let j = i + 1; j < pod.players.length; j++) {
        matches.push({
          round: 1,
          matchNumber: pods.indexOf(pod) * 10 + matches.length + 1,
          seed1: pod.players[i].seed,
          seed2: pod.players[j].seed,
          leaguePlayerId1: pod.players[i].leaguePlayerId,
          leaguePlayerId2: pod.players[j].leaguePlayerId,
          playerName1: pod.players[i].playerName,
          playerName2: pod.players[j].playerName,
        });
      }
    }
  }

  return {
    matches,
    pods,
    byes: byeSeeds,
    totalRounds: 2,
  };
}

export function generateBracket(
  seeds: BracketSeed[],
  topCut: number,
  format: string
): PlayoffBracket {
  if (seeds.length < 2) {
    throw new Error("Need at least 2 players for a bracket");
  }

  if (seeds.length > topCut) {
    throw new Error("More players than top cut size");
  }

  if (format === "COMMANDER") {
    return generateCommanderPlayoff(seeds, topCut);
  }

  const bracketTemplate = generateSeededBracket1v1(topCut);
  const seedMap = new Map(seeds.map((s) => [s.seed, s]));

  const matches = bracketTemplate.map((template) => {
    const s1 = template.seed1 > 0 ? seedMap.get(template.seed1) ?? null : null;
    const s2 = template.seed2 > 0 ? seedMap.get(template.seed2) ?? null : null;

    return {
      round: template.round,
      matchNumber: template.matchNumber,
      seed1: template.seed1,
      seed2: template.seed2,
      leaguePlayerId1: s1?.leaguePlayerId ?? null,
      leaguePlayerId2: s2?.leaguePlayerId ?? null,
      playerName1: s1?.playerName ?? null,
      playerName2: s2?.playerName ?? null,
    };
  });

  const totalRounds = Math.log2(topCut);
  return { matches, pods: [], byes: [], totalRounds };
}

export function getSeedsFromStandings(
  players: { leaguePlayerId: string; playerName: string; points: number; wins: number; losses: number; draws: number; opponentMatchWinPercentage: number; gameWinPercentage: number }[]
): BracketSeed[] {
  return [...players]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.gameWinPercentage - a.gameWinPercentage;
    })
    .map((p, index) => ({
      seed: index + 1,
      leaguePlayerId: p.leaguePlayerId,
      playerName: p.playerName,
      points: p.points,
    }));
}
