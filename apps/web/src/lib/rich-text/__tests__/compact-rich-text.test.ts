/**
 * Blank-line spam in rich text (comments, chat, reports, descriptions):
 * compactRichText cleans it on save and on display.
 */
import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  compactRichInput,
  compactRichText,
  extractPlainText,
} from "@repo/rich-text/rich-text-utils";

const p = (...content: JSONContent[]): JSONContent =>
  content.length ? { type: "paragraph", content } : { type: "paragraph" };
const text = (value: string): JSONContent => ({ type: "text", text: value });
const br: JSONContent = { type: "hardBreak" };
const doc = (...content: JSONContent[]) => ({ type: "doc", content });

describe("compactRichText", () => {
  it("drops empty paragraphs (Enter pressed many times) before and after the text", () => {
    expect(compactRichText(doc(p(), p(), p(text("Hej")), p(), p(), p(), p()))).toEqual(
      doc(p(text("Hej")))
    );
  });

  it("keeps at most one empty line between paragraphs", () => {
    expect(compactRichText(doc(p(text("A")), p(), p(), p(), p(text("B"))))).toEqual(
      doc(p(text("A")), p(), p(text("B")))
    );
  });

  it("keeps paragraphs written one after another as they are", () => {
    const value = doc(p(text("A")), p(text("B")), p(), p(text("C")));
    expect(compactRichText(value)).toEqual(value);
  });

  it("limits Shift+Enter breaks to one empty line and trims them at the edges", () => {
    expect(
      compactRichText(doc(p(br, br, text("A"), br, br, br, br, br, text("B"), br, br)))
    ).toEqual(doc(p(text("A"), br, br, text("B"))));
  });

  it("treats spaces, no-break and zero-width spaces as empty", () => {
    expect(
      compactRichText(doc(p(text("A")), p(text("   ")), p(text("​")), p(text("  ")), p(text("B"))))
    ).toEqual(doc(p(text("A")), p(), p(text("B"))));
  });

  it("leaves code blocks exactly as typed", () => {
    const code: JSONContent = { type: "codeBlock", content: [text("a\n\n\n\nb")] };
    expect(compactRichText(doc(p(), code, p()))).toEqual(doc(code));
  });

  it("cleans inside lists and quotes and never leaves a list item without a paragraph", () => {
    const value = doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [p(text("x")), p(), p(), p()] },
        { type: "listItem", content: [p(), p()] },
      ],
    });
    expect(compactRichText(value)).toEqual(
      doc({
        type: "bulletList",
        content: [
          { type: "listItem", content: [p(text("x"))] },
          { type: "listItem", content: [p()] },
        ],
      })
    );
  });

  it("keeps a mention on its own line (content without text)", () => {
    const mention: JSONContent = { type: "mention", attrs: { id: "u1", label: "Ola" } };
    expect(compactRichText(doc(p(), p(mention), p()))).toEqual(doc(p(mention)));
  });

  it("returns an empty document as one empty paragraph", () => {
    expect(compactRichText(doc(p(), p(br, br), p(text(" "))))).toEqual(doc(p()));
  });

  it("leaves anything that is not a document untouched (server input)", () => {
    expect(compactRichInput(null)).toBeNull();
    expect(compactRichInput({ foo: 1 })).toEqual({ foo: 1 });
    expect(compactRichInput(doc(p(), p(text("A"))))).toEqual(doc(p(text("A"))));
  });
});

describe("extractPlainText", () => {
  it("keeps at most one blank line in plain text (previews, e-mails)", () => {
    expect(extractPlainText(doc(p(text("A"), br, br, br, br, br, text("B"))))).toBe("A\n\nB");
  });
});
