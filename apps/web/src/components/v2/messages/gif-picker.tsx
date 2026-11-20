"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { useGifSearch } from "@/hooks/queries/messages";
import type { GifResult } from "@/lib/messages/gif";

const SEARCH_DELAY_MS = 350;

/**
 * GIF search (trending until something is typed), two columns of small
 * previews; picking one sends it at once, like Messenger. Results come from
 * KLIPY through /api/chat/gifs; its attribution is shown under the search.
 */
export function GifPickerPanel({ onSelect }: { onSelect: (gif: GifResult) => void }) {
  const t = useTranslations("chat.gif");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const search = useGifSearch(query, locale === "en" ? "en" : "pl", true);
  const gifs = search.data?.pages.flatMap((page) => page.results) ?? [];
  const error = search.error?.message;

  // The next page loads when the end of the list comes into view
  const endRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = search;
  useEffect(() => {
    const end = endRef.current;
    if (!end || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Two columns, each GIF in the shorter one (masonry without layout jumps)
  const columns: [GifResult[], GifResult[]] = [[], []];
  const heights = [0, 0];
  for (const gif of gifs) {
    const column = heights[0] <= heights[1] ? 0 : 1;
    columns[column].push(gif);
    heights[column] += gif.height / gif.width;
  }

  return (
    <div className="flex h-[360px] w-[296px] flex-col" data-testid="gif-picker">
      <div className="relative mx-2 mt-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="h-7 w-full rounded-md border bg-background pl-6 pr-2 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
        />
      </div>
      <p className="mx-2 mb-1 mt-1 text-right text-[10px] text-muted-foreground">
        {t("poweredBy")}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {error === "not_configured" ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {t("notConfigured")}
          </p>
        ) : search.isError ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {error === "rate_limited" ? t("rateLimited") : t("failed")}
          </p>
        ) : search.isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <>
            <div className="flex gap-1.5">
              {columns.map((column, index) => (
                <div key={index} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {column.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      title={gif.title || undefined}
                      onClick={() => onSelect(gif)}
                      className="overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
                    >
                      <img
                        src={gif.preview_url}
                        alt={gif.title}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div ref={endRef} className="flex h-6 items-center justify-center">
              {isFetchingNextPage ? (
                <Loader2 className="size-3 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
