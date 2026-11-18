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

/** A file that does not arrive in this time fails instead of spinning forever. */
const FILE_TIMEOUT_MS = 60_000;

async function fetchFile(url: string, init?: RequestInit): Promise<Blob> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FILE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(String(response.status));
    return await response.blob();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Straight from storage (its link is signed for an hour); through the app's
 * own address when the link has expired or does not work.
 */
async function fetchAttachment(attachment: AppAttachment, locale: string): Promise<Blob> {
  if (attachment.download_url) {
    try {
      return await fetchFile(attachment.download_url);
    } catch {
      // Fall through to the app's address.
    }
  }
  try {
    return await fetchFile(attachmentFilePath(attachment, locale, true), {
      credentials: "same-origin",
    });
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error
          ? error.message
          : "error";
    throw new Error(`${attachment.file_name}: ${reason}`);
  }
}

/**
 * One file downloads as it is; several download one after another as separate
 * files (photos land as photos, not inside a .zip). Each file has a time
 * limit, so the button never spins forever.
 */
export async function downloadAttachments(
  attachments: AppAttachment[],
  locale: string
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

  const names = uniqueNames(attachments);
  const failed: string[] = [];
  for (const [index, attachment] of attachments.entries()) {
    try {
      saveBlob(await fetchAttachment(attachment, locale), names[index]);
      // Browsers drop downloads started in the same instant.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    } catch (error) {
      failed.push(error instanceof Error ? error.message : attachment.file_name);
    }
  }
  if (failed.length) throw new Error(failed.join(", "));
}
