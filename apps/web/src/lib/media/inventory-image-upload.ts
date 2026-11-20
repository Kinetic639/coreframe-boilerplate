"use client";

import { compressImageFile, prepareImage } from "@/lib/media/image-compress";

/**
 * Puts a product image into the upload form: the photo shrunk to 2048 px WebP
 * as "file", and its 160 px and 640 px versions as "thumb" and "card". The
 * server stores those next to the photo, so lists and tiles load a few KB
 * instead of the full file.
 */
export async function setInventoryImageFiles(formData: FormData, file: File): Promise<void> {
  const prepared = await prepareImage(file).catch(() => null);
  if (!prepared) {
    formData.set("file", await compressImageFile(file));
    return;
  }
  formData.set("file", prepared.file);
  for (const variant of prepared.variants) {
    const extension = variant.blob.type === "image/jpeg" ? "jpg" : "webp";
    formData.set(
      variant.name,
      new File([variant.blob], `${variant.name}.${extension}`, { type: variant.blob.type })
    );
  }
}
