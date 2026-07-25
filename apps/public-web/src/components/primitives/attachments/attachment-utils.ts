export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMimeType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
