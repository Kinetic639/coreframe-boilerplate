import { z } from "zod";

export const supplierSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  industry: z.string().trim().min(1).max(80).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  vmiReadyOnly: z.coerce.boolean().optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(50).optional()
});

export const partnershipRequestInputSchema = z.object({
  supplierId: z.string().min(1).max(80),
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(6).max(40).optional(),
  city: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10).max(2000),
  requestedCapabilities: z.array(z.string().trim().min(1).max(80)).max(12).default([])
});

export const productSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  vendorId: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  brand: z.string().trim().min(1).max(80).optional(),
  availability: z
    .enum(["Dostępny", "Ograniczona dostępność", "Na zamówienie", "Zapytaj o dostępność"])
    .optional(),
  priceMode: z.enum(["exact", "from", "range", "on_request", "after_login"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export const marketplaceListQuerySchema = z.object({
  vendorId: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export const quotationRequestInputSchema = z.object({
  vendorId: z.string().min(1).max(80),
  clientName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(6).max(40).optional(),
  nip: z.string().trim().min(6).max(32).optional(),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(2).max(20),
  deliveryAddress: z.string().trim().min(2).max(240).optional(),
  businessType: z.string().trim().min(2).max(80),
  contactPreference: z.string().trim().min(2).max(80),
  expectedDeliveryDate: z.string().trim().min(4).max(40),
  message: z.string().trim().min(10).max(2000),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(80),
        quantity: z.coerce.number().positive().max(999999),
        unit: z.enum(["szt", "paczka"]),
        note: z.string().trim().max(500).default(""),
        allowSubstitutes: z.coerce.boolean()
      })
    )
    .min(1)
    .max(100)
});
