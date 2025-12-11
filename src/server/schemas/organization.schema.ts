import { z } from "zod";

// ==========================================
// BRANCH SCHEMAS
// ==========================================

/**
 * Schema for creating a branch
 */
export const createBranchSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .nullable(),
});

/**
 * Schema for updating a branch
 */
export const updateBranchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .nullable(),
});

/**
 * Schema for updating organization profile
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(1000).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
