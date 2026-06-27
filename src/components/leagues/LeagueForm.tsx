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
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LeagueForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("COMMANDER");
  const [bestOf, setBestOf] = useState("1");
  const [totalDays, setTotalDays] = useState("5");

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
              <Select value={format} onValueChange={(v) => setFormat(v ?? "COMMANDER")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMMANDER">Commander</SelectItem>
                  <SelectItem value="COMMANDER_PRECONS">Commander Precons</SelectItem>
                  <SelectItem value="CEDH">cEDH</SelectItem>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="MODERN">Modern</SelectItem>
                  <SelectItem value="PIONEER">Pioneer</SelectItem>
                  <SelectItem value="PAUPER">Pauper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Best Of</Label>
              <Select value={bestOf} onValueChange={(v) => setBestOf(v ?? "1")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>League Days</Label>
            <Select value={totalDays} onValueChange={(v) => setTotalDays(v ?? "5")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
