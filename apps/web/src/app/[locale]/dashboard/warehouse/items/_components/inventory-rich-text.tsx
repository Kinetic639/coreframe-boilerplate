"use client";

import { useId, useMemo, useState } from "react";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import {
  createEmptyRichText,
  isRichTextEmpty,
  normalizeRichText,
} from "@/components/primitives/rich-text/rich-text-utils";
import { cn } from "@/utils";

function plainTextToRichText(value: string): RichTextValue {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    }));

  return paragraphs.length ? { type: "doc", content: paragraphs } : createEmptyRichText();
}

function parseInventoryRichText(value: string | null | undefined): RichTextValue | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    const normalized = normalizeRichText(parsed);
    if (normalized) return normalized;
  } catch {
    // Existing inventory descriptions were stored as plain text.
  }

  return plainTextToRichText(trimmed);
}

function serializeInventoryRichText(value: RichTextValue | null): string {
  if (!value || isRichTextEmpty(value)) return "";
  return JSON.stringify(value);
}

type InventoryRichTextFormFieldProps = {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
};

export function InventoryRichTextFormField({
  name,
  label,
  defaultValue,
  placeholder,
  className,
}: InventoryRichTextFormFieldProps) {
  const editorId = useId();
  const initialValue = useMemo(
    () => parseInventoryRichText(defaultValue) ?? createEmptyRichText(),
    [defaultValue]
  );
  const [value, setValue] = useState<RichTextValue>(initialValue);

  return (
    <div className={cn("grid items-start gap-3 md:grid-cols-[170px_1fr]", className)}>
      <label htmlFor={editorId} className="pt-2 text-sm">
        {label}
      </label>
      <div>
        <input type="hidden" name={name} value={serializeInventoryRichText(value)} />
        <RichTextEditorField
          value={value}
          onChange={setValue}
          mode="simple"
          maxLength={5000}
          placeholder={placeholder}
          id={editorId}
        />
      </div>
    </div>
  );
}

type InventoryRichTextDisplayProps = {
  value?: string | null;
  emptyText?: string;
  className?: string;
  prose?: boolean;
};

export function InventoryRichTextDisplay({
  value,
  emptyText,
  className,
  prose = true,
}: InventoryRichTextDisplayProps) {
  const richText = useMemo(() => parseInventoryRichText(value), [value]);

  return (
    <RichTextRenderer value={richText} emptyText={emptyText} prose={prose} className={className} />
  );
}
