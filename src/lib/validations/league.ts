import { z } from "zod";

export const createLeagueSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  format: z.enum(["COMMANDER", "STANDARD", "MODERN", "PIONEER", "PAUPER"]),
  bestOf: z.coerce.number().min(1).max(5).default(1),
  totalDays: z.coerce.number().min(1).max(20).default(5),
});

export const joinLeagueSchema = z.object({
  leagueId: z.string(),
});

export const updateLeagueSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["REGISTRATION", "IN_PROGRESS", "COMPLETED", "TOP4"]).optional(),
});
