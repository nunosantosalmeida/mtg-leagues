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
}

export function ResultForm({ tableId, tableNumber, players, onResultRecorded, playoff, allowDraws = true }: ResultFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [saved, setSaved] = useState(false);

  const sorted = [...players].sort((a, b) => a.seatPosition - b.seatPosition);

  async function submitResult(results: { leaguePlayerId: string; result: string }[]) {
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
        return;
      }

      setSaved(true);
      await onResultRecorded();
    } catch {
      setError("Something went wrong");
      setWinnerId(null);
      setIsDraw(false);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectWinner(playerId: string) {
    setWinnerId(playerId);
    setIsDraw(false);
    setSaved(false);
    const results = players.map((p) => ({
      leaguePlayerId: p.leaguePlayerId,
      result: p.leaguePlayerId === playerId ? "WIN" : "ABSENT",
    }));
    submitResult(results);
  }

  function handleDraw() {
    setIsDraw(true);
    setWinnerId(null);
    setSaved(false);
    const results = players.map((p) => ({ leaguePlayerId: p.leaguePlayerId, result: "DRAW" }));
    submitResult(results);
  }

  if (saved) {
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
                  <span>{player.seatPosition}° {player.userName}</span>
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
                  {player.seatPosition}° {player.userName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {Math.round(player.points)} pts{!playoff && <> • Bet: {Math.round(player.pointsWagered)}</>}
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
