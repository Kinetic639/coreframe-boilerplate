import type { JSONContent } from "@tiptap/core";
import type { RichTextValue } from "./rich-text-types";

const BLOCK_TYPES = new Set(["paragraph", "heading", "blockquote", "listItem", "codeBlock"]);

function walkNode(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content?.length) return "";
  const inner = node.content.map(walkNode).join("");
  return BLOCK_TYPES.has(node.type ?? "") ? inner + "\n" : inner;
}

export function extractPlainText(value: RichTextValue | null | undefined): string {
  if (!value) return "";
  return walkNode(value).trim();
}

export function isRichTextEmpty(value: RichTextValue | null | undefined): boolean {
  return extractPlainText(value).length === 0;
}

export function createEmptyRichText(): RichTextValue {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function normalizeRichText(value: unknown): RichTextValue | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as RichTextValue;
  if (candidate.type !== "doc" || !Array.isArray(candidate.content)) return null;
  return candidate;
}
