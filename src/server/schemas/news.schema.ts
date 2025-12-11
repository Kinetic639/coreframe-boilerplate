import { z } from "zod";

// ==========================================
// ENUMS
// ==========================================

export const newsPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const newsBadgeSchema = z.enum([
  "new",
  "important",
  "update",
  "announcement",
  "feature",
  "bugfix",
]);

// ==========================================
// INPUT SCHEMAS
// ==========================================

/**
 * Schema for creating a news post
 */
export const createNewsPostSchema = z.object({
  organization_id: z.string().uuid(),
  author_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1), // Lexical JSON string
  excerpt: z.string().max(500).optional().nullable(),
  priority: newsPrioritySchema.optional().default("medium"),
  badges: z.array(newsBadgeSchema).optional().default([]),
  branch_id: z.string().uuid().optional().nullable(),
});

/**
 * Schema for updating a news post
 */
export const updateNewsPostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(), // Lexical JSON string
  excerpt: z.string().max(500).optional().nullable(),
  priority: newsPrioritySchema.optional(),
  badges: z.array(newsBadgeSchema).optional(),
});

/**
 * Schema for filtering news posts
 */
export const newsFiltersSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
  priority: newsPrioritySchema.optional(),
  author_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type NewsPriority = z.infer<typeof newsPrioritySchema>;
export type NewsBadge = z.infer<typeof newsBadgeSchema>;

export type CreateNewsPostInput = z.infer<typeof createNewsPostSchema>;
export type UpdateNewsPostInput = z.infer<typeof updateNewsPostSchema>;
export type NewsFilters = z.infer<typeof newsFiltersSchema>;
