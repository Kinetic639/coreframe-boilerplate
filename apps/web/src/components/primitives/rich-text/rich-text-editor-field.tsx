"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { cn } from "@/utils";
import { buildExtensions } from "./rich-text-extensions";
import { RichTextToolbar } from "./rich-text-toolbar";
import { createEmptyRichText } from "./rich-text-utils";
import type { RichTextEditorFieldProps } from "./rich-text-types";

export function RichTextEditorField({
  value,
  onChange,
  placeholder,
  disabled = false,
  mode = "simple",
  maxLength,
  className,
  label,
  error,
  id,
}: RichTextEditorFieldProps) {
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: buildExtensions({ mode, placeholder, maxLength }),
    content: value ?? createEmptyRichText(),
    immediatelyRender: false,
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      isInternalUpdate.current = true;
      onChange(e.getJSON());
    },
  });

  // Sync external value changes (e.g. form reset) without resetting cursor on user edits
  useEffect(() => {
    if (!editor || isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const incoming = JSON.stringify(value ?? createEmptyRichText());
    const current = JSON.stringify(editor.getJSON());
    if (incoming !== current) {
      editor.commands.setContent(value ?? createEmptyRichText());
    }
  }, [editor, value]);

  // Sync disabled/editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const charCount = editor?.storage.characterCount?.characters?.() as number | undefined;
  const atLimit = maxLength !== undefined && charCount !== undefined && charCount >= maxLength;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
      )}

      <div
        className={cn(
          "rounded-md border border-input bg-background shadow-sm transition-colors",
          "focus-within:ring-1 focus-within:ring-ring",
          error && "border-destructive focus-within:ring-destructive",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {editor && <RichTextToolbar editor={editor} mode={mode} disabled={disabled} />}

        <EditorContent
          id={id}
          editor={editor}
          className={cn(
            "min-h-[120px] px-3 py-2 text-sm",
            "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px]",
            "[&_.ProseMirror_p]:my-0 [&_.ProseMirror_p]:leading-relaxed",
            "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5",
            "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
            "[&_.ProseMirror_li]:my-0.5",
            "[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:my-1",
            "[&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:my-1",
            "[&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:my-1",
            "[&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-muted-foreground/30 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:my-1",
            "[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:text-xs [&_.ProseMirror_code]:font-mono",
            "[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline",
            "[&_.ProseMirror_hr]:border-border [&_.ProseMirror_hr]:my-2",
            "[&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
          )}
        />

        {maxLength !== undefined && charCount !== undefined && (
          <div
            className={cn(
              "px-3 py-1.5 text-right text-xs",
              atLimit ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {charCount} / {maxLength}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
