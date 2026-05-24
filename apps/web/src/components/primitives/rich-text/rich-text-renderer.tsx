import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/core";
import { cn } from "@/utils";
import { isRichTextEmpty } from "./rich-text-utils";
import type { RichTextRendererProps } from "./rich-text-types";

function safeHref(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;

  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

function applyMarks(text: string, marks: JSONContent[] | undefined): ReactNode {
  if (!marks?.length) return text;
  return marks.reduce<ReactNode>((node, mark) => {
    switch (mark.type) {
      case "bold":
        return <strong>{node}</strong>;
      case "italic":
        return <em>{node}</em>;
      case "underline":
        return <u>{node}</u>;
      case "strike":
        return <s>{node}</s>;
      case "code":
        return <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{node}</code>;
      case "link": {
        const href = safeHref(mark.attrs?.href as string | undefined);
        if (!href) return node;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {node}
          </a>
        );
      }
      default:
        return node;
    }
  }, text as ReactNode);
}

function renderNode(node: JSONContent, index: number): ReactNode {
  const children = node.content?.map((child, i) => renderNode(child, i));
  const textAlign = (node.attrs as Record<string, unknown> | undefined)?.textAlign as
    | CSSProperties["textAlign"]
    | undefined;
  const style: CSSProperties | undefined = textAlign ? { textAlign } : undefined;

  switch (node.type) {
    case "doc":
      return <Fragment key={index}>{children}</Fragment>;

    case "paragraph":
      return (
        <p key={index} style={style} className="leading-relaxed">
          {children?.length ? children : <br />}
        </p>
      );

    case "heading": {
      const level = (node.attrs as Record<string, unknown>)?.level as number | undefined;
      const headingChildren = children;
      if (level === 1)
        return (
          <h1 key={index} style={style} className="text-2xl font-bold">
            {headingChildren}
          </h1>
        );
      if (level === 2)
        return (
          <h2 key={index} style={style} className="text-xl font-semibold">
            {headingChildren}
          </h2>
        );
      return (
        <h3 key={index} style={style} className="text-lg font-semibold">
          {headingChildren}
        </h3>
      );
    }

    case "text":
      return <Fragment key={index}>{applyMarks(node.text ?? "", node.marks)}</Fragment>;

    case "bulletList":
      return (
        <ul key={index} className="list-disc pl-5 space-y-0.5">
          {children}
        </ul>
      );

    case "orderedList":
      return (
        <ol key={index} className="list-decimal pl-5 space-y-0.5">
          {children}
        </ol>
      );

    case "listItem":
      return <li key={index}>{children}</li>;

    case "blockquote":
      return (
        <blockquote
          key={index}
          className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground"
        >
          {children}
        </blockquote>
      );

    case "codeBlock":
      return (
        <pre
          key={index}
          className="rounded-md bg-muted px-4 py-3 text-xs font-mono overflow-x-auto"
        >
          <code>{children}</code>
        </pre>
      );

    case "hardBreak":
      return <br key={index} />;

    case "horizontalRule":
      return <hr key={index} className="border-border my-2" />;

    default:
      return null;
  }
}

export function RichTextRenderer({
  value,
  className,
  prose = true,
  emptyText,
}: RichTextRendererProps) {
  if (isRichTextEmpty(value)) {
    if (!emptyText) return null;
    return <p className={cn("text-muted-foreground text-sm", className)}>{emptyText}</p>;
  }

  const nodes = value!.content?.map((node, i) => renderNode(node, i));

  return (
    <div
      className={cn(
        "text-sm",
        prose && [
          "[&>p+p]:mt-2",
          "[&>ul]:my-2 [&>ol]:my-2",
          "[&>h1+*]:mt-1 [&>h2+*]:mt-1 [&>h3+*]:mt-1",
          "[&>blockquote]:my-2",
          "[&>pre]:my-2",
          "[&>hr]:my-3",
        ],
        className
      )}
    >
      {nodes}
    </div>
  );
}
