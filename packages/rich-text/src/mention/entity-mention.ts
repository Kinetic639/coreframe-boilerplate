import { mergeAttributes, type AnyExtension, type Editor } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type {
  MentionItem,
  MentionOptions,
  MentionSuggestionListHandle,
  MentionSuggestionListProps,
} from "./mention-types";
import { mentionText } from "./mention-utils";

/** True while the suggestion list is on screen (Enter then picks a row, it does not submit) */
export function isMentionListOpen(editor: Editor): boolean {
  const storage = (editor.storage as unknown as Record<string, { open?: boolean } | undefined>)
    .mention;
  return storage?.open === true;
}

function setOpen(editor: Editor, open: boolean) {
  const storage = (editor.storage as unknown as Record<string, { open?: boolean } | undefined>)
    .mention;
  if (storage) storage.open = open;
}

const POPUP_GAP = 6;
const POPUP_MARGIN = 8;

/**
 * "@" mentions of people and objects.
 *
 * The node stores `{ type, id, label, code, href }`. Typing "@" opens the
 * app's suggestion list next to the caret; the list fetches and filters by
 * itself (the query is passed down) and calls `onSelect` with the item.
 */
export function buildEntityMention(options: MentionOptions): AnyExtension {
  return Mention.extend({
    addStorage() {
      return { open: false };
    },
    addAttributes() {
      const extra = (name: string) => ({
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute(`data-mention-${name}`),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes[name] ? { [`data-mention-${name}`]: attributes[name] } : {},
      });
      return {
        ...this.parent?.(),
        type: { ...extra("type"), default: "person" },
        code: extra("code"),
        href: extra("href"),
      };
    },
  }).configure({
    HTMLAttributes: {
      class:
        "rounded bg-primary/10 px-1 py-px font-medium text-primary [&[data-mention-code]]:font-mono",
    },
    renderText: ({ node }) => mentionText(node.attrs),
    renderHTML: ({ options: nodeOptions, node }) => [
      "span",
      mergeAttributes(nodeOptions.HTMLAttributes),
      mentionText(node.attrs),
    ],
    suggestion: {
      char: "@",
      // "@jan kowalski", "@cz: filtr oleju" — the list closes itself when nothing matches
      allowSpaces: true,
      // The list component searches by itself; nothing is resolved here
      items: () => [],
      render: () => {
        let renderer: ReactRenderer<
          MentionSuggestionListHandle,
          MentionSuggestionListProps
        > | null = null;
        let container: HTMLDivElement | null = null;
        let dismissed = false;
        let startedAt = -1;
        let editorRef: Editor | null = null;
        let caretRect: (() => DOMRect | null) | null | undefined = null;
        let observer: ResizeObserver | null = null;

        const hide = () => {
          dismissed = true;
          if (container) container.style.display = "none";
          if (editorRef) setOpen(editorRef, false);
        };

        const place = (rect: DOMRect | null | undefined) => {
          if (!container || !rect) return;
          const height = container.offsetHeight;
          const width = container.offsetWidth;
          const below = rect.bottom + POPUP_GAP;
          // Open upwards when there is no room below (chat windows sit at the bottom)
          const top =
            below + height > window.innerHeight - POPUP_MARGIN
              ? Math.max(rect.top - POPUP_GAP - height, POPUP_MARGIN)
              : below;
          const left = Math.min(
            Math.max(rect.left, POPUP_MARGIN),
            window.innerWidth - width - POPUP_MARGIN
          );
          container.style.top = `${top}px`;
          container.style.left = `${left}px`;
        };

        const cleanup = () => {
          observer?.disconnect();
          observer = null;
          renderer?.destroy();
          renderer = null;
          container?.remove();
          container = null;
          if (editorRef) setOpen(editorRef, false);
        };

        return {
          onStart: (props) => {
            dismissed = false;
            startedAt = props.range.from;
            editorRef = props.editor;
            setOpen(props.editor, true);
            renderer = new ReactRenderer(options.SuggestionList, {
              editor: props.editor,
              props: {
                query: props.query,
                onSelect: (item: MentionItem) => props.command(item),
                onClose: hide,
              },
            });
            container = document.createElement("div");
            container.style.position = "fixed";
            container.style.zIndex = "70";
            container.dataset.mentionPopup = "true";
            container.appendChild(renderer.element);
            // Inside a modal dialog the page behind is inert: stay within the dialog
            const host =
              props.editor.view.dom.closest<HTMLElement>('[role="dialog"]') ?? document.body;
            host.appendChild(container);
            caretRect = props.clientRect;
            place(caretRect?.());
            // The list renders after this call and grows with its results: follow its size
            if (typeof ResizeObserver !== "undefined") {
              observer = new ResizeObserver(() => place(caretRect?.()));
              observer.observe(container);
            }
          },
          onUpdate: (props) => {
            renderer?.updateProps({
              query: props.query,
              onSelect: (item: MentionItem) => props.command(item),
            });
            // A new "@" further in the line opens the list again after Esc
            if (dismissed && props.range.from !== startedAt) {
              dismissed = false;
              if (container) container.style.display = "";
              setOpen(props.editor, true);
            }
            startedAt = props.range.from;
            caretRect = props.clientRect;
            if (dismissed) return;
            requestAnimationFrame(() => place(caretRect?.()));
          },
          onKeyDown: ({ event }) => {
            if (dismissed) return false;
            if (event.key === "Escape") {
              hide();
              return true;
            }
            return renderer?.ref?.onKeyDown(event) ?? false;
          },
          onExit: cleanup,
        };
      },
    },
  });
}
