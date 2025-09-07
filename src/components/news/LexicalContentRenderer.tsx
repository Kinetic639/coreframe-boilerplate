"use client";

import React from "react";

interface LexicalContentRendererProps {
  content: any;
  className?: string;
}

export function LexicalContentRenderer({ content, className = "" }: LexicalContentRendererProps) {
  // If content is a string, render as simple text
  if (typeof content === "string") {
    return (
      <div className={`prose prose-sm dark:prose-invert max-w-none text-foreground ${className}`}>
        {content.split("\n").map((paragraph, index) => (
          <p key={index} className="mb-2 leading-relaxed text-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  // If content is Lexical JSON, try to render it
  if (content && typeof content === "object") {
    try {
      const renderLexicalNode = (node: any): React.ReactNode => {
        if (!node) return null;

        switch (node.type) {
          case "paragraph":
            return (
              <p key={node.key || Math.random()} className="mb-2 leading-relaxed">
                {node.children?.map((child: any) => renderLexicalNode(child))}
              </p>
            );

          case "heading":
            const HeadingTag = `h${node.tag}` as keyof JSX.IntrinsicElements;
            const headingClasses =
              {
                h1: "text-2xl font-bold mb-4 mt-2",
                h2: "text-xl font-bold mb-3 mt-2",
                h3: "text-lg font-bold mb-2 mt-2",
              }[node.tag] || "text-lg font-bold mb-2 mt-2";

            return (
              <HeadingTag key={node.key || Math.random()} className={headingClasses}>
                {node.children?.map((child: any) => renderLexicalNode(child))}
              </HeadingTag>
            );

          case "list":
            const ListTag = node.listType === "number" ? "ol" : "ul";
            const listClasses =
              node.listType === "number" ? "list-decimal ml-6 mb-2" : "list-disc ml-6 mb-2";

            return (
              <ListTag key={node.key || Math.random()} className={listClasses}>
                {node.children?.map((child: any) => renderLexicalNode(child))}
              </ListTag>
            );

          case "listitem":
            return (
              <li key={node.key || Math.random()} className="mb-1 list-item">
                {node.children?.map((child: any) => renderLexicalNode(child))}
              </li>
            );

          case "quote":
            return (
              <blockquote
                key={node.key || Math.random()}
                className="my-4 rounded-r border-l-4 border-gray-300 bg-gray-50 py-2 pl-4 italic text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {node.children?.map((child: any) => renderLexicalNode(child))}
              </blockquote>
            );

          case "text":
            const textElement = node.text || "";
            let textClassName = "";

            if (node.format) {
              if (node.format & 1) textClassName += " font-bold"; // Bold
              if (node.format & 2) textClassName += " italic"; // Italic
              if (node.format & 4) textClassName += " line-through"; // Strikethrough
              if (node.format & 8) textClassName += " underline"; // Underline
              if (node.format & 16)
                textClassName +=
                  " bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono"; // Code
            }

            return textClassName ? (
              <span key={node.key || Math.random()} className={textClassName}>
                {textElement}
              </span>
            ) : (
              textElement
            );

          case "linebreak":
            return <br key={node.key || Math.random()} />;

          default:
            // For unknown node types, try to render children
            if (node.children) {
              return node.children.map((child: any) => renderLexicalNode(child));
            }
            return null;
        }
      };

      const root = content.root || content;
      if (root && root.children) {
        return (
          <div
            className={`prose prose-sm dark:prose-invert max-w-none text-foreground ${className}`}
          >
            {root.children.map((child: any) => renderLexicalNode(child))}
          </div>
        );
      }
    } catch (error) {
      console.error("Error rendering Lexical content:", error);
    }
  }

  // Fallback for any content that can't be rendered
  return (
    <div className={`italic text-muted-foreground ${className}`}>
      Content format not supported for preview
    </div>
  );
}
