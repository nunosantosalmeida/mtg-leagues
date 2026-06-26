"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface StandingEntry {
  leaguePlayerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  roundsPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

export default function StandingsPage() {
  const params = useParams();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);

  const leagueId = params.id as string;

  useEffect(() => {
    Promise.all([
      fetch(`/api/leagues/${leagueId}`).then((res) => res.json()),
      fetch(`/api/leagues/${leagueId}/standings`).then((res) => res.json()),
    ])
      .then(([leagueData, standingsData]) => {
        setLeagueName(leagueData.name);
        setStandings(standingsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leagueId]);

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{leagueName} - Standings</h1>
          <p className="text-muted-foreground">
            {standings.length} players
          </p>
        </div>
        <Link href={`/leagues/${leagueId}`} className="inline-flex items-center justify-center rounded-lg border-border bg-background hover:bg-muted hover:text-foreground text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
          Back to League
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-center">Played</TableHead>
                <TableHead className="text-center">Wins</TableHead>
                <TableHead className="text-center">Draws</TableHead>
                <TableHead className="text-center">Losses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No players yet
                  </TableCell>
                </TableRow>
              ) : (
                standings.map((entry, index) => (
                  <TableRow
                    key={entry.leaguePlayerId}
                    className={index < 3 ? "bg-muted/50" : ""}
                  >
                    <TableCell className="font-medium">
                      {index === 0 && <Badge className="mr-1">1st</Badge>}
                      {index === 1 && <Badge variant="secondary" className="mr-1">2nd</Badge>}
                      {index === 2 && <Badge variant="outline" className="mr-1">3rd</Badge>}
                      {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.userName}</div>
                        <div className="text-sm text-muted-foreground">{entry.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-lg">
                      {entry.points}
                    </TableCell>
                    <TableCell className="text-center">{entry.roundsPlayed}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-600">{entry.wins}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-yellow-600">{entry.draws}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-red-600">{entry.losses}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
