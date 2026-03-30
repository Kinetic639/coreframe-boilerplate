import { useMutation, useQueryClient } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { updateAccountProfile } from "@/lib/mutations/account/update-account-profile";
import type { UpdateAccountProfileInput } from "@/lib/mutations/account/update-account-profile";
import { accountProfileQueryKey } from "@/hooks/queries/account/use-account-profile-query";

/**
 * TanStack Query mutation hook for updating the user's account profile.
 *
 * Invalidation contract:
 * - queryClient.invalidateQueries is called in onSuccess only.
 * - updateAccountProfile throws on every failure path, so cache invalidation
 *   is never triggered on logical failure.
 *
 * Usage:
 *   const mutation = useUpdateAccountProfileMutation(userId);
 *   mutation.mutate({ firstName, lastName, displayName });
 *
 *   mutation.isPending  — save in flight
 *   mutation.isError    — last call failed; mutation.error.message is the reason
 *   mutation.isSuccess  — last call succeeded
 *
 * The calling screen is responsible for:
 *   - Disabling the Save button when no field has changed (isDirty === false)
 *   - Navigating back after isSuccess
 */
export function useUpdateAccountProfileMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAccountProfileInput) =>
      updateAccountProfile(mobileSupabase, userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountProfileQueryKey(userId) });
    },
  });
}
