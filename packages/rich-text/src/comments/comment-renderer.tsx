"use client";

import { RichTextRenderer } from "../rich-text-renderer";
import { cn } from "@repo/ui/utils";
import type { CommentRendererProps } from "./comment-types";

export function CommentRenderer({
  value,
  author,
  createdAt,
  editedLabel,
  isOwn = false,
  emptyText,
  density = "default",
  className,
  contentClassName,
  actions,
  avatar,
}: CommentRendererProps) {
  const compact = density === "compact";

  return (
    <article className={cn("min-w-0", className)}>
      <div className={cn("flex min-w-0 items-center gap-3", compact && "gap-2")}>
        {avatar ?? <InitialsAvatar name={author?.name} src={author?.avatarUrl} compact={compact} />}

        {(author?.name || createdAt || editedLabel || actions) && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              {author?.name && (
                <span
                  className={cn(
                    "block max-w-full truncate text-sm font-semibold leading-none",
                    isOwn && "text-primary"
                  )}
                >
                  {author.name}
                </span>
              )}
              {(createdAt || editedLabel) && (
                <div className="flex flex-wrap items-center gap-2">
                  {createdAt && (
                    <span className="text-xs leading-none text-muted-foreground">{createdAt}</span>
                  )}
                  {editedLabel && (
                    <span className="text-xs leading-none text-muted-foreground">
                      {editedLabel}
                    </span>
                  )}
                </div>
              )}
            </div>

            {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
          </div>
        )}
      </div>

      <div className={cn(compact ? "ml-10" : "ml-12", "py-2 text-sm", contentClassName)}>
        <RichTextRenderer value={value} emptyText={emptyText} prose className="break-words" />
      </div>
    </article>
  );
}

function InitialsAvatar({
  name,
  src,
  compact,
}: {
  name?: string;
  src?: string | null;
  compact: boolean;
}) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary",
        compact ? "h-8 w-8" : "h-9 w-9"
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}
