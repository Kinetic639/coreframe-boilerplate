/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { addCommentSchema, normalizeCommentRichText } from "../comments";

const validTarget = {
  targetType: "helpdesk.ticket",
  targetId: "550e8400-e29b-41d4-a716-446655440000",
};

describe("addCommentSchema", () => {
  it("accepts a minimal valid generic comment", () => {
    const result = addCommentSchema.safeParse({
      ...validTarget,
      bodyPlain: "Created a reusable comment.",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.visibility).toBe("default");
  });

  it("rejects empty body text", () => {
    const result = addCommentSchema.safeParse({
      ...validTarget,
      bodyPlain: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported visibility", () => {
    const result = addCommentSchema.safeParse({
      ...validTarget,
      bodyPlain: "hello",
      visibility: "private",
    });

    expect(result.success).toBe(false);
  });
});

describe("normalizeCommentRichText", () => {
  it("accepts allowed TipTap rich text nodes and marks", () => {
    const value = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Open profile",
              marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://ambra.app" } }],
            },
          ],
        },
      ],
    };

    expect(normalizeCommentRichText(value)).toEqual(value);
  });

  it("rejects unsafe javascript links", () => {
    const value = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bad",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };

    expect(normalizeCommentRichText(value)).toBeNull();
  });

  it("rejects unsupported nodes", () => {
    const value = {
      type: "doc",
      content: [{ type: "iframe", attrs: { src: "https://example.com" } }],
    };

    expect(normalizeCommentRichText(value)).toBeNull();
  });

  it("accepts a mention with a uuid and an internal link", () => {
    const mention = (attrs: Record<string, unknown>) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "mention", attrs }] }],
    });
    const id = "832858c3-0a9f-4f9f-a230-fc7e47855e78";
    expect(normalizeCommentRichText(mention({ type: "person", id, label: "Anna" }))).not.toBeNull();
    expect(
      normalizeCommentRichText(
        mention({
          type: "repairOrder",
          id,
          label: "Golf",
          code: "174232",
          href: "/dashboard/workshop/x",
        })
      )
    ).not.toBeNull();
    // Not a uuid, an external or script link, an oversized label
    expect(normalizeCommentRichText(mention({ type: "person", id: "1", label: "A" }))).toBeNull();
    for (const href of [
      "https://evil.example",
      "javascript:alert(1)",
      "/dashboard//evil.example",
    ]) {
      expect(normalizeCommentRichText(mention({ type: "item", id, label: "A", href }))).toBeNull();
    }
    expect(
      normalizeCommentRichText(mention({ type: "person", id, label: "A".repeat(201) }))
    ).toBeNull();
  });
});
