"use client";

// The editor lives in @repo/rich-text (shared with apps/requests-portal).
// Here it gets the toolbar's button names in the user's language.
import { useTranslations } from "next-intl";
import { RichTextEditorField as BaseRichTextEditorField } from "@repo/rich-text/rich-text-editor-field";
import type { RichTextEditorFieldProps, RichTextToolbarLabels } from "./rich-text-types";

const TOOLBAR_KEYS: (keyof RichTextToolbarLabels)[] = [
  "heading1",
  "heading2",
  "heading3",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
  "link",
  "linkPrompt",
  "alignLeft",
  "alignCenter",
  "alignRight",
  "justify",
  "clearFormatting",
  "undo",
  "redo",
];

export function RichTextEditorField(props: RichTextEditorFieldProps) {
  const t = useTranslations("components.richText.toolbar");
  const toolbarLabels = Object.fromEntries(
    TOOLBAR_KEYS.map((key) => [key, t(key)])
  ) as unknown as RichTextToolbarLabels;
  return (
    <BaseRichTextEditorField
      {...props}
      toolbarLabels={{ ...toolbarLabels, ...props.toolbarLabels }}
    />
  );
}
