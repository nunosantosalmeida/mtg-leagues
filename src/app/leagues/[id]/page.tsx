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
import { LeagueNav } from "@/components/leagues/LeagueNav";
import { formatDisplayName, isCommanderFormat } from "@/lib/types";
import { Trophy, Users, Swords, Clock } from "lucide-react";
import { CountdownTimer } from "@/components/rounds/CountdownTimer";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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
  scoringSystem: string;
  createdAt: string;
  players: LeaguePlayer[];
  creator: { name: string };
  days: {
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
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);

  const leagueId = params.id as string;

  const fetchLeague = useCallback(() => {
    fetch(`/api/leagues/${leagueId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
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

  async function handleSaveDescription() {
    setSavingDescription(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription || null }),
      });
      if (res.ok) {
        fetchLeague();
        setEditingDescription(false);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update description");
      }
    } catch {
      alert("Failed to update description");
    } finally {
      setSavingDescription(false);
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

    if (!leagueWinner && league.status === "COMPLETED") {
      const topPlayer = [...league.players].sort((a, b) => b.points - a.points)[0];
      if (topPlayer) {
        leagueWinner = { id: topPlayer.user.id, name: topPlayer.user.name };
      }
    }
  }

  const availablePlayers = allPlayers.filter(
    (p) => !league.players.some((lp) => lp.user.id === p.id)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/leagues">Leagues</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{league.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold">{league.name}</h1>
            <Badge variant="outline" className={statusColors[league.status]}>
              {league.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {formatDisplayName(league.format)} • Best of {league.bestOf} • {league.totalDays} league days
          </p>
        </div>
        <JoinLeagueButton
          leagueId={league.id}
          leagueStatus={league.status}
          playerCount={league.players.length}
          onJoined={fetchLeague}
        />
      </div>

      <LeagueNav
        leagueId={league.id}
        active="overview"
        showBracket={league.days.some(d => d.type === "PLAYOFF")}
        rightSlot={
          isAdmin ? (
            <Button variant="destructive" size="sm" onClick={handleDeleteLeague}>
              Delete League
            </Button>
          ) : undefined
        }
      />

      {(() => {
        let totalMatches = 0;
        let completedDays = 0;
        let activeRound: { id: string; roundNumber: number; name: string | null; dayNumber: number; dayName: string | null } | null = null;
        for (const day of league.days) {
          if (day.status === "COMPLETED" && day.type !== "PLAYOFF") completedDays++;
          for (const round of day.rounds) {
            if (round.status === "IN_PROGRESS" && !activeRound) {
              activeRound = { id: round.id, roundNumber: round.roundNumber, name: round.name, dayNumber: day.dayNumber, dayName: day.name };
            }
            for (const table of round.tables) {
              if (table.players.some((p) => p.result && p.result !== "PENDING")) totalMatches++;
            }
          }
        }
        return (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold"><AnimatedCounter value={league.players.length} /></p>
                  <p className="text-xs text-muted-foreground">Players</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Swords className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold"><AnimatedCounter value={totalMatches} /></p>
                  <p className="text-xs text-muted-foreground">Matches Played</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold"><AnimatedCounter value={completedDays} /><span className="text-sm font-normal text-muted-foreground">/{league.totalDays}</span></p>
                  <p className="text-xs text-muted-foreground">Days Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {activeRound ? (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Active Round — Day {activeRound.dayNumber}{activeRound.dayName ? ` (${activeRound.dayName})` : ""}, Round {activeRound.roundNumber}
                      </p>
                      <CountdownTimer
                        defaultMinutes={isCommanderFormat(league.format) ? 75 : 50}
                        roundId={activeRound.id}
                        inline
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">—</p>
                      <p className="text-xs text-muted-foreground">No Active Round</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

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
        <div className="flex flex-col gap-6">
          {(isAdmin || league.description) && (
            <Card>
              <CardContent className="pt-6">
                {editingDescription ? (
                  <div className="space-y-3">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                      placeholder="Add a description for this league..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingDescription(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveDescription}
                        disabled={savingDescription}
                      >
                        {savingDescription ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm">{league.description || "No description"}</p>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditDescription(league.description || "");
                          setEditingDescription(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
              <p>{formatDisplayName(league.format)}</p>
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
                    const isTop = leagueWinner?.id === player.user.id;
                    return (
                      <div key={player.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-6">{index + 1}.</span>
                          <span className={playing ? "text-red-500 font-semibold" : ""}>
                            {player.user.name}
                          </span>
                          {isTop && <span className="text-yellow-500">🏆</span>}
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
      </div>
    </div>
  );
}
