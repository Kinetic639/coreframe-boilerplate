/**
 * Where the small versions of a stored image live: next to the file, under the
 * same name with ".thumb.webp" or ".card.webp" ("<dir>/<uuid>.thumb.webp").
 * Used for files that have no metadata column to record them (product images,
 * feedback screenshots): a missing small version falls back to the full file.
 */

export type ImageVariant = "thumb" | "card";

const EXTENSION = /\.[a-zA-Z0-9]{1,12}$/;

/** Storage path of a small version of the file at `storagePath`. */
export function imageVariantPath(
  storagePath: string,
  variant: ImageVariant,
  contentType = "image/webp"
): string {
  const extension = contentType === "image/jpeg" ? "jpg" : "webp";
  return `${storagePath.replace(EXTENSION, "")}.${variant}.${extension}`;
}

/**
 * Public URL of the WebP small version of the file at `url` (query string kept),
 * or null when the URL has no file extension to replace.
 */
export function imageVariantUrl(url: string, variant: ImageVariant): string | null {
  const queryStart = url.search(/[?#]/);
  const base = queryStart === -1 ? url : url.slice(0, queryStart);
  const rest = queryStart === -1 ? "" : url.slice(queryStart);
  if (!EXTENSION.test(base) || /\.(thumb|card)\.[a-z]+$/i.test(base)) return null;
  return `${base.replace(EXTENSION, "")}.${variant}.webp${rest}`;
}
