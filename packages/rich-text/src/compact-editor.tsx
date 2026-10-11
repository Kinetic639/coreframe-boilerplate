"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { cn } from "@repo/ui/utils";
import { buildEntityMention, isMentionListOpen } from "./mention/entity-mention";
import type { MentionOptions } from "./mention/mention-types";
import { createEmptyRichText, extractPlainText } from "./rich-text-utils";
import type { RichTextValue } from "./rich-text-types";

export interface CompactEditorHandle {
  focus: () => void;
  clear: () => void;
  getValue: () => RichTextValue;
}

export interface CompactEditorProps {
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /** "@" mentions; off when omitted */
  mention?: MentionOptions;
  /** Enter (without Shift, with the mention list closed) */
  onSubmit: () => void;
  /** After every edit: the plain text of the content */
  onTextChange?: (text: string) => void;
  className?: string;
}

/**
 * One-line message box that grows with its text: plain paragraphs with bold /
 * italic and mentions, no toolbar. Enter submits, Shift+Enter adds a line.
 * Uncontrolled — the owner reads the value through the handle when sending.
 */
export const CompactEditor = forwardRef<CompactEditorHandle, CompactEditorProps>(
  function CompactEditor(
    {
      placeholder,
      ariaLabel,
      maxLength,
      autoFocus = false,
      disabled = false,
      mention,
      onSubmit,
      onTextChange,
      className,
    },
    ref
  ) {
    const onSubmitRef = useRef(onSubmit);
    const onTextChangeRef = useRef(onTextChange);
    useEffect(() => {
      onSubmitRef.current = onSubmit;
      onTextChangeRef.current = onTextChange;
    }, [onSubmit, onTextChange]);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          codeBlock: false,
          horizontalRule: false,
          code: false,
          strike: false,
        }),
        ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
        ...(maxLength !== undefined ? [CharacterCount.configure({ limit: maxLength })] : []),
        ...(mention ? [buildEntityMention(mention)] : []),
        Extension.create({
          name: "submitOnEnter",
          // After the mention list (priority 101: it picks a row with Enter, or closes
          // itself when it has none) and before the default Enter (100: new paragraph)
          priority: 100.5,
          addKeyboardShortcuts() {
            return {
              Enter: ({ editor: current }) => {
                // The open mention list picks its row with Enter
                if (isMentionListOpen(current)) return false;
                if (current.view.composing) return false;
                onSubmitRef.current();
                return true;
              },
              "Shift-Enter": ({ editor: current }) => current.commands.setHardBreak(),
            };
          },
        }),
      ] as AnyExtension[],
      content: createEmptyRichText(),
      immediatelyRender: false,
      editable: !disabled,
      autofocus: autoFocus ? "end" : false,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-multiline": "true",
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        },
      },
      onUpdate: ({ editor: current }) => {
        onTextChangeRef.current?.(extractPlainText(current.getJSON()));
      },
    });

    useEffect(() => {
      editor?.setEditable(!disabled);
    }, [editor, disabled]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor?.commands.focus("end"),
        clear: () => editor?.commands.clearContent(true),
        getValue: () => editor?.getJSON() ?? createEmptyRichText(),
      }),
      [editor]
    );

    return (
      <EditorContent
        editor={editor}
        className={cn(
          "min-w-0 flex-1 overflow-y-auto",
          "[&_.ProseMirror]:outline-none [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words",
          "[&_.ProseMirror_p]:my-0",
          "[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          className
        )}
      />
    );
  }
);
