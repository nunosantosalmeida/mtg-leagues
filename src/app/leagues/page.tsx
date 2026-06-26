"use client";

import { useSession } from "next-auth/react";
import { LeagueList } from "@/components/leagues/LeagueList";
import Link from "next/link";

export default function LeaguesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Leagues</h1>
          <p className="text-muted-foreground">Browse and join MTG leagues</p>
        </div>
        {isAdmin && (
          <Link href="/leagues/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 text-sm font-medium whitespace-nowrap transition-all h-8 gap-1.5 px-2.5">
            Create League
          </Link>
        )}
      </div>
      <LeagueList />
    </div>
  );
}
