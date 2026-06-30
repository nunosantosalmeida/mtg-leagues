"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface League {
  id: string;
  name: string;
  description: string | null;
  format: string;
  bestOf: number;
  status: string;
  hasFinalPhase: boolean;
  createdAt: string;
  _count: { players: number };
  creator: { name: string };
  days: {
    rounds: {
      tables: {
        players: {
          result: string | null;
          leaguePlayer: {
            user: { name: string };
          };
        }[];
      }[];
    }[];
  }[];
  players: {
    points: number;
    user: { name: string };
  }[];
}

const statusColors: Record<string, string> = {
  REGISTRATION: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  TOP4: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

function getWinnerName(league: League): string | null {
  if (league.status !== "COMPLETED") return null;

  for (const day of league.days) {
    for (const round of day.rounds) {
      for (const table of round.tables) {
        for (const tp of table.players) {
          if (tp.result === "WIN" && tp.leaguePlayer?.user?.name) {
            return tp.leaguePlayer.user.name;
          }
        }
      }
    }
  }

  if (league.players && league.players.length > 0) {
    const sorted = [...league.players].sort((a, b) => b.points - a.points);
    return sorted[0]?.user?.name ?? null;
  }

  return null;
}

export function LeagueList() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leagues")
      .then((res) => res.json())
      .then((data) => {
        setLeagues(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading leagues...</div>;
  }

  if (leagues.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No leagues yet</p>
        {isAdmin && (
          <Link href="/leagues/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
            Create First League
          </Link>
        )}
      </div>
    );
  }

  const activeLeagues = leagues.filter((l) => l.status !== "COMPLETED");
  const completedLeagues = leagues.filter((l) => l.status === "COMPLETED");

  return (
    <div className="space-y-8">
      {activeLeagues.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeLeagues.map((league) => (
            <Card key={league.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{league.name}</CardTitle>
                  <Badge variant="outline" className={statusColors[league.status]}>
                    {league.status.replace("_", " ")}
                  </Badge>
                </div>
                <CardDescription>
                  {league.format} • Best of {league.bestOf}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{league._count.players} players</p>
                  <p>Created by {league.creator.name}</p>
                  {league.description && <p className="line-clamp-2">{league.description}</p>}
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/leagues/${league.id}`} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5 w-full">
                  View League
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {completedLeagues.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</span>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-2">
            {completedLeagues.map((league) => {
              const winner = getWinnerName(league);
              return (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={`${statusColors[league.status]} shrink-0`}>
                      {league.status.replace("_", " ")}
                    </Badge>
                    <div className="min-w-0">
                      <div className="font-medium text-sm group-hover:text-foreground truncate">
                        {league.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {league.format} &middot; {league._count.players} players &middot; by {league.creator.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {winner && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <span>🏆</span>
                        <span>{winner}</span>
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">View</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
