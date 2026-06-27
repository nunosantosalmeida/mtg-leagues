"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultForm } from "@/components/results/ResultForm";
import { SeatDisplay } from "@/components/rounds/SeatDisplay";
import { CountdownTimer } from "@/components/rounds/CountdownTimer";
import { LeagueNav } from "@/components/leagues/LeagueNav";
import { isCommanderFormat } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";

interface TablePlayer {
  id: string;
  seatPosition: number;
  result: string;
  pointsWagered: number;
  pointsChange: number;
  leaguePlayer: {
    id: string;
    points: number;
    user: { name: string };
  };
}

interface Table {
  id: string;
  tableNumber: number;
  players: TablePlayer[];
}

interface Round {
  id: string;
  roundNumber: number;
  status: string;
  name: string | null;
  tables: Table[];
  absences: { leaguePlayerId: string }[];
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
  format: string;
  status: string;
  createdBy: string;
  days: LeagueDay[];
  players: { id: string; userId: string; points: number; user: { id: string; userId: string; name: string; email: string } }[];
}

export default function LeagueDayPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [closingRound, setClosingRound] = useState<string | null>(null);
  const [reopeningRound, setReopeningRound] = useState<string | null>(null);
  const [closingDay, setClosingDay] = useState(false);
  const [absentByRound, setAbsentByRound] = useState<Record<string, Set<string>>>({});
  const [savingAbsences, setSavingAbsences] = useState<string | null>(null);

  const leagueId = params.id as string;
  const dayId = params.dayId as string;

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

  async function handleCreateDays() {
    try {
      const response = await fetch(`/api/leagues/${leagueId}/days`, {
        method: "POST",
      });

      if (response.ok) {
        await fetchLeague();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to create days");
      }
    } catch {
      alert("Something went wrong");
    }
  }

  async function handleAssignTables(roundId: string) {
    setAssigning(roundId);
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/rounds/${roundId}/tables/assign`,
        { method: "POST" }
      );

      if (response.ok) {
        await fetchLeague();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to assign tables");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setAssigning(null);
    }
  }

  async function handleCompleteRound(roundId: string) {
    setClosingRound(roundId);
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/rounds/${roundId}/complete`,
        { method: "POST" }
      );

      if (response.ok) {
        await fetchLeague();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to close round");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setClosingRound(null);
    }
  }

  async function handleReopenRound(roundId: string) {
    setReopeningRound(roundId);
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/rounds/${roundId}/reopen`,
        { method: "POST" }
      );

      if (response.ok) {
        await fetchLeague();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to re-open round");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setReopeningRound(null);
    }
  }

  async function handleCloseDay() {
    setClosingDay(true);
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/days/${dayId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        }
      );

      if (response.ok) {
        await fetchLeague();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to close day");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setClosingDay(false);
    }
  }

  async function handleReopenDay() {
    setClosingDay(true);
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/days/${dayId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        }
      );

      if (response.ok) {
        await fetchLeague();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to reopen day");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setClosingDay(false);
    }
  }

  async function handleSaveAbsences(roundId: string) {
    setSavingAbsences(roundId);
    const absentIds = absentByRound[roundId] || new Set();
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/rounds/${roundId}/absences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ absentPlayerIds: Array.from(absentIds) }),
        }
      );

      if (response.ok) {
        await fetch(`/api/leagues/${leagueId}/rounds/${roundId}/tables/assign`, {
          method: "POST",
        });
        await fetchLeague();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save absences");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setSavingAbsences(null);
    }
  }

  function toggleAbsent(roundId: string, leaguePlayerId: string) {
    setAbsentByRound((prev) => {
      const next = { ...prev };
      if (!next[roundId]) {
        const round = currentDay?.rounds.find((r) => r.id === roundId);
        next[roundId] = new Set(round?.absences.map((a) => a.leaguePlayerId) || []);
      }
      const roundSet = new Set(next[roundId]);
      if (roundSet.has(leaguePlayerId)) {
        roundSet.delete(leaguePlayerId);
      } else {
        roundSet.add(leaguePlayerId);
      }
      next[roundId] = roundSet;
      return next;
    });
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (!league) {
    return <div className="container mx-auto px-4 py-8 text-center">League not found</div>;
  }

  const isAdmin = session?.user?.id === league.createdBy || (session?.user as any)?.role === "ADMIN";
  const currentDay = league.days.find((d) => d.id === dayId);
  const isPlayoff = currentDay?.type === "PLAYOFF";

  if (!currentDay) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{league.name} - Schedule</h1>
          <p className="text-muted-foreground">Manage league days and rounds</p>
        </div>

        {league.days.length === 0 && isAdmin ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="mb-4">No league days created yet</p>
              <Button onClick={handleCreateDays}>Create League Days</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {league.days.map((day) => (
              <Card key={day.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{day.name || `Day ${day.dayNumber}`}</CardTitle>
                    <Badge className={
                      day.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                      day.status === "IN_PROGRESS" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" :
                      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                    }>{day.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {new Date(day.date).toLocaleDateString()}
                  </p>
                  <Link href={`/leagues/${leagueId}/days/${day.id}`} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5 w-full">
                    Manage Day
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8">
          <LeagueNav leagueId={leagueId} active="schedule" />
        </div>
      </div>
    );
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
            <BreadcrumbLink href={`/leagues/${leagueId}`}>{league.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/leagues/${leagueId}/days`}>Schedule</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentDay.name || `Day ${currentDay.dayNumber}`}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            {league.name} - {currentDay.name || `Day ${currentDay.dayNumber}`}
          </h1>
          <p className="text-muted-foreground">
            {new Date(currentDay.date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && currentDay.status !== "COMPLETED" && currentDay.rounds.every((r) => r.status === "COMPLETED") && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCloseDay}
              disabled={closingDay}
            >
              {closingDay ? "Closing..." : "Close Day"}
            </Button>
          )}
          {isAdmin && currentDay.status === "COMPLETED" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReopenDay}
              disabled={closingDay}
            >
              {closingDay ? "Reopening..." : "Reopen Day"}
            </Button>
          )}
          {currentDay.status === "COMPLETED" && (
            <Badge variant="default">Day Closed</Badge>
          )}
        </div>
      </div>

      <LeagueNav leagueId={leagueId} active="schedule" />

      {currentDay.rounds.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Round Progress</p>
            <p className="text-sm text-muted-foreground">
              {currentDay.rounds.filter((r) => r.status === "COMPLETED").length} / {currentDay.rounds.length}
            </p>
          </div>
          <Progress
            value={
              currentDay.rounds.length > 0
                ? (currentDay.rounds.filter((r) => r.status === "COMPLETED").length / currentDay.rounds.length) * 100
                : 0
            }
          />
        </div>
      )}

      <div className="space-y-6">
        {currentDay.rounds.map((round, roundIdx) => {
          const allResultsRecorded = round.tables.length > 0 &&
            round.tables.every((table) =>
              table.players.every((p) => p.result !== "PENDING")
            );
          const noResultsRecorded = round.tables.length > 0 &&
            round.tables.every((table) =>
              table.players.every((p) => p.result === "PENDING")
            );
          const prevRoundCompleted = roundIdx === 0 || currentDay.rounds[roundIdx - 1].status === "COMPLETED";
          const canAssign = prevRoundCompleted && (round.status === "PLANNED" || (round.status === "IN_PROGRESS" && noResultsRecorded));

          return (
          <Card key={round.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{round.name || `Round ${round.roundNumber}`}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={
                    round.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                    round.status === "IN_PROGRESS" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" :
                    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                  }>
                    {round.status}
                  </Badge>
                  {round.status === "IN_PROGRESS" && round.tables.length > 0 && (
                    <>
                      <SeatDisplay tables={round.tables} roundName={round.name || `Round ${round.roundNumber}`} />
                      <CountdownTimer defaultMinutes={isCommanderFormat(league.format) ? 75 : 50} roundId={round.id} />
                    </>
                  )}
                  {isAdmin && canAssign && round.tables.length === 0 && !(isPlayoff && !isCommanderFormat(league.format) && round.name !== "Quarterfinals") && (
                    <Button
                      size="sm"
                      onClick={() => handleAssignTables(round.id)}
                      disabled={assigning === round.id}
                    >
                      {assigning === round.id ? "Assigning..." : "Assign Tables"}
                    </Button>
                  )}
                  {isAdmin && canAssign && round.tables.length > 0 && !(isPlayoff && !isCommanderFormat(league.format) && round.name !== "Quarterfinals") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAssignTables(round.id)}
                      disabled={assigning === round.id}
                    >
                      {assigning === round.id ? "Re-assigning..." : "Re-assign Tables"}
                    </Button>
                  )}
                  {isAdmin && round.status === "IN_PROGRESS" && allResultsRecorded && (
                    <Button
                      size="sm"
                      onClick={() => handleCompleteRound(round.id)}
                      disabled={closingRound === round.id}
                    >
                      {closingRound === round.id ? "Closing..." : "Close Round"}
                    </Button>
                  )}
                  {isAdmin && round.status === "COMPLETED" && currentDay.status !== "COMPLETED" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReopenRound(round.id)}
                      disabled={reopeningRound === round.id}
                    >
                      {reopeningRound === round.id ? "Re-opening..." : "Re-open Round"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isAdmin && canAssign && !(isPlayoff && !isCommanderFormat(league.format) && round.name !== "Quarterfinals") && (
                <div className="space-y-4 mb-6">
                  <p className="text-sm text-muted-foreground">
                    {round.tables.length === 0
                      ? "Mark absent players before assigning tables:"
                      : "Redefine absences and re-assign tables:"}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1">
                    {[...league.players]
                      .sort((a, b) => b.points - a.points)
                      .map((player) => {
                        const isAbsent = absentByRound[round.id]
                          ? absentByRound[round.id].has(player.id)
                          : round.absences.some((a) => a.leaguePlayerId === player.id);
                        return (
                          <label
                            key={player.id}
                            className="flex items-center gap-1.5 py-0.5 cursor-pointer rounded hover:bg-muted"
                          >
                            <input
                              type="checkbox"
                              checked={isAbsent}
                              onChange={() => toggleAbsent(round.id, player.id)}
                              className="h-3 w-3"
                            />
                            <span className="text-sm truncate">{player.user.name}</span>
                            {isAbsent && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">A</Badge>
                            )}
                          </label>
                        );
                      })}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSaveAbsences(round.id)}
                    disabled={savingAbsences === round.id}
                  >
                    {savingAbsences === round.id ? "Saving..." : round.tables.length > 0 ? "Save & Re-assign" : "Save Absences"}
                  </Button>
                </div>
              )}
              {round.tables.length === 0 ? (
                <p className="text-muted-foreground">No tables assigned yet</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {round.tables.map((table) => {
                    if (table.players.length === 1) {
                      return (
                        <Card key={table.id} className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Table {table.tableNumber} — Bye</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between text-sm">
                              <span>{table.players[0].leaguePlayer.user.name}</span>
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                +{table.players[0].pointsChange} pts
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    if (isAdmin && round.status === "IN_PROGRESS" && prevRoundCompleted) {
                      const allowDraws = !(isPlayoff && !isCommanderFormat(league.format));
                      return (
                        <ResultForm
                          key={table.id}
                          tableId={table.id}
                          tableNumber={table.tableNumber}
                          players={table.players.map((p) => ({
                            leaguePlayerId: p.leaguePlayer.id,
                            userName: p.leaguePlayer.user.name,
                            seatPosition: p.seatPosition,
                            points: p.leaguePlayer.points,
                            pointsWagered: p.pointsWagered,
                          }))}
                          onResultRecorded={fetchLeague}
                          playoff={isPlayoff}
                          allowDraws={allowDraws}
                        />
                      );
                    }

                    return (
                      <Card key={table.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Table {table.tableNumber}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {[...table.players]
                              .sort((a, b) => a.seatPosition - b.seatPosition)
                              .map((player) => (
                                <div
                                  key={player.id}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{player.seatPosition}° {player.leaguePlayer.user.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {player.result === "WIN" && (
                                      <Badge>WIN</Badge>
                                    )}
                                    {player.result === "DRAW" && (
                                      <Badge variant="secondary">DRAW</Badge>
                                    )}
                                    {player.result !== "PENDING" && !isPlayoff && (
                                      <span
                                        className={
                                          player.pointsChange >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }
                                      >
                                        {player.pointsChange >= 0 ? "+" : ""}
                                        {Math.round(player.pointsChange)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
