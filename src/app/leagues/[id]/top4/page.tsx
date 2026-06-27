"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeagueNav } from "@/components/leagues/LeagueNav";

interface Qualifier {
  id: string;
  name: string;
  points: number;
}

interface Ranking {
  position: number;
  name: string;
  points: number;
}

interface League {
  id: string;
  name: string;
  status: string;
  createdBy: string;
}

export default function Top4Page() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [completing, setCompleting] = useState(false);

  const leagueId = params.id as string;

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}`)
      .then((res) => res.json())
      .then((data) => {
        setLeague(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leagueId]);

  async function handleSetupTop4() {
    setSettingUp(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/top4`, {
        method: "POST",
      });

      const data = await response.json();
      if (response.ok) {
        setQualifiers(data.qualifiers);
        window.location.reload();
      } else {
        alert(data.error || "Failed to set up Top 4");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setSettingUp(false);
    }
  }

  async function handleCompleteTop4() {
    if (!selectedWinner) {
      alert("Please select a winner");
      return;
    }

    setCompleting(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/top4`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId: selectedWinner }),
      });

      const data = await response.json();
      if (response.ok) {
        setRankings(data.rankings);
        window.location.reload();
      } else {
        alert(data.error || "Failed to complete Top 4");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (!league) {
    return <div className="container mx-auto px-4 py-8 text-center">League not found</div>;
  }

  const isAdmin = session?.user?.id === league.createdBy || (session?.user as any)?.role === "ADMIN";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{league.name} - Top 4 Final</h1>
          <p className="text-muted-foreground">
            <Badge className={
              league.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
              league.status === "IN_PROGRESS" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" :
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
            }>{league.status.replace("_", " ")}</Badge>
          </p>
        </div>
      </div>

      <LeagueNav leagueId={leagueId} />

      {league.status === "COMPLETED" && rankings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Final Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rankings.map((rank) => (
                <div
                  key={rank.position}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={rank.position === 1 ? "default" : "secondary"}
                      className="text-lg w-8 h-8 flex items-center justify-center"
                    >
                      {rank.position}
                    </Badge>
                    <span className="text-lg font-medium">{rank.name}</span>
                  </div>
                  <span className="text-lg font-mono">{rank.points} pts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : league.status === "TOP4" ? (
        <Card>
          <CardHeader>
            <CardTitle>Final Match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Qualified Players</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {qualifiers.map((q, index) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{index + 1}st</Badge>
                      <span className="font-medium">{q.name}</span>
                    </div>
                    <span className="font-mono">{q.points} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Record Winner</h3>
                <Select value={selectedWinner} onValueChange={(v) => setSelectedWinner(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select winner" />
                  </SelectTrigger>
                  <SelectContent>
                    {qualifiers.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCompleteTop4}
                  disabled={!selectedWinner || completing}
                  className="w-full"
                >
                  {completing ? "Completing..." : "Complete League"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="mb-4 text-muted-foreground">
              Top 4 final has not been set up yet
            </p>
            {isAdmin && (
              <Button onClick={handleSetupTop4} disabled={settingUp}>
                {settingUp ? "Setting up..." : "Set Up Top 4 Final"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
