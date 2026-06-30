export type Role = "ADMIN" | "PLAYER";

export type LeagueStatus = "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "TOP4";

export type Format = "COMMANDER" | "COMMANDER_PRECONS" | "CEDH" | "STANDARD" | "MODERN" | "PIONEER" | "PAUPER";

export type ScoringSystem = "POINTS" | "TRADITIONAL";

export function isCommanderFormat(format: string): boolean {
  return format === "COMMANDER" || format === "COMMANDER_PRECONS" || format === "CEDH";
}

export function formatDisplayName(format: string): string {
  switch (format) {
    case "COMMANDER": return "Commander";
    case "COMMANDER_PRECONS": return "Commander - Precons";
    case "CEDH": return "Commander - cEDH";
    case "STANDARD": return "Standard";
    case "MODERN": return "Modern";
    case "PIONEER": return "Pioneer";
    case "PAUPER": return "Pauper";
    default: return format;
  }
}

export function scoringDisplayName(scoring: string): string {
  switch (scoring) {
    case "POINTS": return "Bet League";
    case "TRADITIONAL": return "Traditional";
    default: return scoring;
  }
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "Unknown";
}

export type DayStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

export type RoundStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

export type TableResult = "PENDING" | "WIN" | "DRAW" | "LOSS";

export type ChangeType =
  | "INITIAL"
  | "LATE_ENTRY"
  | "BET"
  | "WIN"
  | "DRAW_SHARE"
  | "LOSS"
  | "ABSENT"
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
  roundsPerDay: number;
  weekday: number;
  scoringSystem: ScoringSystem;
  hasFinalPhase: boolean;
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
  matchPoints: number;
  roundsPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  penalties: number;
  omwPercentage?: number;
  gwPercentage?: number;
  ogwPercentage?: number;
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
