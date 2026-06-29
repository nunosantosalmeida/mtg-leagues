"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Player {
  leaguePlayerId: string;
  userName: string;
  seatPosition: number;
  points: number;
  pointsWagered: number;
}

interface ResultFormProps {
  tableId: string;
  tableNumber: number;
  players: Player[];
  onResultRecorded: () => Promise<void>;
  playoff?: boolean;
  allowDraws?: boolean;
  competitive?: boolean;
  bestOf?: number;
}

function getScoreOptions(bestOf: number): { p1: number; p2: number; label: string }[] {
  const winsNeeded = Math.ceil(bestOf / 2);
  const options: { p1: number; p2: number; label: string }[] = [];

  for (let p1 = 0; p1 <= winsNeeded; p1++) {
    for (let p2 = 0; p2 <= winsNeeded; p2++) {
      const p1Clinched = p1 >= winsNeeded;
      const p2Clinched = p2 >= winsNeeded;
      const atLeastOneGame = p1 > 0 || p2 > 0;

      if ((p1Clinched && !p2Clinched) || (p2Clinched && !p1Clinched) || (!p1Clinched && !p2Clinched && atLeastOneGame) || (p1 === 0 && p2 === 0)) {
        options.push({ p1, p2, label: `${p1}-${p2}` });
      }
    }
  }

  return options.sort((a, b) => {
    const aP1Wins = a.p1 > a.p2;
    const aP2Wins = a.p2 > a.p1;
    const bP1Wins = b.p1 > b.p2;
    const bP2Wins = b.p2 > b.p1;
    const aDraw = a.p1 === a.p2;
    const bDraw = b.p1 === b.p2;

    const groupOrder = (draw: boolean, p1Wins: boolean, p2Wins: boolean) =>
      draw ? 1 : p1Wins ? 0 : 2;
    const gA = groupOrder(aDraw, aP1Wins, aP2Wins);
    const gB = groupOrder(bDraw, bP1Wins, bP2Wins);
    if (gA !== gB) return gA - gB;

    if (aP1Wins) return b.p1 - a.p1 || a.p2 - b.p2;
    if (aP2Wins) return a.p2 - b.p2 || b.p1 - a.p1;
    return b.p1 - a.p1;
  });
}

export function ResultForm({ tableId, tableNumber, players, onResultRecorded, playoff, allowDraws = true, competitive, bestOf = 3 }: ResultFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedScore, setSavedScore] = useState<string | null>(null);

  const sorted = [...players].sort((a, b) => a.seatPosition - b.seatPosition);
  const is1v1 = players.length === 2;
  const isCompetitive1v1 = competitive && is1v1;

  async function submitResult(results: { leaguePlayerId: string; result: string; gamesWon?: number; gamesDrawn?: number; gamesLost?: number }[]) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, results }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to record results");
        setWinnerId(null);
        setIsDraw(false);
        setSavedScore(null);
        return;
      }

      setSaved(true);
      await onResultRecorded();
    } catch {
      setError("Something went wrong");
      setWinnerId(null);
      setIsDraw(false);
      setSavedScore(null);
    } finally {
      setLoading(false);
    }
  }

  function handleScore(p1Score: number, p2Score: number) {
    const p1 = sorted[0];
    const p2 = sorted[1];
    const draw = p1Score === p2Score;
    const p1Wins = p1Score > p2Score;

    setWinnerId(draw ? null : p1Wins ? p1.leaguePlayerId : p2.leaguePlayerId);
    setIsDraw(draw);
    setSavedScore(`${p1Score}-${p2Score}`);
    setSaved(false);

    const results = [
      {
        leaguePlayerId: p1.leaguePlayerId,
        result: draw ? "DRAW" : p1Wins ? "WIN" : "LOSS",
        gamesWon: p1Score,
        gamesDrawn: 0,
        gamesLost: p2Score,
      },
      {
        leaguePlayerId: p2.leaguePlayerId,
        result: draw ? "DRAW" : !p1Wins ? "WIN" : "LOSS",
        gamesWon: p2Score,
        gamesDrawn: 0,
        gamesLost: p1Score,
      },
    ];
    submitResult(results);
  }

  function handleDraw() {
    setWinnerId(null);
    setIsDraw(true);
    setSavedScore(null);
    setSaved(false);

    const results = sorted.map((p) => ({
      leaguePlayerId: p.leaguePlayerId,
      result: "DRAW",
      gamesWon: 0,
      gamesDrawn: 1,
      gamesLost: 0,
    }));
    submitResult(results);
  }

  function handleSelectWinner(playerId: string) {
    setWinnerId(playerId);
    setIsDraw(false);
    setSavedScore(null);
    setSaved(false);

    const results = players.map((p) => ({
      leaguePlayerId: p.leaguePlayerId,
      result: p.leaguePlayerId === playerId ? "WIN" : "LOSS",
    }));
    submitResult(results);
  }

  if (saved) {
    if (isCompetitive1v1) {
      const score = savedScore ?? (isDraw ? "?" : "?");
      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Table {tableNumber}</CardTitle>
              <Badge variant="outline">Best of {bestOf}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="font-medium text-right">{sorted[0].userName}</span>
              <span className="font-mono font-bold text-base">{score}</span>
              <span className="font-medium text-left">{sorted[1].userName}</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Table {tableNumber}</CardTitle>
            <Badge variant="outline">{players.length} players</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sorted.map((player) => {
              const isWinner = player.leaguePlayerId === winnerId;
              return (
                <div key={player.leaguePlayerId} className="flex items-center justify-between text-sm">
                  <span>{is1v1 ? player.userName : `${player.seatPosition}° ${player.userName}`}</span>
                  <div className="flex items-center gap-2">
                    {isDraw && <Badge variant="secondary">DRAW</Badge>}
                    {isWinner && <Badge>WIN</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isCompetitive1v1) {
    const scoreOptions = getScoreOptions(bestOf);
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Table {tableNumber}</CardTitle>
            <Badge variant="outline">Best of {bestOf}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {error && (
              <div className="p-2 text-sm text-red-500 bg-red-50 rounded-md">{error}</div>
            )}

            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="font-medium text-right">{sorted[0].userName}</span>
              <span className="text-muted-foreground font-bold">vs</span>
              <span className="font-medium text-left">{sorted[1].userName}</span>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              {(() => {
                const p1Wins = scoreOptions.filter((o) => o.p1 > o.p2);
                const draws = scoreOptions.filter((o) => o.p1 === o.p2);
                const p2Wins = scoreOptions.filter((o) => o.p2 > o.p1);

                function renderGroup(opts: typeof scoreOptions) {
                  return opts.map((opt) => (
                    <Button
                      key={opt.label}
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs h-8 px-3"
                      onClick={() => handleScore(opt.p1, opt.p2)}
                      disabled={loading}
                    >
                      {opt.label}
                    </Button>
                  ));
                }

                return (
                  <>
                    {renderGroup(p1Wins)}
                    {draws.length > 0 && p2Wins.length > 0 && <span className="w-3" />}
                    {renderGroup(draws)}
                    {p1Wins.length > 0 && p2Wins.length > 0 && <span className="w-3" />}
                    {renderGroup(p2Wins)}
                  </>
                );
              })()}
            </div>

            {!isCompetitive1v1 && allowDraws && (
              <Button
                variant="outline"
                onClick={handleDraw}
                className="w-full"
                disabled={loading}
              >
                {loading ? "Recording..." : "Draw"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Table {tableNumber}</CardTitle>
          <Badge variant="outline">{players.length} players</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {error && (
            <div className="p-2 text-sm text-red-500 bg-red-50 rounded-md">{error}</div>
          )}

          {sorted.map((player) => (
            <div
              key={player.leaguePlayerId}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="font-medium">
                  {is1v1 ? player.userName : `${player.seatPosition}° ${player.userName}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {Math.round(player.points)} pts{!playoff && !competitive && <> • Bet: {Math.round(player.pointsWagered)}</>}
                </div>
              </div>
              <Button
                size="sm"
                variant={winnerId === player.leaguePlayerId ? "default" : "outline"}
                onClick={() => handleSelectWinner(player.leaguePlayerId)}
                disabled={loading}
              >
                Winner
              </Button>
            </div>
          ))}

          {allowDraws && (
            <Button
              variant={isDraw ? "default" : "outline"}
              onClick={handleDraw}
              className="w-full"
              disabled={loading}
            >
              {loading ? "Recording..." : "Draw"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
