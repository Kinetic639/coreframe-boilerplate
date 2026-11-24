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

/**
 * The file inputs' accept list: photos by kind (image/*) plus the other allowed
 * files by type. Listing only exact image types makes some Android phones open
 * a plain file browser without the gallery; image/* lets them offer the gallery
 * and the camera. Files of a type that is not allowed are still refused on pick.
 */
export const ATTACHMENT_INPUT_ACCEPT = [
  "image/*",
  ...ALLOWED_ATTACHMENT_MIME_TYPES.filter((type) => !type.startsWith("image/")),
].join(",");

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

/** Files the browser uploaded straight to storage, to be recorded on a target. */
export const registerAttachmentsSchema = attachmentTargetSchema.extend({
  files: z
    .array(
      z.object({
        storagePath: z.string().min(1).max(300),
        fileName: z.string().trim().min(1).max(255),
        contentType: z.string().min(1).max(120),
        size: z.number().int().positive().max(MAX_ATTACHMENT_FILE_SIZE),
        /** Pixel size of an image and its small versions, uploaded next to it. */
        image: z
          .object({
            width: z.number().int().positive().max(20000),
            height: z.number().int().positive().max(20000),
            variants: z
              .array(
                z.object({
                  name: z.enum(["thumb", "card"]),
                  path: z.string().min(1).max(300),
                  width: z.number().int().positive().max(4096),
                  height: z.number().int().positive().max(4096),
                  size: z.number().int().positive().max(MAX_ATTACHMENT_FILE_SIZE),
                  contentType: z.enum(["image/webp", "image/jpeg"]),
                })
              )
              .max(2),
          })
          .optional(),
      })
    )
    .min(1)
    .max(MAX_ATTACHMENT_BATCH_SIZE),
});

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
});

export type ListAttachmentsInput = z.infer<typeof listAttachmentsSchema>;
export type UploadAttachmentsInput = z.infer<typeof uploadAttachmentsSchema>;
export type RegisterAttachmentsInput = z.infer<typeof registerAttachmentsSchema>;
export type DeleteAttachmentInput = z.infer<typeof deleteAttachmentSchema>;

export function isAllowedAttachmentMimeType(value: string): value is AttachmentMimeType {
  return ALLOWED_ATTACHMENT_MIME_TYPES.includes(value as AttachmentMimeType);
}
