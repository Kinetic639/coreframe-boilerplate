import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";
import TextAlign from "@tiptap/extension-text-align";
import type { AnyExtension } from "@tiptap/core";
import type { EditorMode } from "./rich-text-types";

export function buildExtensions(options: {
  mode: EditorMode;
  placeholder?: string;
  maxLength?: number;
}): AnyExtension[] {
  const { mode, placeholder, maxLength } = options;

  const extensions: AnyExtension[] = [
    StarterKit.configure({
      heading: mode === "full" ? { levels: [1, 2, 3] } : false,
      blockquote: mode === "full" ? {} : false,
      code: mode === "full" ? {} : false,
      codeBlock: false,
      strike: mode === "full" ? {} : false,
    }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
  ];

  if (placeholder) {
    extensions.push(Placeholder.configure({ placeholder }));
  }

  if (maxLength !== undefined) {
    extensions.push(CharacterCount.configure({ limit: maxLength }));
  }

  if (mode === "full") {
    extensions.push(TextAlign.configure({ types: ["heading", "paragraph"] }));
  }

  return extensions;
}
