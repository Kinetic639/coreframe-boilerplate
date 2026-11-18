"use client";

import type { AppAttachment } from "@/server/services/attachments.service";

/** The app's own address of a file (it checks access and streams it). */
export function attachmentFilePath(
  attachment: Pick<AppAttachment, "id" | "file_name">,
  locale: string,
  download = false
): string {
  const base = locale === "en" ? "/en/attachments" : "/zalaczniki";
  const action = locale === "en" ? "download" : "pobierz";
  const path = `${base}/${attachment.id}/${action}/${encodeURIComponent(attachment.file_name)}`;
  return download ? `${path}?download=1` : path;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Two files may share a name: the second becomes "name (2).ext". */
function uniqueNames(attachments: AppAttachment[]): string[] {
  const seen = new Map<string, number>();
  return attachments.map((attachment) => {
    const name = attachment.file_name || "plik";
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
  });
}

/**
 * One file downloads as it is; several come as one .zip made in the browser
 * (nothing extra on the server, and a phone gets a single file).
 */
export async function downloadAttachments(
  attachments: AppAttachment[],
  locale: string,
  archiveName: string
): Promise<void> {
  if (attachments.length === 0) return;
  if (attachments.length === 1) {
    const link = document.createElement("a");
    link.href = attachmentFilePath(attachments[0], locale, true);
    link.download = attachments[0].file_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const { zip } = await import("fflate");
  const names = uniqueNames(attachments);
  const entries: Record<string, Uint8Array> = {};
  await Promise.all(
    attachments.map(async (attachment, index) => {
      const response = await fetch(attachmentFilePath(attachment, locale, true), {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`${attachment.file_name}: ${response.status}`);
      entries[names[index]] = new Uint8Array(await response.arrayBuffer());
    })
  );

  const archive = await new Promise<Uint8Array>((resolve, reject) =>
    // Photos and PDFs are already compressed: storing is as small and much faster.
    zip(entries, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data)))
  );
  saveBlob(new Blob([archive as BlobPart], { type: "application/zip" }), `${archiveName}.zip`);
}
