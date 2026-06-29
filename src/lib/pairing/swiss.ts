export interface SwissPlayer {
  id: string;
  matchPoints: number;
}

export interface SwissPair {
  player1Id: string;
  player2Id: string;
}

export interface SwissResult {
  pairs: SwissPair[];
  byePlayerId: string | null;
}

function getMatchupsKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function assignSwissPairings(
  players: SwissPlayer[],
  previousMatchups: Set<string>,
  previousByes: Set<string>,
  roundNumber: number,
): SwissResult {
  if (players.length < 2) {
    return { pairs: [], byePlayerId: players[0]?.id ?? null };
  }

  if (roundNumber <= 1) {
    return assignRandomSwiss(players, previousByes);
  }

  const sorted = [...players].sort((a, b) => b.matchPoints - a.matchPoints);

  let byePlayerId: string | null = null;
  if (sorted.length % 2 !== 0) {
    byePlayerId = findByeCandidate(sorted, previousByes);
  }

  const available = sorted.filter((p) => p.id !== byePlayerId);
  const pairs: SwissPair[] = [];
  const paired = new Set<string>();

  const attempts = tryPair(available, previousMatchups, paired, pairs, 0);

  if (!attempts) {
    return assignRandomSwiss(players, previousByes);
  }

  return { pairs, byePlayerId };
}

function tryPair(
  pool: SwissPlayer[],
  previousMatchups: Set<string>,
  paired: Set<string>,
  pairs: SwissPair[],
  depth: number,
): boolean {
  if (paired.size === pool.length) return true;
  if (depth > pool.length) return false;

  const nextUnpaired = pool.find((p) => !paired.has(p.id));
  if (!nextUnpaired) return true;

  const candidates = pool.filter((p) => {
    if (p.id === nextUnpaired.id) return false;
    if (paired.has(p.id)) return false;
    const key = getMatchupsKey(nextUnpaired.id, p.id);
    if (previousMatchups.has(key)) return false;
    return true;
  });

  if (candidates.length === 0) return false;

  const nextRank = pool.indexOf(nextUnpaired);
  candidates.sort((a, b) => {
    const rankDiffA = Math.abs(pool.indexOf(a) - nextRank);
    const rankDiffB = Math.abs(pool.indexOf(b) - nextRank);
    return rankDiffA - rankDiffB;
  });

  for (const candidate of candidates) {
    paired.add(nextUnpaired.id);
    paired.add(candidate.id);
    pairs.push({ player1Id: nextUnpaired.id, player2Id: candidate.id });

    if (tryPair(pool, previousMatchups, paired, pairs, depth + 1)) {
      return true;
    }

    paired.delete(nextUnpaired.id);
    paired.delete(candidate.id);
    pairs.pop();
  }

  return false;
}

function assignRandomSwiss(
  players: SwissPlayer[],
  previousByes: Set<string>,
): SwissResult {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const pairs: SwissPair[] = [];
  const paired = new Set<string>();

  let byePlayerId: string | null = null;
  if (shuffled.length % 2 !== 0) {
    byePlayerId = findByeCandidate(shuffled, previousByes);
  }

  const available = shuffled.filter((p) => p.id !== byePlayerId);

  for (let i = 0; i < available.length; i += 2) {
    pairs.push({
      player1Id: available[i].id,
      player2Id: available[i + 1].id,
    });
    paired.add(available[i].id);
    paired.add(available[i + 1].id);
  }

  return { pairs, byePlayerId };
}

function findByeCandidate(
  sorted: SwissPlayer[],
  previousByes: Set<string>,
): string | null {
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!previousByes.has(sorted[i].id)) {
      return sorted[i].id;
    }
  }
  return sorted[sorted.length - 1].id;
}
