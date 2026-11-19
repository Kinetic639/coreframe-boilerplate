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
