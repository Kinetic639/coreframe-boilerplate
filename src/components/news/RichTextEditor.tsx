"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// Lexical core
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

// List functionality
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { ListNode, ListItemNode } from "@lexical/list";

// Link functionality
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { LinkNode, AutoLinkNode } from "@lexical/link";

// Rich text nodes
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeNode, CodeHighlightNode } from "@lexical/code";

// Toolbar functionality
import { $getSelection, $isRangeSelection, EditorState, FORMAT_TEXT_COMMAND } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Toolbar Plugin
function ToolbarPlugin() {
  const t = useTranslations("news.editor.toolbar");
  const [editor] = useLexicalComposerContext();
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
  });

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setActiveStates({
        bold: selection.hasFormat("bold"),
        italic: selection.hasFormat("italic"),
        underline: selection.hasFormat("underline"),
        strikethrough: selection.hasFormat("strikethrough"),
        code: selection.hasFormat("code"),
      });
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatText = (format: "bold" | "italic" | "underline" | "strikethrough" | "code") => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatHeading = (headingSize: "h1" | "h2" | "h3") => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
      }
    });
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const formatList = (listType: "bullet" | "number") => {
    if (listType === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
      {/* Text formatting */}
      <Button
        size="sm"
        variant={activeStates.bold ? "default" : "ghost"}
        onClick={() => formatText("bold")}
        title={t("bold")}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={activeStates.italic ? "default" : "ghost"}
        onClick={() => formatText("italic")}
        title={t("italic")}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={activeStates.underline ? "default" : "ghost"}
        onClick={() => formatText("underline")}
        title={t("underline")}
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={activeStates.strikethrough ? "default" : "ghost"}
        onClick={() => formatText("strikethrough")}
        title={t("strikethrough")}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Headings */}
      <Button size="sm" variant="ghost" onClick={() => formatHeading("h1")} title={t("heading")}>
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => formatHeading("h2")} title={t("heading")}>
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => formatHeading("h3")} title={t("heading")}>
        <Heading3 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Lists */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => formatList("bullet")}
        title={t("bulletList")}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => formatList("number")}
        title={t("numberedList")}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Quote */}
      <Button size="sm" variant="ghost" onClick={formatQuote} title={t("quote")}>
        <Quote className="h-4 w-4" />
      </Button>

      {/* Code */}
      <Button
        size="sm"
        variant={activeStates.code ? "default" : "ghost"}
        onClick={() => formatText("code")}
        title={t("code")}
      >
        <Code className="h-4 w-4" />
      </Button>
    </div>
  );
}

// OnChange Plugin
interface OnChangePluginProps {
  onChange: (editorState: EditorState) => void;
}

function OnChangePlugin({ onChange }: OnChangePluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState);
    });
  }, [editor, onChange]);

  return null;
}

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const editorTheme = {
  paragraph: "mb-2",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono",
  },
  heading: {
    h1: "text-2xl font-bold mb-4 mt-2",
    h2: "text-xl font-bold mb-3 mt-2",
    h3: "text-lg font-bold mb-2 mt-2",
  },
  list: {
    nested: {
      listitem: "list-item",
    },
    ol: "list-decimal ml-6 mb-2",
    ul: "list-disc ml-6 mb-2",
    listitem: "list-item mb-1",
  },
  quote:
    "border-l-4 border-gray-300 dark:border-gray-700 pl-4 italic text-gray-700 dark:text-gray-300 my-4 bg-gray-50 dark:bg-gray-900 py-2 rounded-r",
  link: "text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300",
  code: "bg-gray-100 dark:bg-gray-800 border rounded p-4 font-mono text-sm my-2 overflow-x-auto",
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter your news content here...",
  className,
  disabled = false,
}: RichTextEditorProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Parse initial value if provided
  let initialEditorState = undefined;
  if (value) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(value);
      initialEditorState = JSON.stringify(parsed);
    } catch {
      // If not valid JSON, treat as plain text
      initialEditorState = undefined;
    }
  }

  const initialConfig = {
    namespace: "NewsRichTextEditor",
    theme: editorTheme,
    editable: !disabled,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
    ],
    editorState: initialEditorState,
    onError: (error: Error) => {
      console.error("Rich Text Editor Error:", error);
    },
  };

  const handleEditorChange = useCallback(
    (editorState: EditorState) => {
      if (onChange) {
        // Convert editor state to JSON string
        const editorStateJSON = editorState.toJSON();
        onChange(JSON.stringify(editorStateJSON));
      }
    },
    [onChange]
  );

  if (!isClient) {
    return (
      <div
        className={cn(
          "min-h-[300px] w-full rounded-md border border-input bg-background",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <ToolbarPlugin />
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="min-h-[200px] resize-none px-4 py-3 text-sm outline-none [&_*]:max-w-full"
                  style={{ userSelect: "text" }}
                  aria-placeholder={placeholder}
                />
              }
              placeholder={
                <div className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          {onChange && <OnChangePlugin onChange={handleEditorChange} />}
        </div>
      </LexicalComposer>
    </div>
  );
}
