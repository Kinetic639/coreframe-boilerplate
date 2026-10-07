import type { ReactNode } from "react";
import type { EditorMode, RichTextValue } from "../rich-text-types";

export type CommentDensity = "default" | "compact";

export interface CommentAuthor {
  name: string;
  avatarUrl?: string | null;
  fallback?: string;
  email?: string | null;
  profileHref?: string | null;
  profileLabel?: string;
}

export interface CommentEditorProps {
  value: RichTextValue;
  onChange: (value: RichTextValue) => void;
  onSubmit?: (value: RichTextValue) => void;
  author?: CommentAuthor;
  placeholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  disabled?: boolean;
  submitting?: boolean;
  maxLength?: number;
  mode?: EditorMode;
  density?: CommentDensity;
  autoDisableSubmitWhenEmpty?: boolean;
  className?: string;
  editorClassName?: string;
  actions?: ReactNode;
  id?: string;
}

export interface CommentRendererProps {
  /** Avatar element; defaults to initials. Ambra passes its UserAvatar with profile popover. */
  avatar?: ReactNode;
  value?: RichTextValue | null;
  author?: CommentAuthor;
  createdAt?: ReactNode;
  editedLabel?: ReactNode;
  isOwn?: boolean;
  emptyText?: string;
  density?: CommentDensity;
  className?: string;
  contentClassName?: string;
  actions?: ReactNode;
}
