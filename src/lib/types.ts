export type Role = "ADMIN" | "PLAYER";

export type LeagueStatus = "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "TOP4";

export type Format = "COMMANDER" | "STANDARD" | "MODERN" | "PIONEER" | "PAUPER";

export type DayStatus = "PLANNED" | "COMPLETED";

export type RoundStatus = "PLANNED" | "COMPLETED";

export type TableResult = "PENDING" | "WIN" | "DRAW" | "ABSENT";

export type ChangeType =
  | "INITIAL"
  | "LATE_ENTRY"
  | "BET"
  | "WIN"
  | "DRAW_SHARE"
  | "NO_SHOW"
  | "THREE_PLAYER_BONUS"
  | "FIVE_PLAYER_PENALTY";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  image?: string | null;
  role: Role;
  provider: string;
  createdAt: Date;
}

export interface League {
  id: string;
  name: string;
  description?: string | null;
  format: Format;
  bestOf: number;
  totalDays: number;
  status: LeagueStatus;
  createdBy: string;
  createdAt: Date;
}

export interface LeaguePlayer {
  id: string;
  leagueId: string;
  userId: string;
  points: number;
  joinedAt: Date;
  isActive: boolean;
}

export interface LeagueDay {
  id: string;
  leagueId: string;
  dayNumber: number;
  date: Date;
  status: DayStatus;
}

export interface Round {
  id: string;
  leagueDayId: string;
  roundNumber: number;
  status: RoundStatus;
}

export interface Table {
  id: string;
  roundId: string;
  tableNumber: number;
}

export interface TablePlayer {
  id: string;
  tableId: string;
  leaguePlayerId: string;
  seatPosition: number;
  result: TableResult;
  pointsWagered: number;
  pointsChange: number;
}

export interface PlayerPointChange {
  id: string;
  leaguePlayerId: string;
  roundId?: string | null;
  type: ChangeType;
  amount: number;
  description?: string | null;
  createdAt: Date;
}

export interface StandingEntry {
  leaguePlayerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  roundsPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface RoundResult {
  tableId: string;
  tableNumber: number;
  playerCount: number;
  results: {
    leaguePlayerId: string;
    userName: string;
    seatPosition: number;
    pointsBefore: number;
    pointsWagered: number;
    result: TableResult;
    pointsChange: number;
    pointsAfter: number;
  }[];
}
