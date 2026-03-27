import { useMutation, useQueryClient } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { updateOrgProfile } from "@/lib/mutations/organization/update-org-profile";
import type { UpdateOrgProfileInput } from "@/lib/mutations/organization/update-org-profile";
import { orgProfileQueryKey } from "@/hooks/queries/organization/use-org-profile-query";

/**
 * TanStack Query mutation hook for updating the organization profile.
 *
 * Invalidation contract:
 * - queryClient.invalidateQueries is called in onSuccess only.
 * - onSuccess fires only when updateOrgProfile resolves (no throw).
 * - updateOrgProfile throws on every failure path (validation, DB error,
 *   zero-row match), so invalidation is never triggered on logical failure.
 *
 * Usage:
 *   const mutation = useUpdateOrgProfileMutation(orgId);
 *   mutation.mutate(input);
 *
 *   mutation.isPending  — save in flight
 *   mutation.isError    — last call failed; mutation.error.message is the reason
 *   mutation.isSuccess  — last call succeeded
 *
 * The calling screen is responsible for:
 *   - Guarding the edit affordance with checkPermission(permissions, ORG_UPDATE)
 *   - Disabling the Save button when no field has changed (isDirty === false)
 *   - Navigating back after isSuccess
 */
export function useUpdateOrgProfileMutation(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrgProfileInput) => updateOrgProfile(mobileSupabase, orgId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileQueryKey(orgId) });
    },
  });
}
