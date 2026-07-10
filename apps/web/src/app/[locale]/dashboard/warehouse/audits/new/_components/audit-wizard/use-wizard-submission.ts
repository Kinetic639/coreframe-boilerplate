"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCreateCountSessionMutation } from "@/hooks/queries/warehouse/audits";
import type { CountSessionType } from "@/lib/warehouse/count-session-types";

export interface LaunchSessionScope {
  count_type: CountSessionType;
  location_ids: string[];
  include_children: boolean;
  supplier_id?: string;
  location_filter_ids: string[];
  include_zero_stock: boolean;
  show_expected_quantity: boolean;
  require_reason_for_variance: boolean;
}

export function useWizardSubmission(branchId: string | null) {
  const router = useRouter();
  const mutation = useCreateCountSessionMutation(branchId);
  // The mutation's own `isPending` resets to false as soon as the network
  // call settles — but router.push() + the destination screen's own data
  // fetch still take a beat after that, leaving a window where the button
  // looks idle again and is clickable before the navigation actually lands.
  // This local flag stays true across that whole span and is only ever
  // cleared on failure — on success we navigate away and unmount, so there's
  // nothing left to reset it back for.
  const [isNavigating, setIsNavigating] = useState(false);

  const launch = useCallback(
    async (scope: LaunchSessionScope) => {
      setIsNavigating(true);
      try {
        const result = (await mutation.mutateAsync({ scope, notes: null })) as Record<
          string,
          unknown
        >;
        const sessionId = (result.count_session_id ?? result.id) as string | undefined;
        if (sessionId) {
          router.push({
            pathname: "/dashboard/warehouse/audits/[id]/count",
            params: { id: sessionId },
          });
        } else {
          setIsNavigating(false);
        }
      } catch {
        setIsNavigating(false);
      }
    },
    [mutation, router]
  );

  return { launch, isPending: isNavigating || mutation.isPending };
}
