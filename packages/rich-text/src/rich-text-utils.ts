import type { JSONContent } from "@tiptap/core";
import type { RichTextValue } from "./rich-text-types";
import { mentionText } from "./mention/mention-utils";

const BLOCK_TYPES = new Set(["paragraph", "heading", "blockquote", "listItem", "codeBlock"]);

function walkNode(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  // A mention reads as "@Name" / "@ZL/174232" in plain text (previews, search, e-mails)
  if (node.type === "mention") {
    const text = mentionText(node.attrs ?? {});
    return text.length > 1 ? text : "";
  }
  if (node.type === "hardBreak") return "\n";
  if (!node.content?.length) return "";
  const inner = node.content.map(walkNode).join("");
  return BLOCK_TYPES.has(node.type ?? "") ? inner + "\n" : inner;
}

export function extractPlainText(value: RichTextValue | null | undefined): string {
  if (!value) return "";
  // Previews, search and e-mails get at most one blank line in a row.
  return walkNode(value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isRichTextEmpty(value: RichTextValue | null | undefined): boolean {
  return extractPlainText(value).length === 0;
}

/**
 * The editor's document as plain JSON. ProseMirror builds node attributes as
 * objects without a prototype; React refuses to send those to a server action
 * ("only plain objects can be passed"), so a document with a mention or any
 * other attribute could not be saved. A JSON round trip makes it plain.
 */
export function toPlainRichText(value: RichTextValue): RichTextValue {
  return JSON.parse(JSON.stringify(value)) as RichTextValue;
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

// ---------------------------------------------------------------------------
// Blank-line spam: Enter / Shift+Enter pressed many times
// ---------------------------------------------------------------------------

/** Whitespace incl. no-break and zero-width spaces (invisible "blank" text). */
const BLANK_TEXT = /^[\s\u00a0\u200b-\u200d\u2060\ufeff]*$/;
/** Inline nodes that carry content even without text. */
const CONTENT_INLINE = new Set(["mention", "image"]);
/** Containers whose children are blocks; code keeps every line as typed. */
const BLOCK_CONTAINERS = new Set(["doc", "blockquote", "listItem", "bulletList", "orderedList"]);
/** Line breaks kept in a row inside one paragraph (2 = one empty line). */
const MAX_HARD_BREAKS = 2;

function isBlankInline(node: JSONContent): boolean {
  if (node.type === "hardBreak") return true;
  if (node.type === "text") return BLANK_TEXT.test(node.text ?? "");
  return !CONTENT_INLINE.has(node.type ?? "") && !node.content?.length;
}

function isBlankBlock(node: JSONContent): boolean {
  if (node.type !== "paragraph" && node.type !== "heading") return false;
  return (node.content ?? []).every(isBlankInline);
}

/** A paragraph's inline content: no breaks at its edges, at most 2 in a row. */
function compactInline(content: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  let breaks = 0;
  for (const node of content) {
    if (node.type === "hardBreak") {
      breaks += 1;
      if (breaks <= MAX_HARD_BREAKS) out.push(node);
      continue;
    }
    // Spaces between breaks count as part of the blank run
    if (breaks > 0 && isBlankInline(node)) continue;
    breaks = 0;
    out.push(node);
  }
  const isEdge = (node: JSONContent) => node.type === "hardBreak" || isBlankInline(node);
  while (out.length > 0 && isEdge(out[0]!)) out.shift();
  while (out.length > 0 && isEdge(out[out.length - 1]!)) out.pop();
  return out;
}

function compactBlocks(blocks: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const block of blocks) {
    const node = compactNode(block);
    // At most one empty paragraph in a row
    if (isBlankBlock(node) && out.length > 0 && isBlankBlock(out[out.length - 1]!)) continue;
    out.push(node);
  }
  while (out.length > 0 && isBlankBlock(out[0]!)) out.shift();
  while (out.length > 0 && isBlankBlock(out[out.length - 1]!)) out.pop();
  return out;
}

function compactNode(node: JSONContent): JSONContent {
  if (node.type === "codeBlock" || !node.content) return node;
  if (node.type === "paragraph" || node.type === "heading") {
    const content = compactInline(node.content);
    return content.length > 0 ? { ...node, content } : { type: node.type, attrs: node.attrs };
  }
  if (BLOCK_CONTAINERS.has(node.type ?? "")) {
    const content = compactBlocks(node.content);
    // A list item needs a paragraph inside
    return {
      ...node,
      content: content.length > 0 || node.type !== "listItem" ? content : [{ type: "paragraph" }],
    };
  }
  return node;
}

/**
 * The document without blank-line spam, as chat apps and issue trackers do
 * it: no empty lines before the first or after the last line, at most one
 * empty line between paragraphs and at most one empty line (two breaks)
 * inside a paragraph. Whitespace-only and zero-width "text" counts as
 * empty; code blocks are left exactly as typed. Used on save and, for
 * documents saved before, on display.
 */
export function compactRichText(value: RichTextValue): RichTextValue {
  if (value?.type !== "doc" || !Array.isArray(value.content)) return value;
  const content = compactBlocks(value.content);
  return { ...value, content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

/** compactRichText for a document of unknown shape (server input); anything else is returned as is. */
export function compactRichInput<T>(value: T): T {
  const doc = normalizeRichText(value);
  return (doc ? compactRichText(doc) : value) as T;
}
