"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface League {
  id: string;
  name: string;
  format: string;
  status: string;
  _count: { players: number };
}

const statusColors: Record<string, string> = {
  REGISTRATION: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  TOP4: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function HomePage() {
  const { data: session, status } = useSession();
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

  const activeLeagues = leagues.filter((l) => l.status === "IN_PROGRESS");
  const registrationLeagues = leagues.filter((l) => l.status === "REGISTRATION");

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-3">
          MTG Leagues
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Track your Magic: The Gathering league standings, results, and rankings
        </p>
      </div>

      {!session && status !== "loading" && (
        <Card className="mb-10 border-dashed">
          <CardContent className="pt-8 pb-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-muted-foreground mb-5 text-sm">
              Sign in to join leagues and track your progress
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md bg-foreground text-background hover:bg-foreground/90 text-sm font-medium h-9 px-4 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-sm font-medium h-9 px-4 transition-colors"
              >
                Register
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-10">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Leagues</CardTitle>
              <Link
                href="/leagues"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : activeLeagues.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No active leagues</p>
                <Link
                  href="/leagues"
                  className="text-sm text-foreground hover:underline font-medium"
                >
                  Browse Leagues
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activeLeagues.slice(0, 5).map((league) => (
                  <Link
                    key={league.id}
                    href={`/leagues/${league.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div>
                      <div className="font-medium text-sm group-hover:text-foreground">
                        {league.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {league.format} &middot; {league._count.players} players
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {league._count.players} players
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Open for Registration</CardTitle>
              <Link
                href="/leagues"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : registrationLeagues.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">
                  No leagues accepting registrations
                </p>
                {(session?.user as any)?.role === "ADMIN" && (
                  <Link
                    href="/leagues/new"
                    className="text-sm text-foreground hover:underline font-medium"
                  >
                    Create League
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {registrationLeagues.slice(0, 5).map((league) => (
                  <Link
                    key={league.id}
                    href={`/leagues/${league.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div>
                      <div className="font-medium text-sm group-hover:text-foreground">
                        {league.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {league.format} &middot; {league._count.players} players
                      </div>
                    </div>
                    <span className="text-xs font-medium text-green-600">Open</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-center">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold mb-3">
                1
              </div>
              <h3 className="font-medium text-sm mb-1">Create or Join</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Join leagues during registration period, or check with an admin if you can
                still join after it started
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold mb-3">
                2
              </div>
              <h3 className="font-medium text-sm mb-1">Play Rounds</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Compete every week. 7% of points are at stake each round! :)
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold mb-3">
                3
              </div>
              <h3 className="font-medium text-sm mb-1">Climb the Rankings</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Win games to earn points. Top cut qualifies for the final showdown!!!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
