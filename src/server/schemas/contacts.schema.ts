import { z } from "zod";

// ==========================================
// ENUMS
// ==========================================

export const contactTypeSchema = z.enum([
  "customer",
  "vendor",
  "lead",
  "employee",
  "other",
  "contact",
]);

export const entityTypeSchema = z.enum(["business", "individual"]);

export const salutationSchema = z.enum(["Mr", "Mrs", "Ms", "Dr", "Prof", "Mx"]);

export const visibilityScopeSchema = z.enum(["private", "organization"]);

// ==========================================
// INPUT SCHEMAS
// ==========================================

/**
 * Schema for creating a contact
 */
export const createContactSchema = z.object({
  organization_id: z.string().uuid(),
  created_by: z.string().uuid(),
  contact_type: contactTypeSchema.optional().default("contact"),
  entity_type: entityTypeSchema.optional().default("individual"),
  visibility_scope: visibilityScopeSchema.optional().default("organization"),
  owner_user_id: z.string().uuid().optional().nullable(),

  // Individual fields
  salutation: salutationSchema.optional().nullable(),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),

  // Business fields
  company_name: z.string().max(200).optional().nullable(),
  display_name: z.string().min(1).max(200),

  // Contact information
  primary_email: z.string().email().optional().nullable(),
  work_phone: z.string().max(50).optional().nullable(),
  mobile_phone: z.string().max(50).optional().nullable(),
  fax: z.string().max(50).optional().nullable(),
  website: z.string().url().optional().nullable(),

  // Preferences
  language_code: z.string().max(10).optional().default("en"),
  currency_code: z.string().max(10).optional().default("PLN"),
  payment_terms: z.string().max(200).optional().nullable(),

  // Financial
  credit_limit: z.number().optional().nullable(),
  opening_balance: z.number().optional().default(0),
  tax_exempt: z.boolean().optional().default(false),
  tax_registration_number: z.string().max(100).optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional().nullable(),
  company_id_number: z.string().max(100).optional().nullable(),

  // Portal
  portal_enabled: z.boolean().optional().default(false),
  portal_language: z.string().max(10).optional().default("en"),

  // Additional
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.any()).optional(),
});

/**
 * Schema for updating a contact
 */
export const updateContactSchema = createContactSchema.partial().omit({
  organization_id: true,
  created_by: true,
});

/**
 * Schema for filtering contacts
 */
export const contactFiltersSchema = z.object({
  search: z.string().optional(),
  contact_type: contactTypeSchema.optional(),
  entity_type: entityTypeSchema.optional(),
  visibility_scope: visibilityScopeSchema.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

/**
 * Schema for linking contact to business account
 * Only organization-scope contacts can be linked
 */
export const linkContactToBusinessAccountSchema = z.object({
  contact_id: z.string().uuid(),
  business_account_id: z.string().uuid(),
  organization_id: z.string().uuid(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type ContactType = z.infer<typeof contactTypeSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type Salutation = z.infer<typeof salutationSchema>;
export type VisibilityScope = z.infer<typeof visibilityScopeSchema>;

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ContactFilters = z.infer<typeof contactFiltersSchema>;
export type LinkContactToBusinessAccountInput = z.infer<typeof linkContactToBusinessAccountSchema>;
