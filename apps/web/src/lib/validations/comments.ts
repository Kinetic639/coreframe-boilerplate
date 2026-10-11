import { z } from "zod";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";

export const COMMENT_VISIBILITIES = ["default", "internal"] as const;

const MAX_RICH_TEXT_JSON_LENGTH = 50_000;
const MAX_RICH_TEXT_DEPTH = 16;
const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "mention",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENTION_ATTR_LIMITS: Record<string, number> = { type: 40, label: 200, code: 80, href: 300 };
const ALLOWED_MARK_TYPES = new Set(["bold", "italic", "underline", "strike", "code", "link"]);

export const commentTargetSchema = z.object({
  targetType: z.string().min(1).max(80),
  targetId: z.string().uuid(),
});

export const listCommentsSchema = commentTargetSchema.extend({
  cursor: z.string().max(128).optional(),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const addCommentSchema = commentTargetSchema.extend({
  bodyPlain: z.string().trim().min(1, "Comment cannot be empty").max(10000),
  bodyRich: z.unknown().optional(),
  visibility: z.enum(COMMENT_VISIBILITIES).default("default"),
});

export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];
export type CommentTargetInput = z.infer<typeof commentTargetSchema>;
export type ListCommentsInput = z.infer<typeof listCommentsSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSafeLinkHref(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim().toLowerCase();
  return (
    trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("mailto:")
  );
}

/**
 * "@" mention: `{ type, id, label, code?, href? }`. The id is a uuid, texts are
 * short, and the link (if any) stays inside the dashboard — it is rendered as one.
 */
function isAllowedMention(node: Record<string, unknown>): boolean {
  const attrs = isRecord(node.attrs) ? node.attrs : null;
  if (!attrs || node.content !== undefined || node.marks !== undefined) return false;
  if (typeof attrs.id !== "string" || !UUID_RE.test(attrs.id)) return false;
  for (const [name, limit] of Object.entries(MENTION_ATTR_LIMITS)) {
    const value = attrs[name];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || value.length > limit) return false;
  }
  if (typeof attrs.href === "string" && attrs.href) {
    if (!/^\/dashboard\/[^\s\\]*$/.test(attrs.href) || attrs.href.includes("//")) return false;
  }
  return true;
}

function isAllowedRichTextNode(value: unknown, depth: number): boolean {
  if (depth > MAX_RICH_TEXT_DEPTH || !isRecord(value)) return false;

  const type = value.type;
  if (typeof type !== "string" || !ALLOWED_NODE_TYPES.has(type)) return false;

  if ("text" in value && typeof value.text !== "string") return false;
  if (type === "mention") return isAllowedMention(value);

  const marks = value.marks;
  if (marks !== undefined) {
    if (!Array.isArray(marks)) return false;
    for (const mark of marks) {
      if (!isRecord(mark) || typeof mark.type !== "string" || !ALLOWED_MARK_TYPES.has(mark.type)) {
        return false;
      }
      if (mark.type === "link") {
        const attrs = isRecord(mark.attrs) ? mark.attrs : null;
        if (!attrs || !isSafeLinkHref(attrs.href)) return false;
      }
    }
  }

  const content = value.content;
  if (content !== undefined) {
    if (!Array.isArray(content) || content.length > 500) return false;
    return content.every((child) => isAllowedRichTextNode(child, depth + 1));
  }

  return true;
}

export function normalizeCommentRichText(value: unknown): RichTextValue | null {
  if (value === undefined || value === null) return null;

  let jsonLength = 0;
  try {
    jsonLength = JSON.stringify(value).length;
  } catch {
    return null;
  }

  if (jsonLength > MAX_RICH_TEXT_JSON_LENGTH) return null;
  if (!isAllowedRichTextNode(value, 0)) return null;

  const candidate = value as RichTextValue;
  if (candidate.type !== "doc" || !Array.isArray(candidate.content)) return null;

  return candidate;
}
