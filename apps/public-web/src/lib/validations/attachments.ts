import { z } from "zod";

export const MAX_ATTACHMENT_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_ATTACHMENT_BATCH_SIZE = 10;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

export const attachmentTargetSchema = z.object({
  targetType: z.string().trim().min(1).max(120),
  targetId: z.string().uuid(),
});

export const listAttachmentsSchema = attachmentTargetSchema;

const fileLikeSchema = z.custom<File>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "type" in value
);

export const uploadAttachmentsSchema = attachmentTargetSchema.extend({
  files: z.array(fileLikeSchema).min(1).max(MAX_ATTACHMENT_BATCH_SIZE),
});

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
});

export type ListAttachmentsInput = z.infer<typeof listAttachmentsSchema>;
export type UploadAttachmentsInput = z.infer<typeof uploadAttachmentsSchema>;
export type DeleteAttachmentInput = z.infer<typeof deleteAttachmentSchema>;

export function isAllowedAttachmentMimeType(value: string): value is AttachmentMimeType {
  return ALLOWED_ATTACHMENT_MIME_TYPES.includes(value as AttachmentMimeType);
}
