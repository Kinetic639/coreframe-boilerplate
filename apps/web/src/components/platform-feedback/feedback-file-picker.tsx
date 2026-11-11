"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FEEDBACK_ALLOWED_MIME_TYPES,
  FEEDBACK_MAX_FILES,
  isAllowedFeedbackFile,
} from "@/lib/platform-feedback/types";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Files chosen for a report or an answer: a button, drag & drop is left to the
 * browser's file dialog, and screenshots pasted with Ctrl+V anywhere in the
 * surrounding dialog / page (when `pasteTarget` is on).
 */
export function FeedbackFilePicker({
  files,
  onChange,
  disabled,
  pasteTarget = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  pasteTarget?: boolean;
}) {
  const t = useTranslations("platformFeedback.files");
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const add = (incoming: File[]) => {
    const allowed = incoming.filter(isAllowedFeedbackFile);
    if (allowed.length < incoming.length) toast.warning(t("rejected"));
    const next = [...filesRef.current, ...allowed].slice(0, FEEDBACK_MAX_FILES);
    if (filesRef.current.length + allowed.length > FEEDBACK_MAX_FILES) {
      toast.warning(t("tooMany", { max: FEEDBACK_MAX_FILES }));
    }
    onChange(next);
  };

  useEffect(() => {
    if (!pasteTarget || disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files ?? []);
      if (pasted.length === 0) return;
      event.preventDefault();
      add(
        pasted.map((file, index) =>
          file.name && file.name !== "image.png"
            ? file
            : new File([file], `zrzut-${Date.now()}-${index + 1}.png`, { type: file.type })
        )
      );
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads files through the ref
  }, [pasteTarget, disabled]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={disabled || files.length >= FEEDBACK_MAX_FILES}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
          {t("add")}
        </Button>
        {pasteTarget && <span className="text-muted-foreground text-xs">{t("pasteHint")}</span>}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={FEEDBACK_ALLOWED_MIME_TYPES.join(",")}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1" data-testid="feedback-picked-files">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1 text-sm"
            >
              {file.type.startsWith("image/") ? (
                <ImageIcon className="text-muted-foreground h-4 w-4 shrink-0" />
              ) : (
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("remove", { name: file.name })}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
