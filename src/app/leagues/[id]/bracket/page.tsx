"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeagueNav } from "@/components/leagues/LeagueNav";
import { PlayoffBracket } from "@/components/leagues/PlayoffBracket";
import { Trophy } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BracketPlayer {
  seed: number;
  name: string;
  points: number;
}

interface BracketMatch {
  round: number;
  matchNumber: number;
  seed1: number;
  seed2: number;
  playerName1: string | null;
  playerName2: string | null;
  winner1: boolean;
  winner2: boolean;
  result1: string | null;
  result2: string | null;
}

interface PodAssignment {
  podNumber: number;
  players: BracketPlayer[];
}

interface BracketData {
  matches: BracketMatch[];
  pods: PodAssignment[];
  byes: BracketPlayer[];
  totalRounds: number;
  format: string;
}

interface League {
  id: string;
  name: string;
  format: string;
  status: string;
  createdBy: string;
  days: {
    id: string;
    dayNumber: number;
    type: string;
    status: string;
    name: string | null;
    rounds: {
      id: string;
      roundNumber: number;
      status: string;
      name: string | null;
      tables: {
        id: string;
        tableNumber: number;
        players: {
          id: string;
          seatPosition: number;
          result: string;
          pointsWagered: number;
          pointsChange: number;
          matchPoints: number;
          gamesWon: number;
          gamesDrawn: number;
          gamesLost: number;
          leaguePlayer: {
            id: string;
            points: number;
            user: { name: string };
          };
        }[];
      }[];
    }[];
  }[];
}

function buildBracket(league: League): BracketData | null {
  const playoffDay = league.days.find(d => d.type === "PLAYOFF");
  if (!playoffDay) return null;

  const is1v1 = !league.format.startsWith("COMMANDER");
  const rounds = playoffDay.rounds.sort((a, b) => a.roundNumber - b.roundNumber);

  const semifinalsRound = rounds.find(r => r.name === "Semifinals");
  const finalsRound = rounds.find(r => r.name === "Finals" || r.name === "Final");

  if (is1v1) {
    const totalRounds = rounds.length;
    const matches: BracketMatch[] = [];

    for (const round of rounds) {
      const roundName = round.name?.toLowerCase() || "";
      let roundIndex = 1;
      if (roundName.includes("final") && !roundName.includes("semi") && !roundName.includes("quarter")) {
        roundIndex = totalRounds;
      } else if (roundName.includes("semi")) {
        roundIndex = totalRounds - 1;
      } else if (roundName.includes("quarter")) {
        roundIndex = totalRounds - 2;
      } else {
        roundIndex = rounds.indexOf(round) + 1;
      }

      for (const table of round.tables) {
        const p1 = table.players.find(p => p.seatPosition === 1);
        const p2 = table.players.find(p => p.seatPosition === 2);

        matches.push({
          round: roundIndex,
          matchNumber: table.tableNumber,
          seed1: table.tableNumber * 2 - 1,
          seed2: table.tableNumber * 2,
          playerName1: p1?.leaguePlayer.user.name ?? null,
          playerName2: p2?.leaguePlayer.user.name ?? null,
          winner1: p1?.result === "WIN",
          winner2: p2?.result === "WIN",
          result1: p1?.result === "PENDING" ? null : p1?.result ?? null,
          result2: p2?.result === "PENDING" ? null : p2?.result ?? null,
        });
      }
    }

    const hasBye = playoffDay.rounds.some(r =>
      r.tables.some(t => t.players.length === 1)
    );

    return {
      matches,
      pods: [],
      byes: [],
      totalRounds,
      format: league.format,
    };
  }

  const pods: PodAssignment[] = [];
  const matches: BracketMatch[] = [];
  const byes: BracketPlayer[] = [];

  if (semifinalsRound) {
    let podIndex = 0;
    for (const table of semifinalsRound.tables) {
      podIndex++;
      const podPlayers = table.players
        .sort((a, b) => a.seatPosition - b.seatPosition)
        .map((p, i) => ({
          seed: i + 1,
          name: p.leaguePlayer.user.name,
          points: p.leaguePlayer.points,
        }));

      pods.push({
        podNumber: podIndex,
        players: podPlayers,
      });

      for (let i = 0; i < table.players.length; i++) {
        for (let j = i + 1; j < table.players.length; j++) {
          const p1 = table.players[i];
          const p2 = table.players[j];
          matches.push({
            round: 1,
            matchNumber: (podIndex - 1) * 10 + matches.length + 1,
            seed1: i + 1,
            seed2: j + 1,
            playerName1: p1.leaguePlayer.user.name,
            playerName2: p2.leaguePlayer.user.name,
            winner1: p1.result === "WIN",
            winner2: p2.result === "WIN",
            result1: p1.result === "PENDING" ? null : p1.result,
            result2: p2.result === "PENDING" ? null : p2.result,
          });
        }
      }
    }
  }

  if (finalsRound) {
    for (const table of finalsRound.tables) {
      if (table.players.length === 1) {
        byes.push({
          seed: 1,
          name: table.players[0].leaguePlayer.user.name,
          points: table.players[0].leaguePlayer.points,
        });
      } else if (table.players.length >= 2) {
        const p1 = table.players.find(p => p.seatPosition === 1);
        const p2 = table.players.find(p => p.seatPosition === 2);
        if (p1 && p2) {
          matches.push({
            round: 2,
            matchNumber: 1,
            seed1: 1,
            seed2: 2,
            playerName1: p1.leaguePlayer.user.name,
            playerName2: p2.leaguePlayer.user.name,
            winner1: p1.result === "WIN",
            winner2: p2.result === "WIN",
            result1: p1.result === "PENDING" ? null : p1.result,
            result2: p2.result === "PENDING" ? null : p2.result,
          });
        }
      }
    }
  }

  return {
    matches,
    pods,
    byes,
    totalRounds: 2,
    format: league.format,
  };
}

export default function BracketPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  const leagueId = params.id as string;

  const fetchLeague = useCallback(() => {
    return fetch(`/api/leagues/${leagueId}`, { cache: "no-store" })
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

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (!league) {
    return <div className="container mx-auto px-4 py-8 text-center">League not found</div>;
  }

  const bracketData = buildBracket(league);

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/leagues">Leagues</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/leagues/${leagueId}`}>{league.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Bracket</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-2 mb-2">
        <Trophy className="h-5 w-5" />
        <h1 className="text-3xl font-bold">{league.name} - Bracket</h1>
      </div>

      <LeagueNav leagueId={leagueId} active="bracket" />

      {bracketData ? (
        <PlayoffBracket data={bracketData} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No playoff bracket has been generated yet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Close all regular season days to automatically generate the playoff bracket.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
