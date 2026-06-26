"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Round {
  id: string;
  roundNumber: number;
  status: string;
  name: string | null;
  tables: { id: string }[];
}

interface LeagueDay {
  id: string;
  dayNumber: number;
  date: string;
  status: string;
  type: string;
  name: string | null;
  rounds: Round[];
}

interface League {
  id: string;
  name: string;
  status: string;
  createdBy: string;
  days: LeagueDay[];
  players: { id: string }[];
}

export default function LeagueDaysPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const leagueId = params.id as string;

  const fetchLeague = useCallback(() => {
    fetch(`/api/leagues/${leagueId}`)
      .then((res) => res.json())
      .then((data) => {
        setLeague(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leagueId]);

  useEffect(() => {
    fetchLeague();
  }, [fetchLeague]);

  async function handleCreateDays() {
    setCreating(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/days`, { method: "POST" });
      if (res.ok) {
        fetchLeague();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create days");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (!league) {
    return <div className="container mx-auto px-4 py-8 text-center">League not found</div>;
  }

  const isAdmin = session?.user?.id === league.createdBy || (session?.user as any)?.role === "ADMIN";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{league.name} - Schedule</h1>
          <p className="text-muted-foreground">
            {league.days.length} days • {league.players.length} players
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && league.days.length === 0 && (league.status === "REGISTRATION" || league.status === "IN_PROGRESS") && (
            <Button onClick={handleCreateDays} disabled={creating}>
              {creating ? "Creating..." : "Create League Days"}
            </Button>
          )}
          <Link href={`/leagues/${leagueId}`} className="inline-flex items-center justify-center rounded-lg border-border bg-background hover:bg-muted hover:text-foreground text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
            Back to League
          </Link>
        </div>
      </div>

      {league.days.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">No league days yet</p>
            {isAdmin && league.status === "REGISTRATION" && (
              <p className="text-sm text-muted-foreground">
                Add players and start the league to create schedule days.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {league.days.map((day) => (
            <Card key={day.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{day.name || `Day ${day.dayNumber}`}</CardTitle>
                  <Badge variant={day.status === "COMPLETED" ? "default" : "secondary"}>
                    {day.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {new Date(day.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <div className="text-sm">
                  <p className="text-muted-foreground">
                    {day.rounds.length} rounds •{" "}
                    {day.rounds.reduce((sum, r) => sum + r.tables.length, 0)} tables
                  </p>
                </div>
                <Link href={`/leagues/${leagueId}/days/${day.id}`} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium whitespace-nowrap transition-all w-full h-8 gap-1.5 px-2.5">
                  Manage Day
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
