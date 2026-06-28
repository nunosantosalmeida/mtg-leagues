"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface LeagueNavProps {
  leagueId: string;
  active?: "overview" | "standings" | "schedule" | "bracket";
  rightSlot?: ReactNode;
}

export function LeagueNav({ leagueId, active, rightSlot }: LeagueNavProps) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <Link
        href={`/leagues/${leagueId}`}
        className={`inline-flex items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5 ${
          active === "overview"
            ? "bg-primary text-primary-foreground hover:bg-primary/80"
            : "border-border bg-background hover:bg-muted hover:text-foreground"
        }`}
      >
        Overview
      </Link>
      <Link
        href={`/leagues/${leagueId}/standings`}
        className={`inline-flex items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5 ${
          active === "standings"
            ? "bg-primary text-primary-foreground hover:bg-primary/80"
            : "border-border bg-background hover:bg-muted hover:text-foreground"
        }`}
      >
        Standings
      </Link>
      <Link
        href={`/leagues/${leagueId}/days`}
        className={`inline-flex items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5 ${
          active === "schedule"
            ? "bg-primary text-primary-foreground hover:bg-primary/80"
            : "border-border bg-background hover:bg-muted hover:text-foreground"
        }`}
      >
        Schedule
      </Link>
      <Link
        href={`/leagues/${leagueId}/bracket`}
        className={`inline-flex items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5 ${
          active === "bracket"
            ? "bg-primary text-primary-foreground hover:bg-primary/80"
            : "border-border bg-background hover:bg-muted hover:text-foreground"
        }`}
      >
        Bracket
      </Link>
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}
