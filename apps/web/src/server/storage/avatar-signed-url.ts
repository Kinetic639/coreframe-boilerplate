import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";

const USER_AVATAR_BUCKET = "user-avatars";
/** Lifetime of a signed avatar URL. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Reuse a URL for 50 minutes, so a handed-out URL stays valid for at least 10 more. */
const REUSE_SECONDS = 50 * 60;

const signAvatarPath = unstable_cache(
  async (avatarPath: string): Promise<string> => {
    const { data, error } = await createServiceClient()
      .storage.from(USER_AVATAR_BUCKET)
      .createSignedUrl(avatarPath, SIGNED_URL_TTL_SECONDS);
    // Throw instead of returning null: a failure must not be cached for 50 minutes.
    if (error || !data?.signedUrl) throw error ?? new Error("No signed URL returned");
    return data.signedUrl;
  },
  ["user-avatar-signed-url:v1"],
  { revalidate: REUSE_SECONDS }
);

/**
 * Signed URL for a user's own uploaded avatar, shared across requests.
 *
 * The dashboard loaders signed the avatar on every render and every server
 * action (about 11k storage calls a day for a handful of users), although the
 * URL is valid for an hour. Only paths inside the user's own folder are signed
 * (`<userId>/...`), the same rule the avatar upload and the storage policies use.
 */
export async function getSignedAvatarUrl(
  userId: string,
  avatarPath: string | null | undefined
): Promise<string | null> {
  if (!avatarPath || !avatarPath.startsWith(`${userId}/`)) return null;
  try {
    return await signAvatarPath(avatarPath);
  } catch (error) {
    console.error("[getSignedAvatarUrl] Failed to sign avatar", { userId, error });
    return null;
  }
}

const signAvatarPaths = unstable_cache(
  async (avatarPaths: string[]): Promise<Record<string, string>> => {
    const { data, error } = await createServiceClient()
      .storage.from(USER_AVATAR_BUCKET)
      .createSignedUrls(avatarPaths, SIGNED_URL_TTL_SECONDS);
    // Throw instead of returning a partial result: a failure must not be cached.
    if (error || !data) throw error ?? new Error("No signed URLs returned");
    const byPath: Record<string, string> = {};
    data.forEach((item, index) => {
      const path = avatarPaths[index];
      if (path && item.signedUrl) byPath[path] = item.signedUrl;
    });
    return byPath;
  },
  ["user-avatar-signed-urls:v1"],
  { revalidate: REUSE_SECONDS }
);

/**
 * Signed avatar URLs for a list of users (task lists, help desk), keyed by user id.
 *
 * One storage call signs the whole set, and the result is reused for 50 minutes
 * for the same set of avatars, which in an organization's lists rarely changes.
 * Paths outside the owner's folder are skipped. On failure returns an empty map,
 * so callers fall back to `avatar_url`.
 */
export async function getSignedAvatarUrls(
  entries: Array<{ userId: string; avatarPath: string }>
): Promise<Map<string, string>> {
  const owned = entries.filter((entry) => entry.avatarPath.startsWith(`${entry.userId}/`));
  if (owned.length === 0) return new Map();

  const paths = Array.from(new Set(owned.map((entry) => entry.avatarPath))).sort();
  try {
    const byPath = await signAvatarPaths(paths);
    const byUser = new Map<string, string>();
    for (const entry of owned) {
      const url = byPath[entry.avatarPath];
      if (url) byUser.set(entry.userId, url);
    }
    return byUser;
  } catch (error) {
    console.error("[getSignedAvatarUrls] Failed to sign avatars", { count: paths.length, error });
    return new Map();
  }
}
