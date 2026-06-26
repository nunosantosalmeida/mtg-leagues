"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JoinLeagueButtonProps {
  leagueId: string;
  leagueStatus: string;
  playerCount: number;
  onJoined?: () => void;
}

export function JoinLeagueButton({ leagueId, leagueStatus, playerCount, onJoined }: JoinLeagueButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  const canJoin = session && leagueStatus === "REGISTRATION" && !joined;

  async function handleJoin() {
    if (!session) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/join`, {
        method: "POST",
      });

      if (response.ok) {
        setJoined(true);
        onJoined?.();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to join league");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (joined) {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Joined</Badge>;
  }

  if (!session) {
    return (
      <Button onClick={() => router.push("/login")} variant="outline">
        Sign in to Join
      </Button>
    );
  }

  if (leagueStatus !== "REGISTRATION") {
    return null;
  }

  return (
    <Button onClick={handleJoin} disabled={loading}>
      {loading ? "Joining..." : `Join League (${playerCount} players)`}
    </Button>
  );
}
