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
import { isCommanderFormat } from "@/lib/types";
import { getCommanderTopCut } from "@/lib/playoff/bracket";
import { Trophy, Shield } from "lucide-react";

interface StandingEntry {
  leaguePlayerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  matchPoints: number;
  roundsPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  penalties: number;
  omwPercentage: number;
  gwPercentage: number;
  ogwPercentage: number;
  pointHistory: { amount: number; description: string | null; createdAt: string }[];
}

interface LeagueData {
  id: string;
  name: string;
  format: string;
  scoringSystem: string;
  status: string;
  players: { user: { id: string; name: string }; points: number }[];
  days: { type: string; rounds: { id: string; name: string | null; status: string; tables: { tableNumber: number; players: { result: string; leaguePlayer: { user: { id: string; name: string } } }[] }[] }[] }[];
}

export default function StandingsPage() {
  const params = useParams();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);

  const leagueId = params.id as string;

  useEffect(() => {
    Promise.all([
      fetch(`/api/leagues/${leagueId}`).then((res) => res.ok ? res.json() : null),
      fetch(`/api/leagues/${leagueId}/standings`).then((res) => res.ok ? res.json() : []),
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
  const totalRegularRounds = leagueData?.days.filter(d => d.type === "REGULAR").reduce((sum, d) => sum + d.rounds.length, 0) ?? 0;
  const isCompetitive = leagueData?.scoringSystem === "COMPETITIVE";
  const is1v1 = leagueData?.format && !isCommanderFormat(leagueData.format);
  const isTraditional1v1 = is1v1 && !isCompetitive;

  const isCommander = leagueData?.format && isCommanderFormat(leagueData.format);
  const topCut = isCommander ? getCommanderTopCut(standings.length) : 0;
  const isBracketReady = leagueData && !leagueData.days.some(d => d.type === "PLAYOFF");

  const qualifyingIds = new Set<string>();
  if (isCommander && isBracketReady && topCut > 0) {
    const eligiblePlayers = standings.filter((s) =>
      totalRegularRounds === 0 || s.roundsPlayed / totalRegularRounds >= 0.6
    );
    for (let i = 0; i < Math.min(topCut, eligiblePlayers.length); i++) {
      qualifyingIds.add(eligiblePlayers[i].leaguePlayerId);
    }
  }

  let leagueWinner: { id: string; name: string } | null = null;
  if (leagueData) {
    const playoffDay = leagueData.days.find((d) => d.type === "PLAYOFF");
    if (playoffDay) {
      const finalsRound = playoffDay.rounds.find((r) => r.name === "Finals" || r.name === "Final");
      if (finalsRound && finalsRound.status === "COMPLETED") {
        const finalsTable = finalsRound.tables[0];
        if (finalsTable) {
          const hasWinner = finalsTable.players.some((p) => p.result === "WIN");
          if (hasWinner) {
            const winner = finalsTable.players.find((p) => p.result === "WIN");
            if (winner) {
              leagueWinner = { id: winner.leaguePlayer.user.id, name: winner.leaguePlayer.user.name };
            }
          } else {
            const topPlayer = [...leagueData.players].sort((a, b) => b.points - a.points)[0];
            if (topPlayer) {
              leagueWinner = { id: topPlayer.user.id, name: topPlayer.user.name };
            }
          }
        }
      }
    }
    if (!leagueWinner && leagueData.status === "COMPLETED") {
      const topPlayer = [...leagueData.players].sort((a, b) => b.points - a.points)[0];
      if (topPlayer) {
        leagueWinner = { id: topPlayer.user.id, name: topPlayer.user.name };
      }
    }
  }

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

      <LeagueNav leagueId={leagueId} active="standings" showBracket={leagueData?.days.some(d => d.type === "PLAYOFF")} />

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table className="min-w-[600px]">
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">
                    {is1v1 ? "Score" : isCompetitive ? "MP" : "Points"}
                  </TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Played</TableHead>
                  <TableHead className="text-center">W</TableHead>
                  <TableHead className="text-center">D</TableHead>
                  <TableHead className="text-center">L</TableHead>
                  {!isCompetitive && !isTraditional1v1 && (
                    <TableHead className="text-center hidden md:table-cell">Pen</TableHead>
                  )}
                  {isCompetitive && (
                    <>
                      <TableHead className="text-center hidden lg:table-cell">OMW%</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">GW%</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">OGW%</TableHead>
                    </>
                  )}
                  {!isCompetitive && !isTraditional1v1 && (
                    <TableHead className="text-center hidden sm:table-cell">Attn</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isCompetitive ? 10 : isTraditional1v1 ? 7 : 9} className="text-center py-8">
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
                      className={`hover:bg-muted/50 ${index % 2 === 1 ? "bg-muted/20" : ""} ${qualifyingIds.has(entry.leaguePlayerId) ? "border-l-2 border-l-green-500" : ""}`}
                    >
                      <TableCell className="font-medium">
                        {qualifyingIds.has(entry.leaguePlayerId) && (
                          <Shield className="h-3.5 w-3.5 text-green-500 mr-1 inline" />
                        )}
                        {index === 0 && <Badge className="mr-1">1st</Badge>}
                        {index === 1 && <Badge variant="secondary" className="mr-1">2nd</Badge>}
                        {index === 2 && <Badge variant="outline" className="mr-1">3rd</Badge>}
                        {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {leagueWinner?.id === entry.userId && (
                              <Trophy className="h-4 w-4 text-yellow-500" />
                            )}
                            {entry.userName}
                          </div>
                          <div className="text-xs text-muted-foreground hidden sm:block">{entry.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        {leagueData?.scoringSystem === "COMPETITIVE" ? entry.matchPoints.toFixed(2) : entry.points.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{entry.roundsPlayed}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600">{entry.wins}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-yellow-600">{entry.draws}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-600">{entry.losses}</span>
                      </TableCell>
                      {!isCompetitive && !isTraditional1v1 && (
                        <TableCell className="text-center hidden md:table-cell">
                          {entry.penalties > 0 ? (
                            <span className="text-red-600">{entry.penalties}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      )}
                      {isCompetitive && (
                        <>
                          <TableCell className="text-center font-mono hidden lg:table-cell">
                            {(entry.omwPercentage * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-center font-mono hidden lg:table-cell">
                            {(entry.gwPercentage * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-center font-mono hidden lg:table-cell">
                            {(entry.ogwPercentage * 100).toFixed(1)}%
                          </TableCell>
                        </>
                      )}
                      {!isCompetitive && !isTraditional1v1 && (
                        <TableCell className="text-center hidden sm:table-cell">
                          <span className={attendance >= 80 ? "text-green-600" : attendance >= 50 ? "text-yellow-600" : "text-red-600"}>
                            {attendance}%
                          </span>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isCommander && isBracketReady && topCut > 0 && (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 border-l-2 border-l-green-500" />
            <span>Bracket qualifying position (Top {topCut})</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-green-500" />
            <span>≥60% attendance</span>
          </div>
        </div>
      )}

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
