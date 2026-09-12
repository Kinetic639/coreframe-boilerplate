"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
  createRepairOrderAction,
  updateRepairOrderHeaderAction,
  assignRepairOrderAdvisorAction,
  changeRepairOrderStatusAction,
  listAdvisorCandidatesAction,
} from "@/app/actions/workshop/repair-orders";
import type {
  RepairOrderHeader,
  RepairOrderAdvisorCandidate,
} from "@/server/services/repair-orders.service";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const workshopKeys = {
  all: ["workshop-repair-orders"] as const,
  advisorCandidates: () => [...workshopKeys.all, "advisor-candidates"] as const,
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }): T {
  if (result.success) return result.data;
  throw new Error((result as { success: false; error: string }).error);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Phase 7 advisor picker candidates. Degrades gracefully to an empty list
 * (rather than an error state) when the caller lacks crm.contacts.read --
 * advisor assignment is optional everywhere it appears. */
export function useAdvisorCandidatesQuery(enabled = true) {
  return useQuery<RepairOrderAdvisorCandidate[]>({
    queryKey: workshopKeys.advisorCandidates(),
    queryFn: () => listAdvisorCandidatesAction().then(unwrap),
    enabled,
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateRepairOrderMutation(onCreated?: (order: RepairOrderHeader) => void) {
  const t = useTranslations("modules.workshop.repairOrders");

  return useMutation({
    mutationFn: (input: unknown) => createRepairOrderAction(input).then(unwrap),
    onSuccess: (order) => {
      toast.success(t("toasts.createSuccess"));
      onCreated?.(order);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRepairOrderHeaderMutation() {
  const t = useTranslations("modules.workshop.repairOrders");

  return useMutation({
    mutationFn: (input: unknown) => updateRepairOrderHeaderAction(input).then(unwrap),
    onSuccess: () => toast.success(t("toasts.updateSuccess")),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAssignRepairOrderAdvisorMutation() {
  const t = useTranslations("modules.workshop.repairOrders");

  return useMutation({
    mutationFn: (input: unknown) => assignRepairOrderAdvisorAction(input).then(unwrap),
    onSuccess: () => toast.success(t("toasts.advisorAssignedSuccess")),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useChangeRepairOrderStatusMutation() {
  const t = useTranslations("modules.workshop.repairOrders");

  return useMutation({
    mutationFn: (input: unknown) => changeRepairOrderStatusAction(input).then(unwrap),
    onSuccess: () => toast.success(t("toasts.statusChangedSuccess")),
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Convenience: after any header/advisor/status mutation on the detail
 * page, callers can invalidate the Workshop list query (Phase 6's own
 * server-component read has no client cache to invalidate, but a caller
 * that also holds a client-side list cache elsewhere can use this key). */
export function useInvalidateWorkshopAfterMutation() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: workshopKeys.all });
}
