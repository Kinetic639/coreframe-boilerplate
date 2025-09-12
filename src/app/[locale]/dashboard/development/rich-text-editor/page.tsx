"use client";

import { useState, useRef } from "react";
import { RichTextEditor, RichTextEditorRef } from "@/components/ui/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "react-toastify";
import {
  Copy,
  Download,
  Upload,
  RefreshCw,
  FileText,
  Code,
  Eye,
  Settings,
  Trash2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const SAMPLE_CONTENT = {
  markdown: `# Welcome to Rich Text Editor Testing

This is a **comprehensive test** for the *Rich Text Editor* component.

## Features

- **Bold text** and *italic text*
- ~~Strikethrough~~ and \`inline code\`
- [Links](https://example.com)

### Lists

1. Ordered list item 1
2. Ordered list item 2
3. Ordered list item 3

- Unordered list item A
- Unordered list item B
- Unordered list item C

### Code Block

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}

hello("World");
\`\`\`

### Blockquote

> This is a blockquote. It can contain multiple lines and various formatting.
> 
> - Even lists inside blockquotes
> - Work perfectly fine

---

## Testing Notes

This editor supports:
- Markdown shortcuts
- Copy/paste functionality
- Undo/redo operations
- Real-time content synchronization
- Mobile-responsive design`,

  json: '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Sample JSON content for testing the editor state.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
};

export default function RichTextEditorTestPage() {
  const editorRef = useRef<RichTextEditorRef>(null);

  const [content, setContent] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isEmpty, setIsEmpty] = useState(true);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [autoFocus, setAutoFocus] = useState(false);
  const [minHeight, setMinHeight] = useState(120);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const [testResults, setTestResults] = useState<{
    content: boolean;
    markdown: boolean;
    focus: boolean;
    clear: boolean;
    isEmpty: boolean;
  }>({
    content: false,
    markdown: false,
    focus: false,
    clear: false,
    isEmpty: false,
  });

  const handleEditorChange = (newContent: string, newMarkdown: string, newIsEmpty: boolean) => {
    setContent(newContent);
    setMarkdown(newMarkdown);
    setIsEmpty(newIsEmpty);
  };

  const handleFocus = () => {
    toast.info("Editor focused!");
  };

  const handleBlur = () => {
    toast.info("Editor blurred!");
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${type} copied to clipboard!`);
      })
      .catch(() => {
        toast.error(`Failed to copy ${type.toLowerCase()}`);
      });
  };

  const testContentMethods = () => {
    if (!editorRef.current) return;

    // Test setContent
    editorRef.current.setContent(SAMPLE_CONTENT.json);
    setTimeout(() => {
      const retrievedContent = editorRef.current!.getContent();
      setTestResults((prev) => ({
        ...prev,
        content: retrievedContent.length > 0,
      }));

      // Test getMarkdown and setMarkdown
      setTimeout(() => {
        editorRef.current!.setMarkdown(SAMPLE_CONTENT.markdown);

        setTimeout(() => {
          const newMarkdown = editorRef.current!.getMarkdown();
          setTestResults((prev) => ({
            ...prev,
            markdown: newMarkdown.includes("Welcome to Rich Text Editor"),
          }));
        }, 100);
      }, 100);
    }, 100);
  };

  const testFocus = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    setTestResults((prev) => ({ ...prev, focus: true }));
    toast.info("Focus method called");
  };

  const testClear = () => {
    if (!editorRef.current) return;
    editorRef.current.clear();
    setTimeout(() => {
      const empty = editorRef.current!.isEmpty();
      setTestResults((prev) => ({ ...prev, clear: true, isEmpty: empty }));
    }, 100);
  };

  const loadSampleContent = (type: "markdown" | "json") => {
    if (!editorRef.current) return;

    if (type === "markdown") {
      editorRef.current.setMarkdown(SAMPLE_CONTENT.markdown);
    } else {
      editorRef.current.setContent(SAMPLE_CONTENT.json);
    }
    toast.success(`Sample ${type.toUpperCase()} content loaded!`);
  };

  const exportContent = (format: "markdown" | "json") => {
    if (!editorRef.current) return;

    const content =
      format === "markdown" ? editorRef.current.getMarkdown() : editorRef.current.getContent();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `editor-content.${format === "markdown" ? "md" : "json"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Content exported as ${format.toUpperCase()}!`);
  };

  const runAllTests = () => {
    setTestResults({
      content: false,
      markdown: false,
      focus: false,
      clear: false,
      isEmpty: false,
    });

    testContentMethods();
    setTimeout(() => testFocus(), 200);
    setTimeout(() => testClear(), 400);

    toast.info("Running comprehensive tests...");
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Rich Text Editor Testing</h1>
        <p className="text-muted-foreground">
          Comprehensive testing interface for the RichTextEditor component
        </p>
      </div>

      <Tabs defaultValue="editor" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Live Editor
              </CardTitle>
              <CardDescription>Test the rich text editor with all features enabled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadSampleContent("markdown")}>
                    <Upload className="mr-2 h-4 w-4" />
                    Load Markdown
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadSampleContent("json")}>
                    <Code className="mr-2 h-4 w-4" />
                    Load JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => editorRef.current?.clear()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => editorRef.current?.focus()}>
                    <Eye className="mr-2 h-4 w-4" />
                    Focus
                  </Button>
                </div>

                <RichTextEditor
                  ref={editorRef}
                  placeholder="Start typing to test the rich text editor..."
                  onChange={handleEditorChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  disabled={isDisabled}
                  autoFocus={autoFocus}
                  showToolbar={showToolbar}
                  minHeight={minHeight}
                  maxHeight={maxHeight}
                  className="max-w-full"
                />

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant={isEmpty ? "secondary" : "default"}>
                    {isEmpty ? "Empty" : "Has Content"}
                  </Badge>
                  <span>Characters: {markdown.length}</span>
                  <span>Words: {markdown.split(/\s+/).filter(Boolean).length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Markdown Content
                </CardTitle>
                <CardDescription>Current markdown representation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(markdown, "Markdown")}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportContent("markdown")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-sm">
                    {markdown || "No content yet..."}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  JSON Content
                </CardTitle>
                <CardDescription>Raw editor state as JSON</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(content, "JSON")}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportContent("json")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-sm">
                    {content ? JSON.stringify(JSON.parse(content), null, 2) : "No content yet..."}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Editor Settings
              </CardTitle>
              <CardDescription>Adjust editor configuration for testing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Disabled
                    <input
                      type="checkbox"
                      checked={isDisabled}
                      onChange={(e) => setIsDisabled(e.target.checked)}
                      className="ml-2"
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Show Toolbar
                    <input
                      type="checkbox"
                      checked={showToolbar}
                      onChange={(e) => setShowToolbar(e.target.checked)}
                      className="ml-2"
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Auto Focus
                    <input
                      type="checkbox"
                      checked={autoFocus}
                      onChange={(e) => setAutoFocus(e.target.checked)}
                      className="ml-2"
                    />
                  </label>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Min Height (px)</label>
                  <input
                    type="number"
                    value={minHeight}
                    onChange={(e) => setMinHeight(parseInt(e.target.value) || 120)}
                    className="w-full rounded-md border px-3 py-2"
                    min="60"
                    max="800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Height (px)</label>
                  <input
                    type="number"
                    value={maxHeight || ""}
                    onChange={(e) =>
                      setMaxHeight(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    className="w-full rounded-md border px-3 py-2"
                    min="120"
                    max="1200"
                    placeholder="No limit"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Component API Tests
              </CardTitle>
              <CardDescription>Test all public methods and functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runAllTests} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Run All Tests
              </Button>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Method Tests</h4>
                  <div className="space-y-1">
                    {Object.entries(testResults).map(([test, passed]) => (
                      <div key={test} className="flex items-center justify-between">
                        <span className="text-sm capitalize">
                          {test.replace(/([A-Z])/g, " $1").toLowerCase()}
                        </span>
                        {passed ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Manual Tests</h4>
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={testContentMethods}
                      className="w-full"
                    >
                      Test Content Methods
                    </Button>
                    <Button size="sm" variant="outline" onClick={testFocus} className="w-full">
                      Test Focus Method
                    </Button>
                    <Button size="sm" variant="outline" onClick={testClear} className="w-full">
                      Test Clear Method
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
