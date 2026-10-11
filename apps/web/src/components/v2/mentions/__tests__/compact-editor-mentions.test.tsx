import { createRef, forwardRef, useImperativeHandle } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CompactEditor, type CompactEditorHandle } from "@repo/rich-text/compact-editor";
import type {
  MentionOptions,
  MentionSuggestionListHandle,
  MentionSuggestionListProps,
} from "@repo/rich-text/mention";
import { extractMentions } from "@repo/rich-text/mention-utils";
import { extractPlainText } from "@repo/rich-text/rich-text-utils";

/** Stand-in for the app's list: one fixed person, Enter inserts, no rows for "zz" */
const TestList = forwardRef<MentionSuggestionListHandle, MentionSuggestionListProps>(
  function TestList({ query, onSelect, onClose }, ref) {
    const empty = query.startsWith("zz");
    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (event.key !== "Enter") return false;
        if (empty) {
          onClose();
          return false;
        }
        onSelect({ type: "person", id: "u1", label: "Anna Nowak" });
        return true;
      },
    }));
    return <div data-testid="test-list">query:{query}</div>;
  }
);
const MENTIONS: MentionOptions = { SuggestionList: TestList };

beforeAll(() => {
  // ProseMirror measures the caret; jsdom has no layout
  const rect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }) as DOMRect;
  Range.prototype.getBoundingClientRect = rect;
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null }) as unknown as DOMRectList;
  Element.prototype.scrollIntoView = vi.fn();
  document.elementFromPoint = () => null;
});

async function setup() {
  const ref = createRef<CompactEditorHandle>();
  const onSubmit = vi.fn();
  const onTextChange = vi.fn();
  render(
    <CompactEditor
      ref={ref}
      ariaLabel="message"
      mention={MENTIONS}
      onSubmit={onSubmit}
      onTextChange={onTextChange}
    />
  );
  const box = await screen.findByRole("textbox", { name: "message" });
  const type = (text: string) =>
    act(() => {
      box.focus();
      // The editor instance is reachable from its DOM node (Tiptap sets `editor` on it)
      (
        box as unknown as { editor: { commands: { insertContent: (t: string) => void } } }
      ).editor.commands.insertContent(text);
    });
  const press = (key: string, shiftKey = false) =>
    act(() => {
      box.dispatchEvent(
        new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true })
      );
    });
  return { ref, onSubmit, onTextChange, type, press };
}

describe("CompactEditor with mentions", () => {
  it("Enter submits, Shift+Enter adds a line", async () => {
    const { ref, onSubmit, onTextChange, type, press } = await setup();
    type("pierwsza");
    press("Enter", true);
    type("druga");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(extractPlainText(ref.current!.getValue())).toBe("pierwsza\ndruga");
    expect(onTextChange).toHaveBeenLastCalledWith("pierwsza\ndruga");
    press("Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('"@" opens the list; Enter inserts the mention instead of submitting', async () => {
    const { ref, onSubmit, type, press } = await setup();
    type("hej @an");
    await waitFor(() => expect(screen.getByTestId("test-list")).toHaveTextContent("query:an"));
    press("Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    const value = ref.current!.getValue();
    expect(extractMentions(value)).toEqual([
      { type: "person", id: "u1", label: "Anna Nowak", code: null, href: null },
    ]);
    expect(extractPlainText(value)).toBe("hej @Anna Nowak");
    // Plain objects only: React rejects prototype-less ones in server action arguments
    const paragraph = value.content![0];
    const mention = paragraph.content!.find((node) => node.type === "mention")!;
    expect(Object.getPrototypeOf(mention.attrs)).toBe(Object.prototype);
    await waitFor(() => expect(screen.queryByTestId("test-list")).not.toBeInTheDocument());
    // The list is closed again: Enter sends
    press("Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Escape hides the list and Enter sends the text as typed", async () => {
    const { ref, onSubmit, type, press } = await setup();
    type("@an");
    await screen.findByTestId("test-list");
    press("Escape");
    press("Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(extractPlainText(ref.current!.getValue())).toBe("@an");
  });

  it("Enter with nothing to insert sends instead of being swallowed", async () => {
    const { onSubmit, type, press } = await setup();
    type("@zz");
    await screen.findByTestId("test-list");
    press("Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("clear() empties the box", async () => {
    const { ref, type } = await setup();
    type("coś");
    act(() => ref.current!.clear());
    expect(extractPlainText(ref.current!.getValue())).toBe("");
  });
});
