import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const uuidSchema = z.string().uuid();

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const sortSchema = z.object({
  field: z.string(),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
export type Sort = z.infer<typeof sortSchema>;
