import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";

const ATTACHMENTS_BUCKET = "app-attachments";
/** Lifetime of a signed link. */
const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;
/** One link is handed out for 50 minutes, so it is still valid 70 minutes after it was last given. */
export const ATTACHMENT_URL_REUSE_SECONDS = 50 * 60;

const signPath = unstable_cache(
  async (storagePath: string): Promise<string> => {
    const { data, error } = await createServiceClient()
      .storage.from(ATTACHMENTS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    // Throw instead of returning null: a failure must not be cached.
    if (error || !data?.signedUrl) throw error ?? new Error("No signed URL returned");
    return data.signedUrl;
  },
  ["attachment-signed-url:v1"],
  { revalidate: ATTACHMENT_URL_REUSE_SECONDS }
);

/**
 * A signed link to an attachment's file (or one of its small versions), shared
 * by every request and every viewer for 50 minutes.
 *
 * Storage's CDN keys its cache on the whole link, token included, so a new
 * link per request is always a cache miss and the full file leaves Supabase
 * again. Reusing one link lets the CDN and the browser serve it from cache.
 *
 * The caller MUST have checked access first: read the attachment row with the
 * viewer's own client (row-level security on app_attachments is the same rule
 * as the storage policy) and pass only a path taken from that row.
 */
export async function getSharedAttachmentUrl(storagePath: string): Promise<string | null> {
  try {
    return await signPath(storagePath);
  } catch (error) {
    console.error("[getSharedAttachmentUrl] Failed to sign attachment", { storagePath, error });
    return null;
  }
}
