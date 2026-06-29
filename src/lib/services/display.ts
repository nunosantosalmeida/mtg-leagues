import type { TableResult } from "@/lib/types";

export interface BadgeInfo {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

export class DisplayService {
  static getPlayerBadge(result: TableResult): BadgeInfo | null {
    switch (result) {
      case "WIN": return { label: "WIN", variant: "default" };
      case "DRAW": return { label: "DRAW", variant: "secondary" };
      case "LOSS": return null;
      case "PENDING": return null;
    }
  }

  static getTableBadge(players: { result: string }[]): BadgeInfo | null {
    const hasWin = players.some((p) => p.result === "WIN");
    if (hasWin) return null;

    const hasDraw = players.some((p) => p.result === "DRAW");
    if (hasDraw) return { label: "DRAW", variant: "secondary" };

    return null;
  }

  static formatPointChange(
    pointsChange: number,
    isPlayoff: boolean,
    isCompetitive: boolean,
  ): string | null {
    if (isPlayoff || isCompetitive) return null;
    const rounded = Math.round(pointsChange);
    return `${rounded >= 0 ? "+" : ""}${rounded}`;
  }

  static formatAbsencePenalty(amount: number): string {
    return `(${Math.round(amount)})`;
  }
}
