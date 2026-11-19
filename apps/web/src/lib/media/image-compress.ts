"use client";

/**
 * Shrinks photos in the browser before they are uploaded, and makes the small
 * versions that lists and cards show instead of the full file.
 *
 * A phone photo is 3-4 MB at 4000 px; on screen it is shown at 56-640 px. The
 * full photo is scaled to at most FULL_EDGE px and saved as WebP (about 0.3 MB),
 * and a THUMB_EDGE and a CARD_EDGE version are made next to it. Re-drawing the
 * photo also turns it upright (EXIF rotation) and drops its EXIF data,
 * including the GPS position.
 */

/** Longest edge of the stored photo. */
export const FULL_EDGE = 2048;
/** Longest edge of the small version for tiles and pickers (56-128 px on screen, sharp on 2x screens). */
export const THUMB_EDGE = 160;
/** Longest edge of the version for card covers and panels. */
export const CARD_EDGE = 640;

const FULL_QUALITY = 0.8;
const VARIANT_QUALITY = 0.78;
/** Files this small are kept as they are, unless they are larger than FULL_EDGE. */
const KEEP_BELOW_BYTES = 300 * 1024;
/** Above this many pixels a phone may run out of memory decoding the photo. */
const MAX_DECODE_PIXELS = 60_000_000;

const RESIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const THUMBNAIL_TYPES = new Set([...RESIZABLE_TYPES, "image/gif"]);

export type ImageVariantName = "thumb" | "card";

export interface PreparedImageVariant {
  name: ImageVariantName;
  blob: Blob;
  width: number;
  height: number;
}

export interface PreparedImage {
  /** The file to store: the shrunk photo, or the picked file when shrinking would not help. */
  file: File;
  width: number;
  height: number;
  variants: PreparedImageVariant[];
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decode(file: Blob): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall back to an <img> below.
    }
  }
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/** Size that fits within maxEdge on its longest side; never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function encode(
  decoded: Decoded,
  width: number,
  height: number,
  type: string,
  quality: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.source, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * WebP where the browser can write it; otherwise JPEG for photos. Returns null
 * when the result would lose transparency (a PNG in a browser without WebP).
 */
async function encodeCompact(
  decoded: Decoded,
  width: number,
  height: number,
  sourceType: string,
  quality: number
): Promise<Blob | null> {
  const webp = await encode(decoded, width, height, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  if (sourceType === "image/png" || sourceType === "image/gif") return null;
  const jpeg = await encode(decoded, width, height, "image/jpeg", quality + 0.02);
  return jpeg && jpeg.type === "image/jpeg" ? jpeg : null;
}

function renamed(name: string, type: string): string {
  const extension = type === "image/webp" ? ".webp" : type === "image/jpeg" ? ".jpg" : "";
  if (!extension) return name;
  const base = name.replace(/\.[a-zA-Z0-9]{1,12}$/, "") || "image";
  return `${base}${extension}`;
}

/** True for files this module can make small versions of. */
export function canPrepareImage(file: Blob): boolean {
  return THUMBNAIL_TYPES.has(file.type);
}

/**
 * The file to upload and its small versions. Returns null for files that are
 * not images, or that the browser cannot read: upload those unchanged.
 *
 * keepOriginal leaves the stored file as picked (only the small versions are made).
 */
export async function prepareImage(
  file: File,
  options: { keepOriginal?: boolean; variants?: ImageVariantName[] } = {}
): Promise<PreparedImage | null> {
  if (!canPrepareImage(file) || typeof document === "undefined") return null;
  const decoded = await decode(file);
  if (!decoded) return null;
  try {
    const { width, height } = decoded;
    if (!width || !height || width * height > MAX_DECODE_PIXELS) return null;

    let stored = file;
    let storedSize = { width, height };
    const resizable = RESIZABLE_TYPES.has(file.type) && !options.keepOriginal;
    if (resizable && (file.size > KEEP_BELOW_BYTES || Math.max(width, height) > FULL_EDGE)) {
      const target = fitWithin(width, height, FULL_EDGE);
      const blob = await encodeCompact(
        decoded,
        target.width,
        target.height,
        file.type,
        FULL_QUALITY
      );
      if (blob && blob.size < file.size) {
        stored = new File([blob], renamed(file.name, blob.type), {
          type: blob.type,
          lastModified: file.lastModified,
        });
        storedSize = target;
      }
    }

    const variants: PreparedImageVariant[] = [];
    const wanted = options.variants ?? ["thumb", "card"];
    for (const name of wanted) {
      const edge = name === "thumb" ? THUMB_EDGE : CARD_EDGE;
      // A card version of a photo no larger than the card adds nothing.
      if (name === "card" && Math.max(width, height) <= CARD_EDGE) continue;
      const size = fitWithin(width, height, edge);
      const blob = await encodeCompact(
        decoded,
        size.width,
        size.height,
        file.type,
        VARIANT_QUALITY
      );
      if (blob && blob.size < stored.size) variants.push({ name, blob, ...size });
    }

    return { file: stored, ...storedSize, variants };
  } catch {
    return null;
  } finally {
    decoded.close();
  }
}

/**
 * The photo shrunk to FULL_EDGE px (WebP), without small versions; the picked
 * file when it is not a photo or shrinking would not help.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!canPrepareImage(file) || file.type === "image/gif") return file;
  const prepared = await prepareImage(file, { variants: [] }).catch(() => null);
  return prepared?.file ?? file;
}

/** Storage path of a small version, next to the stored file: "<dir>/<uuid>.thumb.webp". */
export function variantStoragePath(
  storagePath: string,
  name: ImageVariantName,
  type: string
): string {
  const extension = type === "image/jpeg" ? "jpg" : "webp";
  return `${storagePath.replace(/\.[a-zA-Z0-9]{1,12}$/, "")}.${name}.${extension}`;
}

/** Browsers keep these for a year: a stored file never changes under its path. */
export const IMMUTABLE_CACHE_SECONDS = 365 * 24 * 60 * 60;
