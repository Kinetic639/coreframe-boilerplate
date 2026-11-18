"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MentionItem } from "@repo/rich-text/mention-utils";
import { RichTextEditorField } from "./rich-text-editor-field";
import { RichTextRenderer } from "./rich-text-renderer";
import type { RichTextEditorFieldProps, RichTextValue } from "./rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  isRichTextEmpty,
  normalizeRichText,
} from "./rich-text-utils";
import { cn } from "@/utils";

const DRAFT_PREFIX = "ambra.rich-text-draft.";
const DRAFT_WRITE_DELAY_MS = 400;

function readDraft(key: string): RichTextValue | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? (normalizeRichText(JSON.parse(raw)) ?? null) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: RichTextValue | null) {
  try {
    if (value) window.localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(value));
    else window.localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // Private mode or storage full: the draft just isn't kept.
  }
}

function same(a: RichTextValue | null | undefined, b: RichTextValue | null | undefined) {
  const left = a && !isRichTextEmpty(a) ? JSON.stringify(a) : "";
  const right = b && !isRichTextEmpty(b) ? JSON.stringify(b) : "";
  return left === right;
}

export interface RichTextInlineFieldLabels {
  edit: string;
  save: string;
  saving?: string;
  cancel: string;
  /** The badge shown while a draft is kept. */
  unsaved: string;
  /** Shown instead of the text when there is none (and the field can be edited). */
  emptyCta: string;
}

interface RichTextInlineFieldProps {
  /** The section's heading (icon and title); the Edit button and the badge go beside it. */
  heading: React.ReactNode;
  value: RichTextValue | null | undefined;
  /** Plain text shown when there is no rich value (older records). */
  fallbackText?: string | null;
  onSave: (rich: RichTextValue, plain: string) => void | Promise<void>;
  /** Where the draft is kept in this browser, e.g. `task-description:<id>`. */
  draftKey: string;
  disabled?: boolean;
  saving?: boolean;
  placeholder?: string;
  emptyText?: string;
  maxLength?: number;
  mention?: RichTextEditorFieldProps["mention"];
  renderMention?: (mention: MentionItem) => React.ReactNode;
  labels: RichTextInlineFieldLabels;
  className?: string;
  contentClassName?: string;
}

/**
 * Text shown as text; a click on it (or Edit) turns it into the editor with
 * Save and Cancel. What is typed is kept as a draft in this browser while
 * editing, so closing the window without saving loses nothing: the field then
 * shows an "Unsaved changes" badge and opening it again brings the draft back.
 * Cancel throws the draft away. Esc closes the editor and keeps the draft;
 * Ctrl/Cmd+Enter saves.
 */
export function RichTextInlineField({
  heading,
  value,
  fallbackText,
  onSave,
  draftKey,
  disabled = false,
  saving = false,
  placeholder,
  emptyText,
  maxLength,
  mention,
  renderMention,
  labels,
  className,
  contentClassName,
}: RichTextInlineFieldProps) {
  const current = normalizeRichText(value) ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RichTextValue>(() => current ?? createEmptyRichText());
  const [hasDraft, setHasDraft] = useState(false);
  const pending = useRef<RichTextValue | null>(null);
  const timer = useRef<number | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  // A draft left from an earlier visit (read after mount: storage is browser-only).
  useEffect(() => {
    const stored = readDraft(draftKey);
    if (stored && !same(stored, current)) setHasDraft(true);
    else if (stored) writeDraft(draftKey, null);
    // Only when the field (its key) changes, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const flushDraft = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      writeDraft(draftKey, same(pending.current, currentRef.current) ? null : pending.current);
      pending.current = null;
    }
  }, [draftKey]);

  // Closing the window mid-edit still keeps what was typed last.
  useEffect(() => flushDraft, [flushDraft]);

  const open = () => {
    if (disabled || editing) return;
    setDraft(readDraft(draftKey) ?? current ?? createEmptyRichText());
    setEditing(true);
  };

  const change = (next: RichTextValue) => {
    setDraft(next);
    pending.current = next;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flushDraft, DRAFT_WRITE_DELAY_MS);
  };

  /** Esc: close, keep the draft (the badge says so). */
  const close = () => {
    flushDraft();
    setHasDraft(Boolean(readDraft(draftKey)));
    setEditing(false);
  };

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    pending.current = null;
    writeDraft(draftKey, null);
    setHasDraft(false);
    setEditing(false);
  };

  const save = async () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    pending.current = null;
    if (!same(draft, current)) {
      await onSave(draft, extractPlainText(draft).trim());
    }
    writeDraft(draftKey, null);
    setHasDraft(false);
    setEditing(false);
  };

  const empty = !current || isRichTextEmpty(current);

  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex min-h-8 items-center gap-2">
        <div className="min-w-0">{heading}</div>
        {hasDraft && !editing ? (
          <button
            type="button"
            onClick={open}
            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
          >
            {labels.unsaved}
          </button>
        ) : null}
        {!disabled && !editing && !empty ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5 rounded-md border-input bg-transparent px-2.5 text-sm font-normal text-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
            onClick={open}
          >
            <Pencil className="h-3.5 w-3.5" />
            {labels.edit}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div
          className="space-y-2"
          onKeyDown={(event) => {
            // An open "@" list handles Esc itself. (In a dialog, Esc closes the
            // dialog first; the draft is kept either way.)
            if (event.key === "Escape" && !event.defaultPrevented) {
              event.stopPropagation();
              close();
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void save();
            }
          }}
        >
          <RichTextEditorField
            value={draft}
            onChange={change}
            placeholder={placeholder}
            mode="full"
            mention={mention}
            maxLength={maxLength}
            autoFocus
            contentClassName={contentClassName}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saving && labels.saving ? labels.saving : labels.save}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={saving}>
              {labels.cancel}
            </Button>
          </div>
        </div>
      ) : empty && !disabled ? (
        <button
          type="button"
          onClick={open}
          className="w-full rounded-md bg-muted/60 px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          {labels.emptyCta}
        </button>
      ) : (
        <div
          role={disabled ? undefined : "button"}
          tabIndex={disabled ? undefined : 0}
          onClick={(event) => {
            // Links and mentions in the text keep working.
            if ((event.target as HTMLElement).closest("a, button")) return;
            open();
          }}
          onKeyDown={(event) => {
            if (!disabled && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              open();
            }
          }}
          className={cn(
            "rounded-md px-1 py-0.5 text-sm",
            !disabled && "-mx-1 cursor-text transition-colors hover:bg-muted/50"
          )}
        >
          <RichTextRenderer
            value={current ?? undefined}
            emptyText={fallbackText || emptyText}
            renderMention={renderMention}
          />
        </div>
      )}
    </section>
  );
}
