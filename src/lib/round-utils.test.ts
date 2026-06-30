import { describe, it, expect } from "vitest";
import {
  isByeTable,
  allResultsRecorded,
  noResultsRecorded,
  resolveByeResult,
  type Table,
} from "./round-utils";

describe("isByeTable", () => {
  it("returns true for a single-player table", () => {
    expect(isByeTable({ players: [{ result: "PENDING", seatPosition: 1 }] })).toBe(true);
  });

  it("returns false for a two-player table", () => {
    expect(isByeTable({
      players: [
        { result: "WIN", seatPosition: 1 },
        { result: "LOSS", seatPosition: 2 },
      ],
    })).toBe(false);
  });

  it("returns false for a three-player table", () => {
    expect(isByeTable({
      players: [
        { result: "WIN", seatPosition: 1 },
        { result: "DRAW", seatPosition: 2 },
        { result: "LOSS", seatPosition: 3 },
      ],
    })).toBe(false);
  });
});

describe("allResultsRecorded", () => {
  it("returns false for empty tables", () => {
    expect(allResultsRecorded([])).toBe(false);
  });

  it("returns true when all regular tables have results", () => {
    const tables: Table[] = [
      { players: [{ result: "WIN", seatPosition: 1 }, { result: "LOSS", seatPosition: 2 }] },
      { players: [{ result: "DRAW", seatPosition: 1 }, { result: "DRAW", seatPosition: 2 }] },
    ];
    expect(allResultsRecorded(tables)).toBe(true);
  });

  it("returns true when a bye table has PENDING result", () => {
    const tables: Table[] = [
      { players: [{ result: "WIN", seatPosition: 1 }, { result: "LOSS", seatPosition: 2 }] },
      { players: [{ result: "PENDING", seatPosition: 1 }] },
    ];
    expect(allResultsRecorded(tables)).toBe(true);
  });

  it("returns false when a regular table has PENDING result", () => {
    const tables: Table[] = [
      { players: [{ result: "WIN", seatPosition: 1 }, { result: "LOSS", seatPosition: 2 }] },
      { players: [{ result: "PENDING", seatPosition: 1 }, { result: "PENDING", seatPosition: 2 }] },
    ];
    expect(allResultsRecorded(tables)).toBe(false);
  });

  it("returns true for only a bye table", () => {
    const tables: Table[] = [
      { players: [{ result: "PENDING", seatPosition: 1 }] },
    ];
    expect(allResultsRecorded(tables)).toBe(true);
  });

  it("returns true when all tables including byes have results", () => {
    const tables: Table[] = [
      { players: [{ result: "WIN", seatPosition: 1 }, { result: "LOSS", seatPosition: 2 }] },
      { players: [{ result: "WIN", seatPosition: 1 }] },
    ];
    expect(allResultsRecorded(tables)).toBe(true);
  });

  it("returns false when mixed pending states exist", () => {
    const tables: Table[] = [
      { players: [{ result: "WIN", seatPosition: 1 }, { result: "PENDING", seatPosition: 2 }] },
      { players: [{ result: "PENDING", seatPosition: 1 }] },
    ];
    expect(allResultsRecorded(tables)).toBe(false);
  });
});

describe("noResultsRecorded", () => {
  it("returns false for empty tables", () => {
    expect(noResultsRecorded([])).toBe(false);
  });

  it("returns true when all tables have PENDING results", () => {
    const tables: Table[] = [
      { players: [{ result: "PENDING", seatPosition: 1 }, { result: "PENDING", seatPosition: 2 }] },
      { players: [{ result: "PENDING", seatPosition: 1 }, { result: "PENDING", seatPosition: 2 }] },
    ];
    expect(noResultsRecorded(tables)).toBe(true);
  });

  it("returns false when any table has a non-PENDING result", () => {
    const tables: Table[] = [
      { players: [{ result: "WIN", seatPosition: 1 }, { result: "LOSS", seatPosition: 2 }] },
      { players: [{ result: "PENDING", seatPosition: 1 }, { result: "PENDING", seatPosition: 2 }] },
    ];
    expect(noResultsRecorded(tables)).toBe(false);
  });

  it("returns true for a bye table with PENDING result", () => {
    const tables: Table[] = [
      { players: [{ result: "PENDING", seatPosition: 1 }] },
    ];
    expect(noResultsRecorded(tables)).toBe(true);
  });
});

describe("reopen round preserves results", () => {
  it("results are preserved after reopen (noResultsRecorded is false)", () => {
    const tablesAfterReopen = [
      { players: [{ result: "WIN", seatPosition: 1 }, { result: "LOSS", seatPosition: 2 }] },
    ];
    expect(allResultsRecorded(tablesAfterReopen)).toBe(true);
    expect(noResultsRecorded(tablesAfterReopen)).toBe(false);
  });

  it("bye table result is preserved after reopen", () => {
    const tablesAfterReopen = [
      { players: [{ result: "WIN", seatPosition: 1 }] },
    ];
    expect(allResultsRecorded(tablesAfterReopen)).toBe(true);
    expect(noResultsRecorded(tablesAfterReopen)).toBe(false);
  });

  it("draw results are preserved after reopen", () => {
    const tablesAfterReopen = [
      { players: [{ result: "DRAW", seatPosition: 1 }, { result: "DRAW", seatPosition: 2 }] },
    ];
    expect(allResultsRecorded(tablesAfterReopen)).toBe(true);
    expect(noResultsRecorded(tablesAfterReopen)).toBe(false);
  });
});

describe("resolveByeResult", () => {
  it("returns WIN with 3 match points for TRADITIONAL", () => {
    const result = resolveByeResult("PENDING", true);
    expect(result).toEqual({ result: "WIN", matchPoints: 3 });
  });

  it("returns WIN with 0 match points for POINTS", () => {
    const result = resolveByeResult("PENDING", false);
    expect(result).toEqual({ result: "WIN", matchPoints: 0 });
  });
});
