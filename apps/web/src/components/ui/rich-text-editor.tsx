"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import {
  $getRoot,
  EditorState,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
  $getSelection,
  $isRangeSelection,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";

import {
  HeadingNode,
  QuoteNode,
  $createQuoteNode,
  $createHeadingNode,
  HeadingTagType,
} from "@lexical/rich-text";
import {
  ListItemNode,
  ListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { CodeHighlightNode, CodeNode, $createCodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $setBlocksType } from "@lexical/selection";
import { $createParagraphNode } from "lexical";

import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bold, Italic, Underline, List, ListOrdered, Quote, Code, Undo, Redo } from "lucide-react";

export interface RichTextEditorRef {
  getContent: () => string;
  setContent: (content: string) => void;
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  clear: () => void;
  isEmpty: () => boolean;
}

export interface RichTextEditorProps {
  initialContent?: string;
  initialMarkdown?: string;
  placeholder?: string;
  onChange?: (content: string, markdown: string, isEmpty: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  editorClassName?: string;
  toolbarClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  showToolbar?: boolean;
  minHeight?: number;
  maxHeight?: number;
  namespace?: string;
}

const editorTheme = {
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

const FONT_SIZE_OPTIONS = [
  { label: "Heading 1", value: "h1", tag: "h1" },
  { label: "Heading 2", value: "h2", tag: "h2" },
  { label: "Heading 3", value: "h3", tag: "h3" },
  { label: "Heading 4", value: "h4", tag: "h4" },
  { label: "Heading 5", value: "h5", tag: "h5" },
  { label: "Heading 6", value: "h6", tag: "h6" },
  { label: "Normal", value: "paragraph", tag: "p" },
];

function ToolbarPlugin({ className, disabled }: { className?: string; disabled?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("paragraph");

  useEffect(() => {
    const removeUndoListener = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (canUndo) => {
        setCanUndo(canUndo);
        return false;
      },
      1
    );

    const removeRedoListener = editor.registerCommand(
      CAN_REDO_COMMAND,
      (canRedo) => {
        setCanRedo(canRedo);
        return false;
      },
      1
    );

    return () => {
      removeUndoListener();
      removeRedoListener();
    };
  }, [editor]);

  const formatText = (formatType: "bold" | "italic" | "underline") => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, formatType);
  };

  const insertList = (listType: "bullet" | "number") => {
    if (listType === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const insertQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const insertCode = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createCodeNode());
      }
    });
  };

  const undo = () => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  };

  const redo = () => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  };

  const changeFontSize = (value: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (value === "paragraph") {
          $setBlocksType(selection, () => $createParagraphNode());
        } else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(value)) {
          $setBlocksType(selection, () => $createHeadingNode(value as HeadingTagType));
        }
      }
    });
    setCurrentFontSize(value);
  };

  // Update current font size based on selection
  useEffect(() => {
    const updateFontSize = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          const parent = anchorNode.getParent();

          if (parent) {
            const nodeType = parent.getType();
            if (nodeType === "heading") {
              const headingNode = parent as HeadingNode;
              setCurrentFontSize(headingNode.getTag());
            } else if (nodeType === "paragraph") {
              setCurrentFontSize("paragraph");
            }
          }
        }
      });
    };

    const removeUpdateListener = editor.registerUpdateListener(() => {
      updateFontSize();
    });

    // Initial update
    updateFontSize();

    return () => {
      removeUpdateListener();
    };
  }, [editor]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || !canUndo}
          onClick={undo}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || !canRedo}
          onClick={redo}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      <div className="flex items-center gap-2">
        <Select value={currentFontSize} onValueChange={changeFontSize} disabled={disabled}>
          <SelectTrigger className="h-8 w-[140px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => formatText("bold")}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => formatText("italic")}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => formatText("underline")}
          className="h-8 w-8 p-0"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => insertList("bullet")}
          className="h-8 w-8 p-0"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => insertList("number")}
          className="h-8 w-8 p-0"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={insertQuote}
          className="h-8 w-8 p-0"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={insertCode}
          className="h-8 w-8 p-0"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function OnChangePluginComponent({
  onChange,
}: {
  onChange?: (content: string, markdown: string, isEmpty: boolean) => void;
}) {
  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (!onChange) return;

      editorState.read(() => {
        const root = $getRoot();
        const content = JSON.stringify(editorState.toJSON());
        const markdown = $convertToMarkdownString(TRANSFORMERS);
        const isEmpty = root.getTextContent().trim().length === 0;
        onChange(content, markdown, isEmpty);
      });
    },
    [onChange]
  );

  return <OnChangePlugin onChange={handleChange} />;
}

function EditorRefPlugin({ editorRef }: { editorRef: React.RefObject<RichTextEditorRef> }) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(
    editorRef,
    () => ({
      getContent: () => {
        let content = "";
        editor.getEditorState().read(() => {
          content = JSON.stringify(editor.getEditorState().toJSON());
        });
        return content;
      },
      setContent: (content: string) => {
        try {
          const editorState = editor.parseEditorState(content);
          editor.setEditorState(editorState);
        } catch (error) {
          console.error("Error setting content:", error);
        }
      },
      getMarkdown: () => {
        let markdown = "";
        editor.getEditorState().read(() => {
          markdown = $convertToMarkdownString(TRANSFORMERS);
        });
        return markdown;
      },
      setMarkdown: (markdown: string) => {
        try {
          const editorState = editor.parseEditorState(
            JSON.stringify($convertFromMarkdownString(markdown, TRANSFORMERS))
          );
          editor.setEditorState(editorState);
        } catch (error) {
          console.error("Error setting markdown:", error);
        }
      },
      focus: () => {
        editor.focus();
      },
      clear: () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
      },
      isEmpty: () => {
        let isEmpty = true;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          isEmpty = root.getTextContent().trim().length === 0;
        });
        return isEmpty;
      },
    }),
    [editor]
  );

  return null;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (
    {
      initialContent,
      initialMarkdown,
      placeholder = "Enter some text...",
      onChange,
      onFocus,
      onBlur,
      className,
      editorClassName,
      toolbarClassName,
      disabled = false,
      autoFocus = false,
      showToolbar = true,
      minHeight = 120,
      maxHeight,
      namespace = "RichTextEditor",
    },
    ref
  ) => {
    const editorRef = React.useRef<RichTextEditorRef>(null);

    useImperativeHandle(ref, () => editorRef.current!, []);

    const initialConfig = {
      namespace,
      theme: editorTheme,
      onError: (error: Error) => {
        console.error("Lexical error:", error);
      },
      editable: !disabled,
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
      editorState: initialContent
        ? initialContent
        : initialMarkdown
          ? () => $convertFromMarkdownString(initialMarkdown, TRANSFORMERS)
          : undefined,
    };

    const containerStyle = {
      minHeight: `${minHeight}px`,
      ...(maxHeight && { maxHeight: `${maxHeight}px` }),
    };

    return (
      <div className={cn("overflow-hidden rounded-md border border-gray-300 bg-white", className)}>
        <LexicalComposer initialConfig={initialConfig}>
          {showToolbar && <ToolbarPlugin className={toolbarClassName} disabled={disabled} />}
          <div className="relative" style={containerStyle}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className={cn(
                    "min-h-full resize-none p-3 outline-none",
                    disabled && "cursor-not-allowed opacity-60",
                    editorClassName
                  )}
                  style={containerStyle}
                  aria-placeholder={placeholder}
                  placeholder={
                    <div className="pointer-events-none absolute left-3 top-3 select-none text-gray-400">
                      {placeholder}
                    </div>
                  }
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <TabIndentationPlugin />
          {autoFocus && <AutoFocusPlugin />}
          <OnChangePluginComponent onChange={onChange} />
          <EditorRefPlugin editorRef={editorRef} />
        </LexicalComposer>
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
