"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PointEntry {
  amount: number;
  description: string | null;
  createdAt: string;
}

interface PlayerPoints {
  name: string;
  history: PointEntry[];
}

interface PointsChartProps {
  players: PlayerPoints[];
}

function extractRound(desc: string | null): number | null {
  if (!desc) return null;
  const match = desc.match(/Round (\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea",
  "#ea580c", "#0891b2", "#be185d", "#4f46e5", "#059669",
];

export function PointsChart({ players }: PointsChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function togglePlayer(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const allRounds = new Set<number>();
  const playerRoundTotals: Record<string, Map<number, number>> = {};

  for (const player of players) {
    playerRoundTotals[player.name] = new Map();
    let running = 0;
    for (const entry of player.history) {
      const round = extractRound(entry.description);
      if (round !== null) {
        allRounds.add(round);
        running += entry.amount;
        playerRoundTotals[player.name].set(round, running);
      }
    }
  }

  const sortedRounds = [...allRounds].sort((a, b) => a - b);

  const dataPoints = [{ round: 0, label: "Start", ...Object.fromEntries(players.map((p) => [p.name, 0])) }];

  for (const round of sortedRounds) {
    const point: Record<string, number | string> = {};
    point.round = round;
    point.label = `R${round}`;
    for (const player of players) {
      point[player.name] = Math.round(playerRoundTotals[player.name].get(round) ?? 0);
    }
    dataPoints.push(point as typeof dataPoints[number]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Points Progression</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          {players.map((player, i) => {
            const isHidden = hidden.has(player.name);
            return (
              <button
                key={player.name}
                onClick={() => togglePlayer(player.name)}
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded transition-opacity ${
                  isHidden ? "opacity-30" : "opacity-100"
                }`}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span>{player.name}</span>
              </button>
            );
          })}
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value, name, props) => {
                  if (props.payload?.label === "Start") return null;
                  return [value, name];
                }}
              />
              {players.map((player, i) =>
                hidden.has(player.name) ? null : (
                  <Line
                    key={player.name}
                    type="monotone"
                    dataKey={player.name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
