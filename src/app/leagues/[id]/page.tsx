"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JoinLeagueButton } from "@/components/leagues/JoinLeagueButton";
import Link from "next/link";

interface LeaguePlayer {
  id: string;
  points: number;
  isActive: boolean;
  user: { id: string; name: string; email: string };
}

interface League {
  id: string;
  name: string;
  description: string | null;
  format: string;
  bestOf: number;
  totalDays: number;
  status: string;
  createdAt: string;
  players: LeaguePlayer[];
  creator: { name: string };
  days: {
    type: string;
    status: string;
    name: string | null;
    rounds: {
      roundNumber: number;
      status: string;
      name: string | null;
      tables: {
        tableNumber: number;
        players: {
          seatPosition: number;
          result: string | null;
          leaguePlayer: { user: { id: string; name: string } };
        }[];
      }[];
    }[];
  }[];
}

interface Player {
  id: string;
  name: string;
  email: string;
}

const statusColors: Record<string, string> = {
  REGISTRATION: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  TOP4: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function LeagueDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mockCount, setMockCount] = useState("");
  const [creatingMock, setCreatingMock] = useState(false);

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

  useEffect(() => {
    if (session?.user) {
      fetch("/api/admin/players")
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setAllPlayers(data);
            setIsAdmin(true);
          }
        })
        .catch(() => {});
    }
  }, [session]);

  async function handleEnrollPlayer() {
    if (!selectedPlayer) return;

    setEnrolling(true);
    setEnrollError("");

    try {
      const res = await fetch(`/api/leagues/${leagueId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedPlayer }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEnrollError(data.error || "Failed to enroll player");
        return;
      }

      setSelectedPlayer("");
      fetchLeague();
    } catch {
      setEnrollError("Something went wrong");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleRemovePlayer(userId: string) {
    if (!confirm("Remove this player from the league?")) return;

    try {
      const res = await fetch(`/api/leagues/${leagueId}/players`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        fetchLeague();
      }
    } catch {
      alert("Failed to remove player");
    }
  }

  async function handleCreateMockPlayers() {
    const count = parseInt(mockCount);
    if (!count || count < 1) return;

    setCreatingMock(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/mock-players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });

      if (res.ok) {
        setMockCount("");
        fetchLeague();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create mock players");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setCreatingMock(false);
    }
  }

  async function handleDeleteLeague() {
    if (!confirm("Are you sure you want to delete this league? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        window.location.href = "/leagues";
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete league");
      }
    } catch {
      alert("Failed to delete league");
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (!league) {
    return <div className="container mx-auto px-4 py-8 text-center">League not found</div>;
  }

  const playingInfo: Record<string, { round: number; seat: number; table: number }> = {};
  let leagueWinner: { id: string; name: string } | null = null;
  if (league.days) {
    for (const day of league.days) {
      for (const round of day.rounds) {
        if (round.status === "IN_PROGRESS") {
          for (const table of round.tables) {
            for (const tp of table.players) {
              playingInfo[tp.leaguePlayer.user.id] = {
                round: round.roundNumber,
                seat: tp.seatPosition,
                table: table.tableNumber,
              };
            }
          }
        }
      }
    }

    const playoffDay = league.days.find((d) => d.type === "PLAYOFF");
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
            const topPlayer = [...league.players].sort((a, b) => b.points - a.points)[0];
            if (topPlayer) {
              leagueWinner = { id: topPlayer.user.id, name: topPlayer.user.name };
            }
          }
        }
      }
    }
  }

  const availablePlayers = allPlayers.filter(
    (p) => !league.players.some((lp) => lp.user.id === p.id)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{league.name}</h1>
            <Badge variant="outline" className={statusColors[league.status]}>
              {league.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {league.format} • Best of {league.bestOf} • {league.totalDays} league days
          </p>
        </div>
        <JoinLeagueButton
          leagueId={league.id}
          leagueStatus={league.status}
          playerCount={league.players.length}
          onJoined={fetchLeague}
        />
      </div>

      {leagueWinner && (
        <Card className="mb-8 border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950">
          <CardContent className="pt-6 flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <p className="text-sm text-muted-foreground">League Champion</p>
              <p className="text-xl font-bold">{leagueWinner.name}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {league.description && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p>{league.description}</p>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Enroll Player</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Add a registered player to this league. They must be registered first (Admin Panel).
            </p>
            {enrollError && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md mb-4">{enrollError}</div>
            )}
            <div className="flex gap-4 items-end max-w-lg">
              <div className="flex-1">
                <Select value={selectedPlayer} onValueChange={(v) => setSelectedPlayer(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlayers.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No available players
                      </SelectItem>
                    ) : (
                      availablePlayers.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name} ({player.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleEnrollPlayer} disabled={!selectedPlayer || enrolling}>
                {enrolling ? "Enrolling..." : "Enroll"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add Mock Players</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create test players (Player N, playerN@mock.local) and enroll them.
            </p>
            <div className="flex gap-4 items-end max-w-lg">
              <div className="flex-1">
                <label className="text-sm font-medium">Number of players</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={mockCount}
                  onChange={(e) => setMockCount(e.target.value)}
                  placeholder="e.g. 8"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Button
                onClick={handleCreateMockPlayers}
                disabled={!mockCount || creatingMock}
                variant="outline"
              >
                {creatingMock ? "Creating..." : "Create & Enroll"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Players ({league.players.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {league.players.length === 0 ? (
              <p className="text-muted-foreground">No players yet</p>
            ) : (
              <div className="space-y-2">
                {[...league.players]
                  .sort((a, b) => b.points - a.points)
                  .map((player, index) => {
                    const playing = playingInfo[player.user.id];
                    return (
                      <div key={player.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-6">{index + 1}.</span>
                          <span className={playing ? "text-red-500 font-semibold" : ""}>
                            {player.user.name}
                          </span>
                          {playing && (
                            <Badge variant="outline" className="text-red-500 border-red-500 text-xs">
                              R{playing.round} • T{playing.table} • Seat {playing.seat}
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-sm">({player.user.email})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${playing ? "text-red-500 font-semibold" : ""}`}>
                            {Math.round(player.points)}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => handleRemovePlayer(player.user.id)}
                              className="text-red-500 hover:text-red-700 text-sm ml-2"
                            >
                              Remove
                            </button>
                          )}
                          {!isAdmin && session?.user?.id === player.user.id && (
                            <button
                              onClick={() => handleRemovePlayer(player.user.id)}
                              className="text-red-500 hover:text-red-700 text-sm ml-2"
                            >
                              Leave
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>League Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Created by</p>
              <p>{league.creator.name}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Format</p>
              <p>{league.format}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Match Settings</p>
              <p>Best of {league.bestOf} games</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p>{league.totalDays} league days (2 rounds each)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex gap-4">
        <Link href="/leagues" className="inline-flex items-center justify-center rounded-lg border-border bg-background hover:bg-muted hover:text-foreground text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
          Back to Leagues
        </Link>
        <Link href={`/leagues/${league.id}/standings`} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
          View Standings
        </Link>
        <Link href={`/leagues/${league.id}/days`} className="inline-flex items-center justify-center rounded-lg border-border bg-background hover:bg-muted hover:text-foreground text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
          Manage Schedule
        </Link>
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleDeleteLeague} className="ml-auto">
            Delete League
          </Button>
        )}
      </div>
    </div>
  );
}
