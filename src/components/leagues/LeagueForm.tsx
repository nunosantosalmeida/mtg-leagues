"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isCommanderFormat, formatDisplayName, WEEKDAY_NAMES } from "@/lib/types";

const FORMAT_OPTIONS = [
  "COMMANDER",
  "COMMANDER_PRECONS",
  "CEDH",
  "STANDARD",
  "MODERN",
  "PIONEER",
  "PAUPER",
] as const;

const SCORING_OPTIONS = [
  { value: "COMPETITIVE", label: "Traditional" },
  { value: "POINTS", label: "Bet League" },
] as const;

const BEST_OF_OPTIONS = ["1", "3", "5"] as const;

function DisplaySelect({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  renderLabel: (v: string) => string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? options[0])}>
      <SelectTrigger>
        <span>{renderLabel(value)}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {renderLabel(opt)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LeagueForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("COMMANDER");
  const [bestOf, setBestOf] = useState("1");
  const [totalDays, setTotalDays] = useState("5");
  const [roundsPerDay, setRoundsPerDay] = useState("2");
  const [weekday, setWeekday] = useState("5");
  const [scoringSystem, setScoringSystem] = useState("POINTS");



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          format,
          bestOf: parseInt(bestOf),
          totalDays: parseInt(totalDays),
          roundsPerDay: parseInt(roundsPerDay),
          weekday: parseInt(weekday),
          scoringSystem,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to create league");
        return;
      }

      const league = await response.json();
      router.push(`/leagues/${league.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create League</CardTitle>
        <CardDescription>Set up a new MTG league</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">League Name</Label>
            <Input
              id="name"
              placeholder="Friday Night Commander"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Weekly commander league at the local game store"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <DisplaySelect
                value={format}
                options={FORMAT_OPTIONS}
                onChange={(v) => {
                  setFormat(v);
                  if (isCommanderFormat(v)) setScoringSystem("POINTS");
                }}
                renderLabel={formatDisplayName}
              />
            </div>
            <div className="space-y-2">
              <Label>Best Of</Label>
              <DisplaySelect
                value={bestOf}
                options={BEST_OF_OPTIONS}
                onChange={setBestOf}
                renderLabel={(v) => v}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>League Days</Label>
            <Select value={totalDays} onValueChange={(v) => setTotalDays(v ?? "5")}>
              <SelectTrigger>
                <span>{totalDays} days</span>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rounds Per Day</Label>
              <Select value={roundsPerDay} onValueChange={(v) => setRoundsPerDay(v ?? "2")}>
                <SelectTrigger>
                  <span>{roundsPerDay} {parseInt(roundsPerDay) === 1 ? "round" : "rounds"}</span>
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} {n === 1 ? "round" : "rounds"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={weekday} onValueChange={(v) => setWeekday(v ?? "5")}>
                <SelectTrigger>
                  <span>{WEEKDAY_NAMES[parseInt(weekday)]}</span>
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_NAMES.map((day, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!isCommanderFormat(format) && (
            <div className="space-y-2">
              <Label>Scoring System</Label>
              <Select value={scoringSystem} onValueChange={(v) => setScoringSystem(v ?? "POINTS")}>
                <SelectTrigger>
                  <span>{SCORING_OPTIONS.find((o) => o.value === scoringSystem)?.label ?? scoringSystem}</span>
                </SelectTrigger>
                <SelectContent>
                  {SCORING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Competitive uses match points (3/1/0) with OMW%, GW%, OGW% tiebreakers
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create League"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
