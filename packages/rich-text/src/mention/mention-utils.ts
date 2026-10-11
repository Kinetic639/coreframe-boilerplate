import type { JSONContent } from "@tiptap/core";
import { MENTION_NODE, type MentionItem } from "./mention-types";

/** Text of a mention in plain text and in the editor: "@Paweł Wiśniewski", "@ZL/174232" */
export function mentionText(attrs: { label?: unknown; code?: unknown }): string {
  const code = typeof attrs.code === "string" ? attrs.code : "";
  const label = typeof attrs.label === "string" ? attrs.label : "";
  return `@${code || label}`;
}

/** Reads a mention node's attributes defensively (stored JSON is untrusted input) */
export function mentionFromAttrs(attrs: Record<string, unknown> | undefined): MentionItem | null {
  const id = typeof attrs?.id === "string" ? attrs.id : null;
  if (!id) return null;
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  return {
    id,
    type: text(attrs?.type) ?? "person",
    label: text(attrs?.label) ?? "",
    code: text(attrs?.code),
    href: text(attrs?.href),
  };
}

/** Every mention in a document, each `type:id` once, in document order */
export function extractMentions(value: JSONContent | null | undefined): MentionItem[] {
  const found = new Map<string, MentionItem>();
  const walk = (node: JSONContent | null | undefined) => {
    if (!node) return;
    if (node.type === MENTION_NODE) {
      const mention = mentionFromAttrs(node.attrs as Record<string, unknown> | undefined);
      if (mention) found.set(`${mention.type}:${mention.id}`, mention);
    }
    node.content?.forEach(walk);
  };
  walk(value);
  return [...found.values()];
}

export type { MentionItem } from "./mention-types";
