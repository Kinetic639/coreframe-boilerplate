import { z } from "zod";

export const QrTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const QrScanLogSchema = z.object({
  token: z.string().min(1),
  scanType: z.enum(["redirect", "lookup"]),
  scannerType: z.enum(["manual", "link", "app"]).default("manual"),
  scanResult: z.enum(["success", "failure"]).default("success"),
  organizationId: z.string().uuid().nullable(),
  branchId: z.string().uuid().nullable(),
});

export type QrTokenInput = z.infer<typeof QrTokenSchema>;
export type QrScanLogInput = z.infer<typeof QrScanLogSchema>;

export type QrEntityType = "product" | "location";

export const QrLabelEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
});

export type QrLabelEntity = z.infer<typeof QrLabelEntitySchema>;
