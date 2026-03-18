"use client";

import React, { useCallback, useEffect, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { EditorState } from "lexical";
import { cn } from "@/lib/utils";

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

interface NewsEditorProps {
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
    h1: "text-2xl font-bold mb-4",
    h2: "text-xl font-bold mb-3",
    h3: "text-lg font-bold mb-2",
  },
  list: {
    nested: {
      listitem: "list-item",
    },
    ol: "list-decimal ml-4",
    ul: "list-disc ml-4",
    listitem: "list-item mb-1",
  },
  quote:
    "border-l-4 border-gray-300 dark:border-gray-700 pl-4 italic text-gray-700 dark:text-gray-300 my-4",
  link: "text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300",
  code: "bg-gray-100 dark:bg-gray-800 border rounded p-4 font-mono text-sm",
};

export function NewsEditor({
  value,
  onChange,
  placeholder = "Enter your news content here...",
  className,
  disabled = false,
}: NewsEditorProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const initialConfig = {
    namespace: "NewsEditor",
    theme: editorTheme,
    editable: !disabled,
    onError: (error: Error) => {
      console.error("Lexical Editor Error:", error);
    },
    editorState: value ? value : undefined,
  };

  const handleEditorChange = useCallback(
    (editorState: EditorState) => {
      if (onChange) {
        editorState.read(() => {
          // Convert editor state to JSON string
          const editorStateJSON = editorState.toJSON();
          onChange(JSON.stringify(editorStateJSON));
        });
      }
    },
    [onChange]
  );

  if (!isClient) {
    return (
      <div
        className={cn(
          "min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="text-muted-foreground">{placeholder}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-[200px] w-full rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[200px] resize-none px-3 py-2 text-sm outline-none"
                style={{ userSelect: "text" }}
                aria-placeholder={placeholder}
                placeholder={
                  <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
                    {placeholder}
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          {onChange && <OnChangePlugin onChange={handleEditorChange} />}
        </div>
      </LexicalComposer>
    </div>
  );
}
