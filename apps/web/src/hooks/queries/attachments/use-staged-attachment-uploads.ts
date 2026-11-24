"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachmentUploadProblem,
  keepFileInMemory,
  uploadAttachmentFile,
  type AttachmentUploadProblem,
  type UploadedAttachmentPayload,
} from "./direct-upload";

export type StagedUploadStatus = "uploading" | "done" | "failed";

export interface StagedUpload {
  id: string;
  name: string;
  size: number;
  isImage: boolean;
  status: StagedUploadStatus;
  /** 0..1 while the file is being sent. */
  progress: number;
  /** Object URL of a small version of the photo, once it is ready. */
  previewUrl: string | null;
  payload: UploadedAttachmentPayload | null;
}

/** Files sent at once: keeps memory low on phones (each photo is decoded to shrink it). */
const PARALLEL_UPLOADS = 2;

export interface StagedUploadsResult {
  /** Every file sent, ready to be recorded; null when some are not (failed or removed meanwhile). */
  payloads: UploadedAttachmentPayload[];
  failed: number;
}

/**
 * Attachments of a record that does not exist yet (a form being filled in).
 * Each file starts uploading the moment it is picked, so by the time the form
 * is saved the files are already in storage and only need to be recorded on
 * the new record, which is a single quick call.
 */
export function useStagedAttachmentUploads(orgId: string | null | undefined) {
  const [items, setItems] = useState<StagedUpload[]>([]);
  const itemsRef = useRef<StagedUpload[]>([]);
  const files = useRef(new Map<string, File>());
  const running = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const waiters = useRef(new Set<() => void>());
  const mounted = useRef(true);

  const commit = useCallback((next: (current: StagedUpload[]) => StagedUpload[]) => {
    itemsRef.current = next(itemsRef.current);
    if (mounted.current) setItems(itemsRef.current);
    if (itemsRef.current.every((item) => item.status !== "uploading")) {
      waiters.current.forEach((resolve) => resolve());
      waiters.current.clear();
    }
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<StagedUpload>) =>
      commit((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item))),
    [commit]
  );

  const pump = useCallback(() => {
    if (!orgId) return;
    while (running.current.size < PARALLEL_UPLOADS && queue.current.length > 0) {
      const id = queue.current.shift()!;
      const file = files.current.get(id);
      if (!file) continue;
      running.current.add(id);
      void uploadAttachmentFile({
        orgId,
        file,
        onProgress: (fraction) => {
          if (itemsRef.current.some((item) => item.id === id)) patch(id, { progress: fraction });
        },
        onPrepared: (prepared) => {
          const thumb = prepared?.variants.find((variant) => variant.name === "thumb");
          const source = thumb?.blob ?? (prepared ? prepared.file : null);
          if (source && itemsRef.current.some((item) => item.id === id)) {
            patch(id, { previewUrl: URL.createObjectURL(source) });
          }
        },
      })
        .then((payload) => {
          // Sent: the picked file is no longer needed in memory.
          files.current.delete(id);
          patch(id, { status: "done", progress: 1, payload });
        })
        .catch(() => patch(id, { status: "failed" }))
        .finally(() => {
          running.current.delete(id);
          pump();
        });
    }
  }, [orgId, patch]);

  // Files picked before the organisation was known start now.
  useEffect(() => {
    pump();
  }, [pump]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  /** Starts sending the picked files; returns the first reason a file was refused. */
  const add = useCallback(
    async (list: FileList | File[] | null | undefined): Promise<AttachmentUploadProblem | null> => {
      const picked = Array.from(list ?? []);
      if (picked.length === 0) return null;
      // Copied right away: on iPhones a picked file can stop being readable later.
      const copies = await Promise.all(picked.map(keepFileInMemory));
      let problem: AttachmentUploadProblem | null = null;
      const added: StagedUpload[] = [];
      for (const file of copies) {
        const refused = attachmentUploadProblem(file);
        if (refused) {
          problem ??= refused;
          continue;
        }
        const id = crypto.randomUUID();
        files.current.set(id, file);
        queue.current.push(id);
        added.push({
          id,
          name: file.name,
          size: file.size,
          isImage: file.type.startsWith("image/"),
          status: "uploading",
          progress: 0,
          previewUrl: null,
          payload: null,
        });
      }
      if (added.length) commit((current) => [...current, ...added]);
      pump();
      return problem;
    },
    [commit, pump]
  );

  const remove = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      files.current.delete(id);
      queue.current = queue.current.filter((queued) => queued !== id);
      commit((current) => current.filter((entry) => entry.id !== id));
    },
    [commit]
  );

  const retry = useCallback(
    (id: string) => {
      if (!files.current.has(id)) return;
      patch(id, { status: "uploading", progress: 0 });
      queue.current.push(id);
      pump();
    },
    [patch, pump]
  );

  const reset = useCallback(() => {
    itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    files.current.clear();
    queue.current = [];
    commit(() => []);
  }, [commit]);

  /** Waits until no file is still being sent. */
  const settled = useCallback((): Promise<StagedUploadsResult> => {
    const collect = (): StagedUploadsResult => {
      const failed = itemsRef.current.filter((item) => item.status === "failed").length;
      return {
        payloads: itemsRef.current.flatMap((item) => (item.payload ? [item.payload] : [])),
        failed,
      };
    };
    if (itemsRef.current.every((item) => item.status !== "uploading")) {
      return Promise.resolve(collect());
    }
    return new Promise((resolve) => waiters.current.add(() => resolve(collect())));
  }, []);

  const uploading = items.filter((item) => item.status === "uploading").length;
  const failed = items.filter((item) => item.status === "failed").length;

  return { items, add, remove, retry, reset, settled, uploading, failed };
}
