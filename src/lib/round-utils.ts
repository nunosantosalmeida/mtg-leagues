export interface TablePlayer {
  result: string;
  seatPosition: number;
}

export interface Table {
  players: TablePlayer[];
}

export function isByeTable(table: Table): boolean {
  return table.players.length === 1;
}

export function allResultsRecorded(tables: Table[]): boolean {
  if (tables.length === 0) return false;
  return tables.every((table) =>
    isByeTable(table) || table.players.every((p) => p.result !== "PENDING")
  );
}

export function noResultsRecorded(tables: Table[]): boolean {
  if (tables.length === 0) return false;
  return tables.every((table) =>
    table.players.every((p) => p.result === "PENDING")
  );
}

export function resolveByeResult(
  result: string,
  isTraditional: boolean,
): { result: string; matchPoints: number } {
  if (!isTraditional) {
    return { result: "WIN", matchPoints: 0 };
  }
  return { result: "WIN", matchPoints: 3 };
}

export interface RoundStatus {
  id: string;
  status: string;
}

export function getDefaultExpandedRounds(rounds: RoundStatus[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (rounds.length === 0) return result;

  const inProgress = rounds.find((r) => r.status === "IN_PROGRESS");
  const allCompleted = rounds.every((r) => r.status === "COMPLETED");

  for (const round of rounds) {
    if (inProgress) {
      result[round.id] = round.id === inProgress.id;
    } else if (allCompleted) {
      result[round.id] = false;
    } else {
      result[round.id] = round.id === rounds[0].id;
    }
  }
  return result;
}
