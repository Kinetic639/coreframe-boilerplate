import { z } from "zod";

const uuidSchema = z.string().uuid();
const nullableTextSchema = z.string().trim().max(1000).optional().nullable();
const shortTextSchema = z.string().trim().min(1).max(160);
const optionalShortTextSchema = z.string().trim().max(160).optional().nullable();
const positiveQuantitySchema = z.coerce.number().positive().max(999999999);
const nonNegativeQuantitySchema = z.coerce.number().min(0).max(999999999);

export const vmiClientAccountCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientPartyId: uuidSchema.optional().nullable(),
  displayName: shortTextSchema,
  legalName: optionalShortTextSchema,
  taxId: optionalShortTextSchema,
  email: z.string().trim().email().max(160).optional().nullable(),
  phone: optionalShortTextSchema,
  website: optionalShortTextSchema,
  notes: nullableTextSchema,
});

export const vmiClientAccountUpdateSchema = vmiClientAccountCreateSchema
  .omit({ vendorOrganizationId: true })
  .partial()
  .extend({
    id: uuidSchema,
    status: z.enum(["pending", "active", "suspended", "archived"]).optional(),
  });

export const vmiClientInvitationCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema,
  email: z.string().trim().email().max(160),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
  expiresAt: z.string().datetime(),
});

export const vmiClientLocationCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema,
  name: shortTextSchema,
  locationCode: optionalShortTextSchema,
  addressLine1: optionalShortTextSchema,
  addressLine2: optionalShortTextSchema,
  city: optionalShortTextSchema,
  postalCode: optionalShortTextSchema,
  region: optionalShortTextSchema,
  country: z.string().trim().min(2).max(2).default("PL"),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export const vmiClientLocationUpdateSchema = vmiClientLocationCreateSchema
  .omit({ vendorOrganizationId: true, clientAccountId: true })
  .partial()
  .extend({
    id: uuidSchema,
    status: z.enum(["active", "inactive", "archived"]).optional(),
  });

export const vmiCatalogExposureCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema.optional().nullable(),
  itemId: uuidSchema,
  supplierPartyId: uuidSchema.optional().nullable(),
  itemSupplierId: uuidSchema.optional().nullable(),
  visibilityScope: z.enum(["public", "client"]).default("client"),
  priceMode: z.enum(["hidden", "visible", "request_only"]).default("hidden"),
});

export const vmiInventoryItemCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema,
  clientLocationId: uuidSchema,
  catalogExposureId: uuidSchema.optional().nullable(),
  itemId: uuidSchema.optional().nullable(),
  clientSku: optionalShortTextSchema,
  displayName: shortTextSchema,
  unit: optionalShortTextSchema,
  currentQuantity: nonNegativeQuantitySchema.default(0),
  minimumQuantity: nonNegativeQuantitySchema.optional().nullable(),
  maximumQuantity: nonNegativeQuantitySchema.optional().nullable(),
  reorderQuantity: nonNegativeQuantitySchema.optional().nullable(),
});

export const vmiInventoryItemUpdateSchema = vmiInventoryItemCreateSchema
  .omit({ vendorOrganizationId: true, clientAccountId: true, clientLocationId: true })
  .partial()
  .extend({
    id: uuidSchema,
    status: z.enum(["active", "inactive", "archived"]).optional(),
  });

export const vmiStockCountSubmitSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema,
  clientLocationId: uuidSchema.optional().nullable(),
  notes: nullableTextSchema,
  lines: z
    .array(
      z.object({
        inventoryItemId: uuidSchema,
        expectedQuantity: nonNegativeQuantitySchema.optional().nullable(),
        countedQuantity: nonNegativeQuantitySchema,
        notes: nullableTextSchema,
      }),
    )
    .min(1)
    .max(500),
});

export const vmiProposalCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema,
  clientLocationId: uuidSchema.optional().nullable(),
  currencyCode: z.string().trim().length(3).default("PLN"),
  notes: nullableTextSchema,
  lines: z
    .array(
      z.object({
        inventoryItemId: uuidSchema.optional().nullable(),
        itemId: uuidSchema.optional().nullable(),
        description: shortTextSchema,
        quantity: positiveQuantitySchema,
        unitPrice: nonNegativeQuantitySchema.optional().nullable(),
        currencyCode: z.string().trim().length(3).default("PLN"),
      }),
    )
    .min(1)
    .max(500),
});

export const vmiOrderCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema,
  clientLocationId: uuidSchema.optional().nullable(),
  proposalId: uuidSchema.optional().nullable(),
  currencyCode: z.string().trim().length(3).default("PLN"),
  notes: nullableTextSchema,
  lines: z
    .array(
      z.object({
        itemId: uuidSchema.optional().nullable(),
        description: shortTextSchema,
        quantity: positiveQuantitySchema,
        unitPrice: nonNegativeQuantitySchema.optional().nullable(),
        currencyCode: z.string().trim().length(3).default("PLN"),
      }),
    )
    .min(1)
    .max(500),
});

export const vmiMessageCreateSchema = z.object({
  vendorOrganizationId: uuidSchema,
  clientAccountId: uuidSchema,
  threadId: uuidSchema.optional(),
  subject: z.string().trim().min(1).max(240).optional(),
  senderKind: z.enum(["vendor", "client"]),
  body: z.string().trim().min(1).max(5000),
});

export type VmiClientAccountCreateInput = z.infer<typeof vmiClientAccountCreateSchema>;
export type VmiClientAccountUpdateInput = z.infer<typeof vmiClientAccountUpdateSchema>;
export type VmiClientInvitationCreateInput = z.infer<typeof vmiClientInvitationCreateSchema>;
export type VmiClientLocationCreateInput = z.infer<typeof vmiClientLocationCreateSchema>;
export type VmiClientLocationUpdateInput = z.infer<typeof vmiClientLocationUpdateSchema>;
export type VmiCatalogExposureCreateInput = z.infer<typeof vmiCatalogExposureCreateSchema>;
export type VmiInventoryItemCreateInput = z.infer<typeof vmiInventoryItemCreateSchema>;
export type VmiInventoryItemUpdateInput = z.infer<typeof vmiInventoryItemUpdateSchema>;
export type VmiStockCountSubmitInput = z.infer<typeof vmiStockCountSubmitSchema>;
export type VmiProposalCreateInput = z.infer<typeof vmiProposalCreateSchema>;
export type VmiOrderCreateInput = z.infer<typeof vmiOrderCreateSchema>;
export type VmiMessageCreateInput = z.infer<typeof vmiMessageCreateSchema>;
