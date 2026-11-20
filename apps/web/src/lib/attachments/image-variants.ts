/**
 * Small versions of an attached image, made in the browser when it is uploaded
 * and stored next to it ("<dir>/<uuid>.thumb.webp"). Their paths and sizes are
 * kept in app_attachments.metadata.variants.
 */

export type AttachmentVariant = "thumb" | "card";

export interface AttachmentVariantMeta {
  path: string;
  width: number;
  height: number;
  size: number;
  content_type: string;
}

export interface AttachmentImageMeta {
  width?: number;
  height?: number;
  variants?: Partial<Record<AttachmentVariant, AttachmentVariantMeta>>;
}

function stem(storagePath: string): string {
  return storagePath.replace(/\.[a-zA-Z0-9]{1,12}$/, "");
}

/** True when `path` is a small version stored next to `storagePath`. */
export function isVariantPathOf(
  storagePath: string,
  path: string,
  variant: AttachmentVariant
): boolean {
  return (
    path === `${stem(storagePath)}.${variant}.webp` ||
    path === `${stem(storagePath)}.${variant}.jpg`
  );
}

/**
 * Path of a small version from an attachment row's metadata, or null when it
 * has none. Only a path next to the stored file is accepted, so metadata can
 * never point the signed link at another file.
 */
export function attachmentVariantPath(
  storagePath: string,
  metadata: unknown,
  variant: AttachmentVariant
): string | null {
  const variants = (metadata as AttachmentImageMeta | null)?.variants;
  const path = variants?.[variant]?.path;
  return typeof path === "string" && isVariantPathOf(storagePath, path, variant) ? path : null;
}

/** Every small-version path recorded for an attachment (to remove them with it). */
export function attachmentVariantPaths(storagePath: string, metadata: unknown): string[] {
  return (["thumb", "card"] as const)
    .map((variant) => attachmentVariantPath(storagePath, metadata, variant))
    .filter((path): path is string => Boolean(path));
}

/** Address of an attachment's image for <img src>: the small version when asked for one. */
export function attachmentImageSrc(attachmentId: string, variant?: AttachmentVariant): string {
  return variant
    ? `/api/files/attachments/${attachmentId}?v=${variant}`
    : `/api/files/attachments/${attachmentId}`;
}

/**
 * onError for an attachment's <img>: loads it once more, past the browser's
 * cached redirect (a signed link can expire or a request can fail on the
 * way). A second failure is left as it is.
 */
export function retryAttachmentImage(event: { currentTarget: HTMLImageElement }): void {
  const img = event.currentTarget;
  if (img.dataset.retried) return;
  img.dataset.retried = "1";
  const url = new URL(img.src, window.location.href);
  url.searchParams.set("retry", String(Date.now()));
  img.src = url.toString();
}
