"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface ProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  };
  stats: {
    totalLeagues: number;
    activeLeagues: number;
    completedLeagues: number;
    totalGames: number;
    totalWins: number;
    totalDraws: number;
  };
  leagues: {
    id: string;
    name: string;
    format: string;
    status: string;
    points: number;
    gamesPlayed: number;
    wins: number;
    draws: number;
    recentChanges: {
      type: string;
      amount: number;
      description: string | null;
      createdAt: string;
    }[];
  }[];
}

const statusColors: Record<string, string> = {
  REGISTRATION: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  TOP4: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetch("/api/profile")
        .then((res) => res.json())
        .then((data) => {
          setProfile(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status, router]);

  if (loading || status === "loading") {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (!profile) {
    return <div className="container mx-auto px-4 py-8 text-center">Failed to load profile</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{profile.user.name}</h1>
        <p className="text-muted-foreground">{profile.user.email}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Member since {new Date(profile.user.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{profile.stats.totalLeagues}</div>
            <p className="text-sm text-muted-foreground">Total Leagues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{profile.stats.activeLeagues}</div>
            <p className="text-sm text-muted-foreground">Active Leagues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{profile.stats.totalGames}</div>
            <p className="text-sm text-muted-foreground">Games Played</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {profile.stats.totalGames > 0
                ? Math.round((profile.stats.totalWins / profile.stats.totalGames) * 100)
                : 0}
              %
            </div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold mb-4">My Leagues</h2>
      {profile.leagues.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">You haven&apos;t joined any leagues yet</p>
            <Link href="/leagues" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
              Browse Leagues
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {profile.leagues.map((league) => (
            <Card key={league.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{league.name}</CardTitle>
                  <Badge className={statusColors[league.status]}>
                    {league.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Format: </span>
                    {league.format}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Points: </span>
                    <span className="font-mono font-bold">{league.points}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Record: </span>
                    <span className="text-green-600">{league.wins}W</span>{" "}
                    <span className="text-yellow-600">{league.draws}D</span>{" "}
                    <span className="text-muted-foreground">
                      {league.gamesPlayed - league.wins - league.draws}L
                    </span>
                  </div>
                </div>
                <Separator className="my-3" />
                <Link href={`/leagues/${league.id}`} className="inline-flex items-center justify-center rounded-lg border-border bg-background hover:bg-muted hover:text-foreground text-sm font-medium whitespace-nowrap transition-all h-7 gap-1 px-2.5">
                  View League
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
