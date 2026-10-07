import { z } from "zod";

/** Shared by server actions (authoritative) and forms (input hints). */
export const LIMITS = {
  titleMin: 3,
  titleMax: 200,
  bodyMax: 5000,
  maxFiles: 10,
} as const;

export const orderNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{3,8}$/, "orderNumber");
export const warehouseSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "warehouse");

export const createRequestSchema = z
  .object({
    branchId: z.string().uuid("branchId"),
    typeId: z.string().uuid("typeId"),
    title: z.string().trim().min(LIMITS.titleMin, "title").max(LIMITS.titleMax, "title"),
    description: z.string().trim().max(LIMITS.bodyMax).optional(),
    orderNumber: orderNumberSchema.optional().or(z.literal("")),
    warehouse: warehouseSchema.optional().or(z.literal("")),
  })
  .refine((v) => !v.orderNumber || !!v.warehouse, { path: ["warehouse"], message: "warehouse" })
  .refine((v) => !v.warehouse || !!v.orderNumber, {
    path: ["orderNumber"],
    message: "orderNumber",
  });

export const commentSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().max(LIMITS.bodyMax),
  /** JSON of the Tiptap document from the shared editor (optional; plain text otherwise). */
  bodyRich: z.string().max(200_000).optional(),
});
