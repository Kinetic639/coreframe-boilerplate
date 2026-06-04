"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { isRichTextEmpty } from "@/components/primitives/rich-text/rich-text-utils";
import { cn } from "@/utils";
import type { CommentEditorProps } from "./comment-types";

export function CommentEditor({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  submittingLabel,
  cancelLabel,
  onCancel,
  disabled = false,
  submitting = false,
  maxLength = 2000,
  mode = "simple",
  density = "default",
  autoDisableSubmitWhenEmpty = true,
  className,
  editorClassName,
  actions,
  id,
}: CommentEditorProps) {
  const t = useTranslations("components.comments");
  const empty = isRichTextEmpty(value);
  const submitDisabled = disabled || submitting || (autoDisableSubmitWhenEmpty && empty);
  const compact = density === "compact";
  const resolvedPlaceholder = placeholder ?? t("placeholder");
  const resolvedSubmitLabel = submitLabel ?? t("submit");
  const resolvedSubmittingLabel = submittingLabel ?? t("submitting");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  return (
    <div className={cn("min-w-0", className)}>
      <RichTextEditorField
        id={id}
        value={value}
        onChange={onChange}
        mode={mode}
        placeholder={resolvedPlaceholder}
        disabled={disabled || submitting}
        maxLength={maxLength}
        className={editorClassName}
        contentClassName={cn(
          compact
            ? "min-h-[70px] px-3 py-2 [&_.ProseMirror]:min-h-[52px]"
            : "min-h-[112px] [&_.ProseMirror]:min-h-[92px]"
        )}
      />

      {(onSubmit || onCancel || actions) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onSubmit && (
              <Button
                type="button"
                size={compact ? "sm" : "default"}
                onClick={() => onSubmit(value)}
                disabled={submitDisabled}
              >
                <Send className="h-4 w-4" />
                {submitting ? resolvedSubmittingLabel : resolvedSubmitLabel}
              </Button>
            )}

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size={compact ? "sm" : "default"}
                onClick={onCancel}
                disabled={disabled || submitting}
              >
                {resolvedCancelLabel}
              </Button>
            )}
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
