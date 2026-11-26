"use client";

import { FileText, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RequestAttachment } from "@/server/requests/types";

/**
 * Files of a request or a comment. `chips`: thumbnails for images and a chip per other
 * file (under a comment); `cards`: one row per file with its size (the request's files).
 * While editing a comment each file can be removed and restored.
 */
export function AttachmentList({
  items,
  variant = "chips",
  removed,
  onToggle,
}: {
  items: RequestAttachment[];
  variant?: "chips" | "cards";
  removed?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const t = useTranslations("requests.thread");
  const locale = useLocale();
  if (items.length === 0) return null;

  const toggle = (a: RequestAttachment) =>
    onToggle && (
      <button
        type="button"
        onClick={() => onToggle(a.id)}
        aria-label={
          removed?.has(a.id)
            ? t("restoreFile", { name: a.fileName })
            : t("removeFile", { name: a.fileName })
        }
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-foreground shadow-sm hover:bg-muted"
      >
        {removed?.has(a.id) ? <Undo2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </button>
    );
  const isImage = (a: RequestAttachment) => a.contentType.startsWith("image/") && !!a.url;

  if (variant === "cards") {
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((a) => (
          <li key={a.id}>
            <a
              href={a.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-md border bg-background p-2.5 transition-colors hover:bg-muted/60"
            >
              {isImage(a) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url!} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{a.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(a.sizeBytes, locale)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  const images = items.filter(isImage);
  const others = items.filter((a) => !isImage(a));
  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <div key={a.id} className={cn("relative", removed?.has(a.id) && "opacity-40")}>
              <a
                href={a.url!}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-md border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url!} alt={a.fileName} className="h-24 w-24 object-cover" />
              </a>
              {toggle(a)}
            </div>
          ))}
        </div>
      )}
      {others.map((a) => (
        <div key={a.id} className={cn("relative w-fit pr-7", removed?.has(a.id) && "opacity-40")}>
          <a
            href={a.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-[13px] hover:bg-muted/60"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[14rem] truncate font-medium">{a.fileName}</span>
            <span className="text-muted-foreground">{formatBytes(a.sizeBytes, locale)}</span>
          </a>
          {toggle(a)}
        </div>
      ))}
    </div>
  );
}
