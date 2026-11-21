"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Minus,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  RemoveFormatting,
} from "lucide-react";
import { Toggle } from "./ui/toggle";
import { Separator } from "./ui/separator";
import { cn } from "@repo/ui/utils";
import type { EditorMode, RichTextToolbarLabels } from "./rich-text-types";

export const DEFAULT_TOOLBAR_LABELS: RichTextToolbarLabels = {
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strikethrough: "Strikethrough",
  code: "Inline code",
  bulletList: "Bullet list",
  orderedList: "Ordered list",
  blockquote: "Blockquote",
  horizontalRule: "Horizontal rule",
  link: "Insert link",
  alignLeft: "Align left",
  alignCenter: "Align center",
  alignRight: "Align right",
  justify: "Justify",
  clearFormatting: "Clear formatting",
  undo: "Undo",
  redo: "Redo",
  linkPrompt: "URL",
};

interface RichTextToolbarProps {
  editor: Editor;
  mode: EditorMode;
  disabled?: boolean;
  labels?: Partial<RichTextToolbarLabels>;
  /** Stays at the top of the scrolling area (see RichTextEditorFieldProps.stickyToolbar). */
  sticky?: boolean;
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <Toggle
      size="sm"
      pressed={active}
      onPressedChange={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-7 w-7 p-0"
    >
      {children}
    </Toggle>
  );
}

function ToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-0.5 h-5" />;
}

export function RichTextToolbar({ editor, mode, disabled, labels, sticky }: RichTextToolbarProps) {
  const t = { ...DEFAULT_TOOLBAR_LABELS, ...labels };
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t.linkPrompt, prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted/40 px-2 py-1.5",
        // Opaque while stuck, so the text scrolling under it does not show through.
        // A host with its own sticky bar sets --rich-text-toolbar-top to sit below it.
        sticky && "sticky top-[var(--rich-text-toolbar-top,0px)] z-10 bg-muted",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      {mode === "full" && (
        <>
          <ToolbarButton
            label={t.heading1}
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t.heading2}
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t.heading3}
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarSeparator />
        </>
      )}

      <ToolbarButton
        label={t.bold}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t.italic}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t.underline}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>

      {mode === "full" && (
        <>
          <ToolbarButton
            label={t.strikethrough}
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t.code}
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}

      <ToolbarSeparator />

      <ToolbarButton
        label={t.bulletList}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t.orderedList}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>

      {mode === "full" && (
        <>
          <ToolbarButton
            label={t.blockquote}
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t.horizontalRule}
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}

      <ToolbarSeparator />

      <ToolbarButton label={t.link} active={editor.isActive("link")} onClick={setLink}>
        <Link className="h-3.5 w-3.5" />
      </ToolbarButton>

      {mode === "full" && (
        <>
          <ToolbarSeparator />
          <ToolbarButton
            label={t.alignLeft}
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t.alignCenter}
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t.alignRight}
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t.justify}
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton
            label={t.clearFormatting}
            active={false}
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}

      <ToolbarSeparator />

      <ToolbarButton
        label={t.undo}
        active={false}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t.redo}
        active={false}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}
