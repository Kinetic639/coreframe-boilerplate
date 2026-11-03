import { z } from "zod";

/**
 * Platform feedback: bugs, problems and ideas reported from any organization
 * to the platform admin (migration 20261103150000_platform_feedback).
 */

export const FEEDBACK_KINDS = ["bug", "problem", "idea"] as const;
export const FEEDBACK_STATUSES = ["new", "in_progress", "resolved", "rejected"] as const;
export const FEEDBACK_PRIORITIES = ["low", "normal", "high", "critical"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

/** Same limits as the "platform-feedback" storage bucket */
export const FEEDBACK_MAX_FILE_SIZE = 25 * 1024 * 1024;
export const FEEDBACK_MAX_FILES = 10;
export const FEEDBACK_ALLOWED_MIME_TYPES = [
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
  "video/mp4",
  "video/webm",
] as const;

export function isAllowedFeedbackFile(file: { type: string; size: number }): boolean {
  return (
    (FEEDBACK_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type) &&
    file.size > 0 &&
    file.size <= FEEDBACK_MAX_FILE_SIZE
  );
}

/** A file the browser uploaded into "platform-feedback/<report id>/" */
export interface UploadedFeedbackFile {
  path: string;
  name: string;
  type: string;
  size: number;
}

export const uploadedFeedbackFilesSchema = z
  .array(
    z.object({
      path: z.string().min(1).max(500),
      name: z.string().min(1).max(255),
      type: z.string().min(1).max(200),
      size: z.number().int().positive(),
    })
  )
  .max(FEEDBACK_MAX_FILES);

/** Where the report was made; collected in the browser, never typed by the user */
export type FeedbackContext = {
  url?: string;
  path?: string;
  userAgent?: string;
  language?: string;
  viewport?: string;
  appVersion?: string | null;
  environment?: string | null;
};

export interface FeedbackPerson {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
}

export interface FeedbackListRow {
  id: string;
  number: number;
  code: string;
  kind: FeedbackKind;
  title: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  created_at: string;
  last_activity_at: string;
  reporter_name: string | null;
  reporter_email: string | null;
  organization_name: string | null;
  message_count: number;
  attachment_count: number;
}

export interface FeedbackAttachment {
  id: string;
  message_id: string | null;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  url: string | null;
}

export interface FeedbackMessage {
  id: string;
  body_rich: unknown;
  body_plain: string;
  is_internal: boolean;
  created_at: string;
  author: FeedbackPerson | null;
}

export interface FeedbackDetail {
  id: string;
  number: number;
  code: string;
  kind: FeedbackKind;
  title: string;
  body_rich: unknown;
  body_plain: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  created_at: string;
  resolved_at: string | null;
  context: FeedbackContext;
  reporter: FeedbackPerson | null;
  organization_name: string | null;
  branch_name: string | null;
  messages: FeedbackMessage[];
  attachments: FeedbackAttachment[];
}

export const createFeedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  title: z.string().trim().min(1).max(200),
  bodyPlain: z.string().max(20000),
  bodyRich: z.unknown().nullable(),
  context: z
    .object({
      url: z.string().max(2000).optional(),
      path: z.string().max(1000).optional(),
      userAgent: z.string().max(500).optional(),
      language: z.string().max(50).optional(),
      viewport: z.string().max(50).optional(),
    })
    .default({}),
});

export const addFeedbackMessageSchema = z.object({
  feedbackId: z.string().uuid(),
  bodyPlain: z.string().trim().min(1).max(20000),
  bodyRich: z.unknown().nullable(),
  isInternal: z.boolean().default(false),
});

export const updateFeedbackSchema = z
  .object({
    feedbackId: z.string().uuid(),
    status: z.enum(FEEDBACK_STATUSES).optional(),
    priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  })
  .refine((value) => value.status || value.priority, { message: "Nothing to update" });

export const listFeedbackSchema = z.object({
  scope: z.enum(["mine", "all"]),
  search: z.string().max(200).optional(),
  statuses: z.array(z.enum(FEEDBACK_STATUSES)).optional(),
  kind: z.enum(FEEDBACK_KINDS).optional(),
  priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(25),
});

export type ListFeedbackInput = z.infer<typeof listFeedbackSchema>;
