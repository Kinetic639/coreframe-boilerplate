// app/dashboard/organization/profile/schema.ts
import * as z from "zod";

export const organizationSchema = z.object({
  organization_id: z.string(),
  // Required fields
  name: z.string().min(1, "Organization name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),

  // Optional fields - use nullable() for better handling
  name_2: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val || null),
  bio: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .nullable()
    .optional()
    .transform((val) => val || null),
  website: z
    .union([z.string().url("Must be a valid URL"), z.literal(""), z.null(), z.undefined()])
    .nullable()
    .optional()
    .transform((val) => val || null),
  logo_url: z
    .union([z.string().url("Must be a valid URL"), z.literal(""), z.null(), z.undefined()])
    .nullable()
    .optional()
    .transform((val) => val || null),
  theme_color: z
    .union([
      z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .nullable()
    .optional()
    .transform((val) => val || null),
  font_color: z
    .union([
      z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .nullable()
    .optional()
    .transform((val) => val || null),
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;
