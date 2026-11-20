"use client";

import Image from "next/image";
import { useState } from "react";
import { imageVariantUrl, type ImageVariant } from "@/lib/media/image-variant-paths";

/**
 * A product image shown through its small version ("<file>.thumb.webp" for
 * tiles, ".card.webp" for the main picture). Images uploaded before small
 * versions existed have none: the first load error switches to the full file.
 */
export function InventoryImage({
  src,
  variant,
  alt = "",
  width,
  height,
  className,
  eager = false,
}: {
  src: string;
  variant: ImageVariant;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  /** Load at once (the main picture above the fold) instead of when scrolled into view. */
  eager?: boolean;
}) {
  const small = imageVariantUrl(src, variant);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const current = small && failedFor !== src ? small : src;
  return (
    <Image
      src={current}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      onError={current === small ? () => setFailedFor(src) : undefined}
    />
  );
}
