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
});
