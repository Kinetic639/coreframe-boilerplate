import type { ReactNode } from "react";
import type { JSONContent } from "@tiptap/core";
import type { MentionItem, MentionOptions } from "./mention/mention-types";

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
  /** "@" mentions: the app's suggestion list (people, objects). Off when omitted. */
  mention?: MentionOptions;
}

export interface RichTextRendererProps {
  value?: RichTextValue | null;
  className?: string;
  prose?: boolean;
  emptyText?: string;
  /** How a mention is shown (link, access check, icon); a plain "@label" tag by default */
  renderMention?: (mention: MentionItem) => ReactNode;
}
