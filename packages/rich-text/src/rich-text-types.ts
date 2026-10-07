import type { JSONContent } from "@tiptap/core";

export type RichTextValue = JSONContent;

export type EditorMode = "simple" | "full";

export interface RichTextEditorFieldProps {
  value?: RichTextValue | null;
  onChange: (value: RichTextValue) => void;
  placeholder?: string;
  disabled?: boolean;
  mode?: EditorMode;
  maxLength?: number;
  className?: string;
  contentClassName?: string;
  label?: string;
  error?: string;
  id?: string;
}

export interface RichTextRendererProps {
  value?: RichTextValue | null;
  className?: string;
  prose?: boolean;
  emptyText?: string;
}
