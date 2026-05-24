"use client";

import { useState } from "react";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue, EditorMode } from "@/components/primitives/rich-text/rich-text-types";
import {
  isRichTextEmpty,
  extractPlainText,
} from "@/components/primitives/rich-text/rich-text-utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils";

const MODE_OPTIONS: { value: EditorMode; label: string; description: string }[] = [
  { value: "simple", label: "Simple", description: "Bold, italic, underline, lists, links" },
  {
    value: "full",
    label: "Full",
    description: "All of simple + headings, alignment, blockquote, code, strikethrough",
  },
];

const INITIAL_CONTENT: RichTextValue = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Welcome to the Rich Text Editor" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This is a " },
        { type: "text", text: "live preview", marks: [{ type: "bold" }] },
        {
          type: "text",
          text: " of the Tiptap-powered editor. Edit anything on the left and watch the ",
        },
        { type: "text", text: "renderer update in real time", marks: [{ type: "italic" }] },
        { type: "text", text: " on the right." },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "ProseMirror JSON is the source of truth" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "The renderer uses zero dangerouslySetInnerHTML — no XSS risk",
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Switch to Full mode to unlock headings, alignment, and more",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export default function RichTextDemoPage() {
  const [value, setValue] = useState<RichTextValue>(INITIAL_CONTENT);
  const [mode, setMode] = useState<EditorMode>("full");
  const [showJson, setShowJson] = useState(false);

  const charCount = extractPlainText(value).length;
  const isEmpty = isRichTextEmpty(value);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex-none border-b bg-background px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rich Text Editor Demo</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Live preview — edit on the left, rendered output appears on the right.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode switcher */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  title={opt.description}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-all",
                    mode === opt.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* JSON toggle */}
            <button
              onClick={() => setShowJson((v) => !v)}
              className={cn(
                "rounded-md border px-3 py-1 text-sm font-medium transition-all",
                showJson
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex min-h-0 flex-1 divide-x overflow-hidden">
        {/* Left — Editor */}
        <div className="flex min-h-0 w-1/2 flex-col overflow-y-auto bg-background p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Editor
            </span>
            <Badge variant="outline" className="text-xs">
              {charCount} chars
            </Badge>
          </div>
          <RichTextEditorField
            value={value}
            onChange={setValue}
            mode={mode}
            placeholder="Start typing…"
            maxLength={5000}
            className="flex-1"
          />
        </div>

        {/* Right — Renderer */}
        <div className="flex min-h-0 w-1/2 flex-col overflow-y-auto bg-muted/20 p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Rendered output
            </span>
            <Badge variant={isEmpty ? "secondary" : "outline"} className="text-xs">
              {isEmpty ? "empty" : "has content"}
            </Badge>
          </div>

          {showJson ? (
            <pre className="flex-1 overflow-auto rounded-md border bg-background p-4 text-xs text-muted-foreground">
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <div className="rounded-md border bg-background p-5 shadow-sm">
              <RichTextRenderer
                value={value}
                prose
                emptyText="Nothing to render yet — start typing in the editor."
              />
            </div>
          )}

          {!showJson && (
            <>
              <Separator className="my-4" />
              <div className="rounded-md border bg-background p-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Security note
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The renderer converts ProseMirror JSON to React elements recursively — no{" "}
                  <code className="rounded bg-muted px-1 font-mono">dangerouslySetInnerHTML</code>{" "}
                  is used anywhere. XSS is structurally impossible since only whitelisted node types
                  and mark attributes (href, etc.) are rendered.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
