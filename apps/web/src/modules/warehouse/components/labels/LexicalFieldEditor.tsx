"use client";

import { useCallback, useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { $getRoot, EditorState, $createParagraphNode, $createTextNode } from "lexical";

interface LexicalFieldEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// AutoFocus Plugin
function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Focus the editor when the effect fires!
    editor.focus();
  }, [editor]);

  return null;
}

// Plugin to handle external value changes
function ValuePlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      const currentContent = root.getTextContent();

      // Only update if the value has actually changed
      if (currentContent !== value) {
        root.clear();
        if (value) {
          // Create a paragraph node with the text content
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode(value);
          paragraph.append(textNode);
          root.append(paragraph);
        }
      }
    });
  }, [editor, value]);

  return null;
}

export function LexicalFieldEditor({
  value,
  onChange,
  placeholder = "Wpisz tekst...",
}: LexicalFieldEditorProps) {
  const initialConfig = {
    namespace: "LabelFieldEditor",
    theme: {
      root: "min-h-[60px] p-2 border rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
      paragraph: "mb-0",
      text: {
        base: "text-sm",
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
      },
    },
    onError(error: Error) {
      console.error("Lexical Editor Error:", error);
    },
    editorState: undefined, // Start with empty state
  };

  // Handle editor changes
  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();

        // Only call onChange if the content has actually changed
        if (textContent !== value) {
          onChange(textContent);
        }
      });
    },
    [onChange, value]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative">
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[60px] resize-none rounded-md border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-placeholder={placeholder}
              placeholder={
                <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
                  {placeholder}
                </div>
              }
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <ValuePlugin value={value} />
        {!value && <AutoFocusPlugin />}
      </div>
    </LexicalComposer>
  );
}
