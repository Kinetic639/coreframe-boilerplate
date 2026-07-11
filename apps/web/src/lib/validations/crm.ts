import { z } from "zod";

export const crmPartyKindSchema = z.enum(["organization", "individual"]);
export const crmPartyStatusSchema = z.enum(["active", "inactive", "archived"]);
export const crmPartyRoleSchema = z.enum([
  "supplier",
  "client",
  "contractor",
  "vendor",
  "partner",
  "receiver",
  "payer",
  "other",
]);
export const crmContactVisibilitySchema = z.enum(["private", "branch", "organization"]);
export const crmPartyContactRelationshipSchema = z.enum([
  "primary",
  "billing",
  "sales",
  "technical",
  "owner",
  "representative",
  "other",
]);
export const crmPartyAddressTypeSchema = z.enum([
  "registered",
  "billing",
  "shipping",
  "correspondence",
  "other",
]);

const optionalTrimmed = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

export const createCrmPartySchema = z.object({
  party_kind: crmPartyKindSchema.default("organization"),
  display_name: z.string().trim().min(1).max(300),
  legal_name: optionalTrimmed,
  tax_id: optionalTrimmed,
  vat_id: optionalTrimmed,
  regon: optionalTrimmed,
  krs: optionalTrimmed,
  email: optionalTrimmed,
  phone: optionalTrimmed,
  website: optionalTrimmed,
  logo_storage_path: optionalTrimmed,
  status: crmPartyStatusSchema.default("active"),
  notes: optionalTrimmed,
  roles: z.array(crmPartyRoleSchema).min(1).default(["client"]),
});

export const updateCrmPartySchema = createCrmPartySchema
  .omit({ roles: true })
  .partial()
  .extend({
    id: z.string().uuid(),
    roles: z.array(crmPartyRoleSchema).min(1).optional(),
  });

export const createCrmContactSchema = z.object({
  linked_user_id: z.string().uuid().nullable().optional(),
  visibility_scope: crmContactVisibilitySchema.default("organization"),
  owner_user_id: z.string().uuid().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  first_name: optionalTrimmed,
  last_name: optionalTrimmed,
  display_name: z.string().trim().min(1).max(300),
  email: optionalTrimmed,
  phone: optionalTrimmed,
  mobile: optionalTrimmed,
  avatar_storage_path: optionalTrimmed,
  job_title: optionalTrimmed,
  notes: optionalTrimmed,
});

export const updateCrmContactSchema = createCrmContactSchema.partial().extend({
  id: z.string().uuid(),
});

export const linkCrmPartyContactSchema = z.object({
  party_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  relationship_type: crmPartyContactRelationshipSchema.default("primary"),
  is_primary: z.boolean().default(false),
  notes: optionalTrimmed,
});

export const createCrmPartyAddressSchema = z.object({
  party_id: z.string().uuid(),
  address_type: crmPartyAddressTypeSchema.default("registered"),
  is_default: z.boolean().default(false),
  country: optionalTrimmed,
  city: optionalTrimmed,
  postal_code: optionalTrimmed,
  street: optionalTrimmed,
  building_number: optionalTrimmed,
  unit_number: optionalTrimmed,
  region: optionalTrimmed,
});

export const createWarehouseItemSupplierSchema = z.object({
  item_id: z.string().uuid(),
  party_id: z.string().uuid(),
  is_primary: z.boolean().default(false),
  supplier_sku: optionalTrimmed,
  lead_time_days: z.number().int().nonnegative().nullable().optional(),
  minimum_order_quantity: z.number().nonnegative().nullable().optional(),
  purchase_price: z.number().nonnegative().nullable().optional(),
  currency_code: optionalTrimmed,
});

export type CreateCrmPartyInput = z.infer<typeof createCrmPartySchema>;
export type UpdateCrmPartyInput = z.infer<typeof updateCrmPartySchema>;
export type CreateCrmContactInput = z.infer<typeof createCrmContactSchema>;
export type UpdateCrmContactInput = z.infer<typeof updateCrmContactSchema>;
export type LinkCrmPartyContactInput = z.infer<typeof linkCrmPartyContactSchema>;
export type CreateCrmPartyAddressInput = z.infer<typeof createCrmPartyAddressSchema>;
export type CreateWarehouseItemSupplierInput = z.infer<typeof createWarehouseItemSupplierSchema>;
export type CrmPartyRole = z.infer<typeof crmPartyRoleSchema>;
export type CrmContactVisibility = z.infer<typeof crmContactVisibilitySchema>;
