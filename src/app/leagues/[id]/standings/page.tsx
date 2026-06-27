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
import { LeagueNav } from "@/components/leagues/LeagueNav";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PointsChart } from "@/components/standings/PointsChart";

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
  penalties: number;
  pointHistory: { amount: number; description: string | null; createdAt: string }[];
}

interface LeagueData {
  name: string;
  days: { rounds: unknown[] }[];
}

export default function StandingsPage() {
  const params = useParams();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);

  const leagueId = params.id as string;

  useEffect(() => {
    Promise.all([
      fetch(`/api/leagues/${leagueId}`).then((res) => res.json()),
      fetch(`/api/leagues/${leagueId}/standings`).then((res) => res.json()),
    ])
      .then(([ld, standingsData]) => {
        setLeagueData(ld);
        setStandings(standingsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leagueId]);

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  const totalRounds = leagueData?.days.reduce((sum, d) => sum + d.rounds.length, 0) ?? 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/leagues">Leagues</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/leagues/${leagueId}`}>{leagueData?.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Standings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{leagueData?.name} - Standings</h1>
          <p className="text-muted-foreground">
            {standings.length} players
          </p>
        </div>
      </div>

      <LeagueNav leagueId={leagueId} active="standings" />

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-center">Played</TableHead>
                  <TableHead className="text-center">Wins</TableHead>
                  <TableHead className="text-center">Draws</TableHead>
                  <TableHead className="text-center">Losses</TableHead>
                  <TableHead className="text-center">Penalties</TableHead>
                  <TableHead className="text-center">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No players yet
                    </TableCell>
                  </TableRow>
                ) : (
                  standings.map((entry, index) => {
                    const attendance = totalRounds > 0
                      ? Math.round((entry.roundsPlayed / totalRounds) * 100)
                      : 0;
                    return (
                    <TableRow
                      key={entry.leaguePlayerId}
                      className={`hover:bg-muted/50 ${index % 2 === 1 ? "bg-muted/20" : ""}`}
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
                      <TableCell className="text-center">
                        {entry.penalties > 0 ? (
                          <span className="text-red-600">{entry.penalties}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={attendance >= 80 ? "text-green-600" : attendance >= 50 ? "text-yellow-600" : "text-red-600"}>
                          {attendance}%
                        </span>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <PointsChart
          players={standings.map((s) => ({
            name: s.userName,
            history: s.pointHistory,
          }))}
        />
      </div>
    </div>
  );
}
