"use client";

import { useCallback } from "react";
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

  const launch = useCallback(
    async (scope: LaunchSessionScope) => {
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
      }
    },
    [mutation, router]
  );

  return { launch, isPending: mutation.isPending };
}
