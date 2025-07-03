// app/dashboard/organization/profile/schema.ts
import * as z from "zod";

export const organizationSchema = z.object({
  organization_id: z.string(),
  name: z.string().min(1),
  name_2: z.string().optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
  logo_url: z.string().url().optional().or(z.literal("")),
  theme_color: z.string().min(1),
  font_color: z.string().min(1),
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;
