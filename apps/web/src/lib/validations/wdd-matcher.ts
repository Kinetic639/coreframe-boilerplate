import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// "auto" means the server will detect the role from the PDF content
export const fileRoleSchema = z.enum(["bc", "brand", "auto"]);
export type FileRole = z.infer<typeof fileRoleSchema>;

export const sessionStatusSchema = z.enum([
  "pending",
  "processing",
  "ready_for_review",
  "approved",
  "rejected",
  "failed",
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const blockMatchTypeSchema = z.enum([
  "exact",
  "subset",
  "partial",
  "ambiguous",
  "unmatched_bc",
  "unmatched_brand",
]);
export type BlockMatchType = z.infer<typeof blockMatchTypeSchema>;

export const lineMatchTypeSchema = z.enum(["exact", "partial", "unmatched_bc", "unmatched_brand"]);
export type LineMatchType = z.infer<typeof lineMatchTypeSchema>;

export const reviewStatusSchema = z.enum(["pending", "approved", "rejected", "skipped"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

// ---------------------------------------------------------------------------
// Action input schemas
// ---------------------------------------------------------------------------

export const createSessionSchema = z.object({
  name: z.string().min(1, "Session name is required").max(200),
  branchId: z.string().uuid().optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const uploadFileSchema = z.object({
  sessionId: z.string().uuid(),
  fileRole: fileRoleSchema,
  brandLabel: z.string().max(100).optional(),
});
export type UploadFileInput = z.infer<typeof uploadFileSchema>;

export const runParseSchema = z.object({
  sessionFileId: z.string().uuid(),
});
export type RunParseInput = z.infer<typeof runParseSchema>;

export const runBlockMatchingSchema = z.object({
  sessionId: z.string().uuid(),
});
export type RunBlockMatchingInput = z.infer<typeof runBlockMatchingSchema>;

export const runLineMatchingSchema = z.object({
  blockMatchId: z.string().uuid(),
});
export type RunLineMatchingInput = z.infer<typeof runLineMatchingSchema>;

export const reviewBlockMatchSchema = z.object({
  blockMatchId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "skipped"]),
  notes: z.string().max(1000).optional(),
});
export type ReviewBlockMatchInput = z.infer<typeof reviewBlockMatchSchema>;

export const reviewLineMatchSchema = z.object({
  lineMatchId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "skipped"]),
  notes: z.string().max(1000).optional(),
});
export type ReviewLineMatchInput = z.infer<typeof reviewLineMatchSchema>;

export const bulkApproveExactLinesSchema = z.object({
  blockMatchId: z.string().uuid(),
});
export type BulkApproveExactLinesInput = z.infer<typeof bulkApproveExactLinesSchema>;

export const approveSessionSchema = z.object({
  sessionId: z.string().uuid(),
});
export type ApproveSessionInput = z.infer<typeof approveSessionSchema>;

export const exportCsvSchema = z.object({
  sessionId: z.string().uuid(),
});
export type ExportCsvInput = z.infer<typeof exportCsvSchema>;
