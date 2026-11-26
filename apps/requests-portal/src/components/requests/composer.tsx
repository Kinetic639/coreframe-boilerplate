"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CompactEditor, type CompactEditorHandle } from "@repo/rich-text/compact-editor";
import { extractPlainText, isRichTextEmpty, type RichTextValue } from "@repo/rich-text";
import { Button } from "@/components/ui/button";
import { LIMITS } from "@/lib/validation/requests";

/**
 * Reply box: a message field that grows with the text (Enter sends, Shift+Enter adds a
 * line, as in Ambra's chat), photos and files, and Send. It never waits for the server:
 * the reply goes to the thread (shown there right away) and the box is cleared.
 */
export function Composer({
  onSend,
  onDraftChange,
}: {
  onSend: (rich: RichTextValue | null, files: File[]) => void;
  /** Every edit of the text (drives "is typing" for the other side). */
  onDraftChange?: (value: RichTextValue) => void;
}) {
  const t = useTranslations("requests.composer");
  const editor = useRef<CompactEditorHandle>(null);
  const [hasText, setHasText] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const rich = editor.current?.getValue() ?? null;
    const empty = !rich || isRichTextEmpty(rich) || !extractPlainText(rich).trim();
    if (empty && files.length === 0) return;
    onSend(empty ? null : rich, files);
    editor.current?.clear();
    setHasText(false);
    setFiles([]);
  };

  return (
    <div className="rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-3 pt-2.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex h-7 items-center gap-1 rounded-md bg-muted pl-2 pr-1 text-xs"
            >
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={t("removeFile", { name: f.name })}
                onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <CompactEditor
        ref={editor}
        placeholder={t("placeholder")}
        ariaLabel={t("label")}
        maxLength={LIMITS.bodyMax}
        onSubmit={submit}
        onTextChange={(text) => {
          setHasText(!!text.trim());
          const value = editor.current?.getValue();
          if (value) onDraftChange?.(value);
        }}
        className="max-h-48 overflow-y-auto px-3 py-2.5 text-sm"
      />
      <div className="flex items-center gap-1 border-t px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("attach")}
          title={t("attach")}
          onClick={() => fileRef.current?.click()}
          className="h-8 w-8 text-muted-foreground"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <span className="flex-1" />
        <Button type="button" size="sm" onClick={submit} disabled={!hasText && files.length === 0}>
          <Send className="h-4 w-4" />
          {t("send")}
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          setFiles((all) => [...all, ...picked].slice(0, LIMITS.maxFiles));
          e.target.value = "";
        }}
      />
    </div>
  );
}
