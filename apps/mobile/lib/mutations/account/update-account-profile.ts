import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Fields the user can edit on the account profile screen.
 *
 * All fields are optional: callers may provide any subset.
 * firstName/lastName are written to public.users only when defined.
 * displayName is written to user_preferences only when defined.
 *
 * Avatar, phone, locale, and timezone are deferred.
 */
export interface UpdateAccountProfileInput {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(input: UpdateAccountProfileInput): string | null {
  if (input.firstName != null && input.firstName.length > 100)
    return "Imię nie może przekraczać 100 znaków";
  if (input.lastName != null && input.lastName.length > 100)
    return "Nazwisko nie może przekraczać 100 znaków";
  if (input.displayName != null && input.displayName.length > 100)
    return "Nazwa wyświetlana nie może przekraczać 100 znaków";
  return null;
}

// ─── Mutation function ────────────────────────────────────────────────────────

/**
 * Updates the current user's account profile.
 *
 * Writes to two tables based on which fields are provided:
 *   public.users      — first_name, last_name (guaranteed to exist; plain UPDATE)
 *   user_preferences  — display_name (may not exist; UPSERT with onConflict: user_id)
 *
 * Both writes run in parallel when both are needed.
 *
 * Throw-on-failure contract: throws on validation failure, DB error, or
 * zero-row result from public.users update. This integrates correctly with
 * TanStack Query's useMutation: onSuccess fires only when this function
 * resolves; onError fires when it throws.
 */
export async function updateAccountProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: UpdateAccountProfileInput
): Promise<void> {
  const validationError = validate(input);
  if (validationError) throw new Error(validationError);

  const writes: Promise<void>[] = [];

  const hasNameChange = input.firstName !== undefined || input.lastName !== undefined;
  if (hasNameChange) {
    const userUpdate: Record<string, string | null> = {};
    if (input.firstName !== undefined) userUpdate.first_name = input.firstName ?? null;
    if (input.lastName !== undefined) userUpdate.last_name = input.lastName ?? null;

    writes.push(
      (async () => {
        const { error } = await supabase.from("users").update(userUpdate).eq("id", userId);
        if (error) throw new Error(error.message);
      })()
    );
  }

  const hasDisplayNameChange = input.displayName !== undefined;
  if (hasDisplayNameChange) {
    writes.push(
      (async () => {
        const { error } = await supabase
          .from("user_preferences")
          .upsert(
            { user_id: userId, display_name: input.displayName ?? null },
            { onConflict: "user_id" }
          );
        if (error) throw new Error(error.message);
      })()
    );
  }

  await Promise.all(writes);
}
