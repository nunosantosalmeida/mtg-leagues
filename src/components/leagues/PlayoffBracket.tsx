"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Users } from "lucide-react";
import { isCommanderFormat } from "@/lib/types";

interface BracketPlayer {
  seed: number;
  name: string;
  points: number;
}

interface BracketMatch {
  round: number;
  matchNumber: number;
  seed1: number;
  seed2: number;
  playerName1: string | null;
  playerName2: string | null;
  winner1: boolean;
  winner2: boolean;
  result1: string | null;
  result2: string | null;
}

interface PodAssignment {
  podNumber: number;
  players: BracketPlayer[];
}

interface BracketData {
  matches: BracketMatch[];
  pods: PodAssignment[];
  byes: BracketPlayer[];
  totalRounds: number;
  format: string;
}

function SeedBadge({ seed, isWinner }: { seed: number; isWinner: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isWinner ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
      {seed}
    </span>
  );
}

function MatchCard({ match, is1v1 }: { match: BracketMatch; is1v1: boolean }) {
  const hasPlayer1 = match.playerName1 !== null;
  const hasPlayer2 = match.playerName2 !== null;

  return (
    <div className="border rounded-lg bg-background shadow-sm min-w-[180px]">
      <div className="border-b px-3 py-1.5 bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">
          {is1v1 ? `Match ${match.matchNumber}` : `Pod ${match.matchNumber}`}
        </span>
      </div>
      <div className="divide-y">
        {hasPlayer1 ? (
          <div className={`flex items-center gap-2 px-3 py-2 ${match.winner1 ? 'bg-primary/10' : ''}`}>
            <SeedBadge seed={match.seed1} isWinner={match.winner1} />
            <span className={`text-sm flex-1 ${match.winner1 ? 'font-semibold' : ''}`}>
              {match.playerName1}
            </span>
            {match.result1 && (
              <Badge variant={match.result1 === 'WIN' ? 'default' : match.result1 === 'DRAW' ? 'secondary' : 'destructive'} className="text-[10px]">
                {match.result1}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
            <SeedBadge seed={match.seed1} isWinner={false} />
            <span className="text-sm italic">TBD</span>
          </div>
        )}
        {hasPlayer2 ? (
          <div className={`flex items-center gap-2 px-3 py-2 ${match.winner2 ? 'bg-primary/10' : ''}`}>
            <SeedBadge seed={match.seed2} isWinner={match.winner2} />
            <span className={`text-sm flex-1 ${match.winner2 ? 'font-semibold' : ''}`}>
              {match.playerName2}
            </span>
            {match.result2 && (
              <Badge variant={match.result2 === 'WIN' ? 'default' : match.result2 === 'DRAW' ? 'secondary' : 'destructive'} className="text-[10px]">
                {match.result2}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
            <SeedBadge seed={match.seed2} isWinner={false} />
            <span className="text-sm italic">TBD</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PodCard({ pod, matches, allMatches }: { pod: PodAssignment; matches: BracketMatch[]; allMatches: BracketMatch[] }) {
  return (
    <div className="border rounded-lg bg-background shadow-sm">
      <div className="border-b px-3 py-2 bg-muted/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="text-sm font-semibold">Pod {pod.podNumber}</span>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="space-y-1">
          {pod.players.map((player) => (
            <div key={player.seed} className="flex items-center gap-2 text-sm">
              <SeedBadge seed={player.seed} isWinner={false} />
              <span className="flex-1">{player.name}</span>
              <span className="text-muted-foreground text-xs">{player.points} pts</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-2 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Matches</span>
          {matches.map((match, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {match.playerName1} vs {match.playerName2}
              </span>
              {match.winner1 && <Badge variant="default" className="text-[10px]">{match.playerName1} W</Badge>}
              {match.winner2 && <Badge variant="default" className="text-[10px]">{match.playerName2} W</Badge>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bracket1v1({ data }: { data: BracketData }) {
  const rounds: BracketMatch[][] = [];
  for (let i = 1; i <= data.totalRounds; i++) {
    rounds.push(data.matches.filter(m => m.round === i));
  }

  const roundNames = ['Quarterfinals', 'Semifinals', 'Final', 'Champion'];
  const displayRounds = rounds.slice(-3);
  const startRound = data.totalRounds - displayRounds.length + 1;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-start gap-8 min-w-max">
        {displayRounds.map((roundMatches, roundIdx) => {
          const actualRound = startRound + roundIdx;
          const isLastRound = roundIdx === displayRounds.length - 1;

          return (
            <div key={actualRound} className="flex flex-col items-center gap-4">
              <div className="text-center mb-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  {roundNames[roundIdx] || `Round ${actualRound}`}
                </span>
              </div>
              <div className="flex flex-col gap-4" style={{ marginTop: roundIdx * 40 }}>
                {roundMatches.map((match) => (
                  <MatchCard key={`${match.round}-${match.matchNumber}`} match={match} is1v1={true} />
                ))}
              </div>
              {!isLastRound && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 border-t-2 border-muted-foreground/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketCommander({ data }: { data: BracketData }) {
  const hasSemis = data.pods.length > 0;
  const finalsMatch = data.matches.find(m => m.round === 2);

  return (
    <div className="space-y-8">
      {hasSemis && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Medal className="h-5 w-5" />
            Semifinals
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.pods.map((pod) => {
              const podMatches = data.matches.filter(m => m.round === 1 && Math.floor((m.matchNumber - 1) / 10) === pod.podNumber - 1);
              return (
                <PodCard key={pod.podNumber} pod={pod} matches={podMatches} allMatches={data.matches} />
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Finals
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {data.byes.length > 0 && (
            <div className="border rounded-lg bg-background shadow-sm">
              <div className="border-b px-3 py-2 bg-muted/50">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="text-sm font-semibold">Finals Table</span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {data.byes.map((player) => (
                  <div key={player.seed} className="flex items-center gap-2 text-sm">
                    <SeedBadge seed={player.seed} isWinner={false} />
                    <span className="flex-1">{player.name}</span>
                    <span className="text-muted-foreground text-xs">{player.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {finalsMatch && (
            <MatchCard match={finalsMatch} is1v1={false} />
          )}
        </div>
      </div>

      {data.byes.length === 0 && !finalsMatch && (
        <div className="text-center text-muted-foreground py-8">
          <p>Finals not yet determined</p>
          <p className="text-sm">Complete the semifinals to determine the finalists</p>
        </div>
      )}
    </div>
  );
}

export function PlayoffBracket({ data }: { data: BracketData }) {
  if (!data || (data.matches.length === 0 && data.pods.length === 0 && data.byes.length === 0)) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p>No bracket data available</p>
      </div>
    );
  }

  const is1v1 = !isCommanderFormat(data.format);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5" />
        <h2 className="text-xl font-bold">
          {is1v1 ? 'Tournament Bracket' : 'Commander Playoff'}
        </h2>
      </div>

      {is1v1 ? (
        <Bracket1v1 data={data} />
      ) : (
        <BracketCommander data={data} />
      )}
    </div>
  );
}
