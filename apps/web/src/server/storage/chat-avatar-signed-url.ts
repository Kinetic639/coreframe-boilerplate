import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";

export const CHAT_AVATAR_BUCKET = "chat-avatars";
/** Lifetime of a signed group photo URL. */
const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;
/** One URL is handed out within one 50-minute window, so it stays valid for 70 minutes after. */
const REUSE_SECONDS = 50 * 60;

function urlWindow(now = Date.now()): number {
  return Math.floor(now / (REUSE_SECONDS * 1000));
}

const signPaths = unstable_cache(
  async (paths: string[], _window: number): Promise<Record<string, string>> => {
    const { data, error } = await createServiceClient()
      .storage.from(CHAT_AVATAR_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    // Throw instead of returning a partial result: a failure must not be cached.
    if (error || !data) throw error ?? new Error("No signed URLs returned");
    const byPath: Record<string, string> = {};
    data.forEach((item, index) => {
      const path = paths[index];
      if (path && item.signedUrl) byPath[path] = item.signedUrl;
    });
    return byPath;
  },
  ["chat-avatar-signed-urls:v1"],
  { revalidate: REUSE_SECONDS }
);

/**
 * Signed URLs of group photos, keyed by conversation id. The caller has already
 * read the paths through RLS (members only); only paths inside the
 * conversation's own folder are signed. On failure returns an empty map (the
 * group shows its initials).
 */
export async function getSignedChatAvatarUrls(
  entries: Array<{ conversationId: string; avatarPath: string }>
): Promise<Map<string, string>> {
  const owned = entries.filter((entry) => entry.avatarPath.startsWith(`${entry.conversationId}/`));
  if (owned.length === 0) return new Map();
  const paths = Array.from(new Set(owned.map((entry) => entry.avatarPath))).sort();
  try {
    const byPath = await signPaths(paths, urlWindow());
    const byConversation = new Map<string, string>();
    for (const entry of owned) {
      const url = byPath[entry.avatarPath];
      if (url) byConversation.set(entry.conversationId, url);
    }
    return byConversation;
  } catch (error) {
    console.error("[getSignedChatAvatarUrls] Failed to sign group photos", {
      count: paths.length,
      error,
    });
    return new Map();
  }
}
