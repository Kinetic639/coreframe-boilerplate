const MAX_INVENTORY_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg" },
  "image/png": { extension: "png" },
  "image/webp": { extension: "webp" },
  "image/gif": { extension: "gif" },
} as const;

type SupportedImageMime = keyof typeof IMAGE_TYPES;

type ImageValidationResult =
  | {
      success: true;
      data: {
        extension: string;
        file_name: string;
        file_size: number;
        mime_type: SupportedImageMime;
      };
    }
  | { success: false; error: string };

function sanitizeImageFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() || "inventory-image";
  return baseName.replace(/[^\w.\- ]+/g, "").slice(0, 180) || "inventory-image";
}

function detectedImageMime(bytes: Uint8Array): SupportedImageMime | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6 &&
    (String.fromCharCode(...bytes.slice(0, 6)) === "GIF87a" ||
      String.fromCharCode(...bytes.slice(0, 6)) === "GIF89a")
  ) {
    return "image/gif";
  }
  return null;
}

export async function validateInventoryImageFile(file: File): Promise<ImageValidationResult> {
  if (file.size <= 0) {
    return { success: false, error: "Image file is empty" };
  }
  if (file.size > MAX_INVENTORY_IMAGE_BYTES) {
    return { success: false, error: "Image file must be 5 MB or smaller" };
  }
  if (!(file.type in IMAGE_TYPES)) {
    return { success: false, error: "Image must be JPEG, PNG, WebP, or GIF" };
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mimeType = detectedImageMime(bytes);
  if (!mimeType || mimeType !== file.type) {
    return { success: false, error: "Image content does not match its file type" };
  }

  return {
    success: true,
    data: {
      extension: IMAGE_TYPES[mimeType].extension,
      file_name: sanitizeImageFileName(file.name),
      file_size: file.size,
      mime_type: mimeType,
    },
  };
}
