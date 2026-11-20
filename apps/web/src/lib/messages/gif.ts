import type { ChatMedia } from "./types";

/**
 * GIFs in chat come from KLIPY (Tenor's API was shut down on 30 June 2026;
 * KLIPY serves the same v2 API). The picker searches through our own route,
 * so the API key never reaches the browser; a sent GIF is stored as a link to
 * the provider's CDN (chat_messages.media), never copied to storage.
 */

/** Hosts a GIF may be shown from (same list as _chat_valid_media in the database) */
const GIF_HOST = /^([a-z0-9-]+\.)*(klipy\.com|klipy\.co|giphy\.com|tenor\.com)$/i;

export function isAllowedGifUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && GIF_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/** One result of a GIF search, ready to send */
export interface GifResult {
  id: string;
  title: string;
  /** Full GIF, shown in the message */
  url: string;
  /** Small version for the picker grid */
  preview_url: string;
  width: number;
  height: number;
}

export interface GifSearchPage {
  results: GifResult[];
  /** Position of the next page, null at the end */
  next: string | null;
}

interface TenorMediaFormat {
  url?: string;
  dims?: number[];
}

interface TenorResult {
  id?: string | number;
  title?: string;
  content_description?: string;
  media_formats?: Record<string, TenorMediaFormat | undefined>;
}

function pick(formats: TenorResult["media_formats"], names: string[]): TenorMediaFormat | null {
  for (const name of names) {
    const format = formats?.[name];
    if (format?.url && isAllowedGifUrl(format.url)) return format;
  }
  return null;
}

/** Tenor-v2-shaped response (KLIPY) → results with known hosts and sizes only */
export function parseGifResponse(body: unknown): GifSearchPage {
  const raw = body as { results?: TenorResult[]; next?: string | number | null } | null;
  const results: GifResult[] = [];
  for (const item of raw?.results ?? []) {
    const formats = item.media_formats;
    // A medium-size GIF for the message (a few hundred KB), a tiny one for the grid
    const full = pick(formats, ["mediumgif", "gif", "tinygif"]);
    const preview = pick(formats, ["tinygif", "nanogif", "mediumgif", "gif"]);
    const [width, height] = full?.dims ?? preview?.dims ?? [];
    if (!full || !preview || !width || !height || item.id == null) continue;
    results.push({
      id: String(item.id).slice(0, 200),
      title: (item.title || item.content_description || "").slice(0, 200),
      url: full.url!,
      preview_url: preview.url!,
      width: Math.min(Math.max(Math.round(width), 1), 4096),
      height: Math.min(Math.max(Math.round(height), 1), 4096),
    });
  }
  const next = raw?.next != null && String(raw.next) !== "" && String(raw.next) !== "0";
  return { results, next: next ? String(raw!.next) : null };
}

export function gifToMedia(gif: GifResult): ChatMedia {
  return {
    kind: "gif",
    provider: "klipy",
    id: gif.id,
    url: gif.url,
    preview_url: gif.preview_url,
    width: gif.width,
    height: gif.height,
    title: gif.title || null,
  };
}

/** Size of a GIF in a message: at most `maxWidth` × `maxHeight`, ratio kept */
export function fitGif(
  media: Pick<ChatMedia, "width" | "height">,
  maxWidth = 240,
  maxHeight = 200
): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / media.width, maxHeight / media.height);
  return {
    width: Math.max(1, Math.round(media.width * scale)),
    height: Math.max(1, Math.round(media.height * scale)),
  };
}
