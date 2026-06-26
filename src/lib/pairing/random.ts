export function assignRandomTables(
  playerIds: string[],
  preferredTableSize: number = 4
): string[][] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

  if (preferredTableSize === 4) {
    return assignCommander(shuffled);
  }

  return assign1v1(shuffled);
}

function assignCommander(shuffled: string[]): string[][] {
  const n = shuffled.length;

  if (n < 3) return [];

  if (n <= 5) return [shuffled];

  const tables: string[][] = [];
  let remaining = n;
  let i = 0;

  while (remaining > 0) {
    if (remaining === 4 || remaining % 4 === 0) break;
    if (remaining < 3) break;

    tables.push(shuffled.slice(i, i + 3));
    i += 3;
    remaining -= 3;
  }

  while (remaining >= 4) {
    tables.push(shuffled.slice(i, i + 4));
    i += 4;
    remaining -= 4;
  }

  if (remaining > 0 && tables.length > 0) {
    tables[tables.length - 1].push(...shuffled.slice(i));
  }

  return tables;
}

function assign1v1(shuffled: string[]): string[][] {
  const tables: string[][] = [];

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    tables.push([shuffled[i], shuffled[i + 1]]);
  }

  return tables;
}

export function hasBye(playerIds: string[]): boolean {
  return playerIds.length % 2 !== 0;
}

export function getByePlayerId(playerIds: string[]): string | null {
  if (playerIds.length % 2 === 0) return null;
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  return shuffled[shuffled.length - 1];
}

export function randomizeSeats(playerIds: string[]): { playerId: string; seatPosition: number }[] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  return shuffled.map((playerId, index) => ({
    playerId,
    seatPosition: index + 1,
  }));
}
