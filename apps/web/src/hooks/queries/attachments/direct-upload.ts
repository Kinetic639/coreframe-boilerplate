"use client";

import { registerAttachmentsAction } from "@/app/actions/attachments";
import {
  isAllowedAttachmentMimeType,
  MAX_ATTACHMENT_FILE_SIZE,
} from "@/lib/validations/attachments";
import type { AppAttachment } from "@/server/services/attachments.service";
import { createClient } from "@/utils/supabase/client";

const ATTACHMENTS_BUCKET = "app-attachments";

export type AttachmentUploadProblem = "tooLarge" | "typeNotAllowed" | "empty";

/** Why a file cannot be attached, before anything is sent. */
export function attachmentUploadProblem(file: File): AttachmentUploadProblem | null {
  if (file.size <= 0) return "empty";
  if (file.size > MAX_ATTACHMENT_FILE_SIZE) return "tooLarge";
  if (!isAllowedAttachmentMimeType(file.type)) return "typeNotAllowed";
  return null;
}

/**
 * A copy of a picked file held in memory. On iPhones a file from the photo
 * picker or the camera can stop being readable once the input is cleared or
 * some time has passed, so an upload started later sends nothing and fails;
 * a copy taken right when the file is picked always uploads.
 */
export async function keepFileInMemory(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Every picked file copied into memory (see keepFileInMemory). */
export function keepFilesInMemory(files: FileList | File[] | null | undefined): Promise<File[]> {
  return Promise.all(Array.from(files ?? []).map(keepFileInMemory));
}

/** No byte moved for this long: the upload is given up instead of spinning forever. */
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;

function extension(name: string): string {
  const match = /\.([a-zA-Z0-9]{1,12})$/.exec(name);
  return match ? `.${match[1].toLowerCase()}` : "";
}

function putObject(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.timeout = UPLOAD_TIMEOUT_MS;
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let message = `Upload failed (${request.status})`;
      try {
        const body = JSON.parse(request.responseText) as { message?: string; error?: string };
        message = body.message ?? body.error ?? message;
      } catch {
        // Not JSON: keep the status.
      }
      reject(new Error(message));
    };
    request.onerror = () => reject(new Error("Network error"));
    request.ontimeout = () => reject(new Error("Upload timed out"));
    request.send(file);
  });
}

/**
 * One file straight from the browser to storage, then recorded on its target.
 * Each file is its own request, so the server's request-size limit (a few MB
 * on the hosting platform) never applies, and one failed file leaves the
 * others alone.
 */
export async function uploadAttachmentDirect({
  orgId,
  targetType,
  targetId,
  file,
  onProgress,
}: {
  orgId: string;
  targetType: string;
  targetId: string;
  file: File;
  onProgress?: (fraction: number) => void;
}): Promise<AppAttachment> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Unauthorized");

  const storagePath = `${orgId}/${session.user.id}/${crypto.randomUUID()}${extension(file.name)}`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/$/, "");
  const objectUrl = `${base}/storage/v1/object/${ATTACHMENTS_BUCKET}/${storagePath}`;

  await putObject(
    objectUrl,
    {
      authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
      "content-type": file.type,
      "x-upsert": "false",
      "cache-control": "max-age=3600",
    },
    file,
    onProgress
  );

  const result = await registerAttachmentsAction({
    targetType,
    targetId,
    files: [{ storagePath, fileName: file.name, contentType: file.type, size: file.size }],
  });
  if (!result.success) throw new Error((result as { success: false; error: string }).error);
  return result.data[0];
}
