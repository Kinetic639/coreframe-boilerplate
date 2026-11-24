"use client";

import { registerAttachmentsAction } from "@/app/actions/attachments";
import {
  isAllowedAttachmentMimeType,
  MAX_ATTACHMENT_FILE_SIZE,
} from "@/lib/validations/attachments";
import type { AppAttachment } from "@/server/services/attachments.service";
import {
  IMMUTABLE_CACHE_SECONDS,
  prepareImage,
  variantStoragePath,
  type PreparedImage,
} from "@/lib/media/image-compress";
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

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
};

/**
 * The file's type, guessed from its name when the browser gave none. Android
 * pickers (Google Photos, some galleries and file managers) often hand over a
 * photo with an empty or generic type, which would otherwise be refused.
 */
export function withKnownType(file: File): File {
  if (file.type && file.type !== "application/octet-stream") return file;
  const ext = /\.([a-zA-Z0-9]{1,12})$/.exec(file.name)?.[1]?.toLowerCase();
  const type = ext ? TYPE_BY_EXTENSION[ext] : undefined;
  if (!type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

/**
 * A copy of a picked file held in memory. On iPhones a file from the photo
 * picker or the camera can stop being readable once the input is cleared or
 * some time has passed, so an upload started later sends nothing and fails;
 * a copy taken right when the file is picked always uploads.
 */
export async function keepFileInMemory(file: File): Promise<File> {
  try {
    const typed = withKnownType(file);
    const bytes = await typed.arrayBuffer();
    return new File([bytes], typed.name, { type: typed.type, lastModified: typed.lastModified });
  } catch {
    return withKnownType(file);
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

/** A file already in storage, ready to be recorded on a target. */
export interface UploadedAttachmentPayload {
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  image?: {
    width: number;
    height: number;
    variants: {
      name: "thumb" | "card";
      path: string;
      width: number;
      height: number;
      size: number;
      contentType: "image/webp" | "image/jpeg";
    }[];
  };
}

/**
 * One file straight from the browser to storage, not yet recorded on anything.
 * Lets a form send its photos while it is still being filled in, and record
 * them on the new record the moment it exists (registerUploadedAttachments).
 */
export async function uploadAttachmentFile({
  orgId,
  file,
  onProgress,
  onPrepared,
}: {
  orgId: string;
  file: File;
  onProgress?: (fraction: number) => void;
  /** Called once the photo is shrunk, with its small versions (for a preview). */
  onPrepared?: (prepared: PreparedImage | null) => void;
}): Promise<UploadedAttachmentPayload> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Unauthorized");

  // Photos are shrunk to 2048 px WebP and get 160 px and 640 px versions for
  // lists and cards. Anything else (and an image the browser cannot read) is sent as picked.
  const prepared: PreparedImage | null = await prepareImage(file).catch(() => null);
  onPrepared?.(prepared);
  const upload = prepared?.file ?? file;

  const storagePath = `${orgId}/${session.user.id}/${crypto.randomUUID()}${extension(upload.name)}`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/$/, "");
  const headers = (contentType: string) => ({
    authorization: `Bearer ${session.access_token}`,
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    "content-type": contentType,
    "x-upsert": "false",
    // A stored file never changes under its path, so browsers may keep it for a year.
    "cache-control": `max-age=${IMMUTABLE_CACHE_SECONDS}`,
  });
  const objectUrl = (path: string) => `${base}/storage/v1/object/${ATTACHMENTS_BUCKET}/${path}`;

  await putObject(objectUrl(storagePath), headers(upload.type), upload, onProgress);

  // The small versions are a few KB each; one that fails is left out and the
  // full file is shown in its place.
  const variants = prepared
    ? (
        await Promise.all(
          prepared.variants.map(async (variant) => {
            const path = variantStoragePath(storagePath, variant.name, variant.blob.type);
            try {
              const body = new File([variant.blob], path.split("/").pop() ?? variant.name, {
                type: variant.blob.type,
              });
              await putObject(objectUrl(path), headers(variant.blob.type), body);
              return {
                name: variant.name,
                path,
                width: variant.width,
                height: variant.height,
                size: variant.blob.size,
                contentType: variant.blob.type as "image/webp" | "image/jpeg",
              };
            } catch {
              return null;
            }
          })
        )
      ).filter((variant) => variant !== null)
    : [];

  return {
    storagePath,
    fileName: upload.name,
    contentType: upload.type,
    size: upload.size,
    ...(prepared ? { image: { width: prepared.width, height: prepared.height, variants } } : {}),
  };
}

/** Files already in storage (uploadAttachmentFile), recorded on their target in one call. */
export async function registerUploadedAttachments({
  targetType,
  targetId,
  files,
}: {
  targetType: string;
  targetId: string;
  files: UploadedAttachmentPayload[];
}): Promise<AppAttachment[]> {
  if (files.length === 0) return [];
  const result = await registerAttachmentsAction({ targetType, targetId, files });
  if (!result.success) throw new Error((result as { success: false; error: string }).error);
  return result.data;
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
  const payload = await uploadAttachmentFile({ orgId, file, onProgress });
  const [attachment] = await registerUploadedAttachments({
    targetType,
    targetId,
    files: [payload],
  });
  return attachment;
}
