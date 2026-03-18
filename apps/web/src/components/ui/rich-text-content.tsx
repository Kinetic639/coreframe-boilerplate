"use client";

import React, { useEffect, useRef } from "react";
import { $getRoot } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";

import { cn } from "@/lib/utils";

export interface RichTextContentProps {
  /**
   * JSON content from the rich text editor
   */
  content: string | null | undefined;
  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
  /**
   * Custom theme overrides
   */
  themeOverrides?: {
    paragraph?: string;
    quote?: string;
    heading?: Record<string, string>;
    list?: {
      nested?: { listitem?: string };
      ol?: string;
      ul?: string;
      listitem?: string;
      listitemChecked?: string;
      listitemUnchecked?: string;
    };
    text?: Record<string, string>;
    code?: string;
    codeHighlight?: Record<string, string>;
    link?: string;
    table?: string;
    tableCell?: string;
    tableRow?: string;
  };
}

// Default theme that matches the editor
const defaultContentTheme = {
  paragraph: "mb-2 text-base",
  quote: "border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4",
  heading: {
    h1: "text-3xl font-bold mb-4",
    h2: "text-2xl font-bold mb-3",
    h3: "text-xl font-bold mb-3",
    h4: "text-lg font-bold mb-2",
    h5: "text-base font-bold mb-2",
    h6: "text-sm font-bold mb-1",
  },
  list: {
    nested: {
      listitem: "list-none",
    },
    ol: "list-decimal list-inside mb-2",
    ul: "list-disc list-inside mb-2",
    listitem: "mb-1",
    listitemChecked: "line-through opacity-60",
    listitemUnchecked: "",
  },
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    underlineStrikethrough: "underline line-through",
    code: "bg-gray-100 rounded px-1 font-mono text-sm",
  },
  code: "bg-gray-100 rounded p-4 font-mono text-sm mb-4 block overflow-x-auto",
  codeHighlight: {},
  link: "text-blue-600 hover:text-blue-800 underline",
  table: "border-collapse border border-gray-300 mb-4",
  tableCell: "border border-gray-300 px-2 py-1",
  tableRow: "",
};

// Plugin to update content when it changes
function ContentUpdatePlugin({ content }: { content: string | null | undefined }) {
  const [editor] = useLexicalComposerContext();
  const previousContent = useRef<string>("");

  useEffect(() => {
    // Only update if content has actually changed
    if (content !== previousContent.current) {
      if (content && typeof content === "string" && content.trim() !== "") {
        try {
          const editorState = editor.parseEditorState(content);
          editor.setEditorState(editorState);
        } catch (error) {
          console.warn("Failed to parse content for preview:", error);
        }
      } else {
        // Clear editor if content is empty or not a string
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
      }
      previousContent.current = content;
    }
  }, [editor, content]);

  return null;
}

export const RichTextContent: React.FC<RichTextContentProps> = ({
  content,
  className,
  themeOverrides = {},
}) => {
  // Merge default theme with overrides
  const theme = {
    ...defaultContentTheme,
    ...themeOverrides,
    heading: {
      ...defaultContentTheme.heading,
      ...(themeOverrides.heading || {}),
    },
    list: {
      ...defaultContentTheme.list,
      ...(themeOverrides.list || {}),
      nested: {
        ...defaultContentTheme.list.nested,
        ...(themeOverrides.list?.nested || {}),
      },
    },
    text: {
      ...defaultContentTheme.text,
      ...(themeOverrides.text || {}),
    },
  };

  const initialConfig = {
    namespace: "RichTextContent",
    theme,
    editable: false, // Read-only
    onError: (error: Error) => {
      console.warn("RichTextContent error:", error);
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
    ],
    // Don't set initial editor state - we'll update it via plugin
  };

  // If no content, render nothing
  if (!content || typeof content !== "string" || content.trim() === "") {
    return null;
  }

  return (
    <div className={cn("rich-text-content", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="outline-none focus:outline-none"
              style={{ userSelect: "text" }}
              readOnly
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={null}
        />
        <ContentUpdatePlugin content={content} />
      </LexicalComposer>
    </div>
  );
};

RichTextContent.displayName = "RichTextContent";
