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
  reserveRepairOrderLineAction,
  releaseRepairOrderLineReservationAction,
  listRepairOrderLineReservationsAction,
} from "@/app/actions/workshop/repair-orders";
import type {
  RepairOrderHeader,
  RepairOrderAdvisorCandidate,
  RepairOrderLineReservation,
  RepairOrderLineReservationResult,
  RepairOrderLineReservationReleaseResult,
} from "@/server/services/repair-orders.service";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const workshopKeys = {
  all: ["workshop-repair-orders"] as const,
  advisorCandidates: () => [...workshopKeys.all, "advisor-candidates"] as const,
  /**
   * Phase 10A correction (2026-09-14): branch-scoped. `branchId` is cache
   * IDENTITY only, never authorization -- the server-side scope resolution
   * in `RepairOrdersService.reserveForLine`/`releaseReservationForLine`/
   * `listReservationsForLine` is unchanged and remains the real boundary.
   * Without `branchId` in the key, switching the active branch while a
   * RepairOrderLine detail view from a previous branch stays mounted could
   * render that previous branch's cached reservation result under the new
   * branch context -- this key shape makes that structurally impossible
   * (a different branchId is always a different cache entry).
   */
  lineReservations: (branchId: string | null, lineId: string) =>
    [...workshopKeys.all, "line-reservations", branchId, lineId] as const,
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

/**
 * Phase 10A: a RepairOrderLine's own active reservation(s), fetched ONLY
 * when `enabled` (the line's own reservation affordance is opened) --
 * never eagerly for every line on initial page load, avoiding an N+1
 * query per line. `staleTime: 0` -- reservation state changes from a
 * user's own reserve/release action and must never show stale data.
 *
 * Phase 10A correction (2026-09-14): `branchId` is now part of the query
 * key (see `workshopKeys.lineReservations`) -- cache identity only, not an
 * authorization parameter. Returns the full react-query result object
 * (not just `data`) so callers can distinguish never-fetched / loading /
 * error / success against the library's own status flags, rather than
 * inferring state from `data ?? []` (which cannot tell "never fetched"
 * apart from "fetched, genuinely zero reservations").
 */
export function useRepairOrderLineReservationsQuery(
  lineId: string,
  enabled: boolean,
  branchId: string | null
) {
  return useQuery<RepairOrderLineReservation[]>({
    queryKey: workshopKeys.lineReservations(branchId, lineId),
    queryFn: () => listRepairOrderLineReservationsAction(lineId).then(unwrap),
    enabled,
    staleTime: 0,
  });
}

export function useReserveRepairOrderLineMutation(lineId: string, branchId: string | null) {
  const t = useTranslations("modules.workshop.repairOrders");
  const qc = useQueryClient();

  return useMutation<RepairOrderLineReservationResult, Error, unknown>({
    mutationFn: (input: unknown) => reserveRepairOrderLineAction(input).then(unwrap),
    onSuccess: () => {
      toast.success(t("toasts.reservationCreatedSuccess"));
      qc.invalidateQueries({ queryKey: workshopKeys.lineReservations(branchId, lineId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReleaseRepairOrderLineReservationMutation(
  lineId: string,
  branchId: string | null
) {
  const t = useTranslations("modules.workshop.repairOrders");
  const qc = useQueryClient();

  return useMutation<RepairOrderLineReservationReleaseResult, Error, unknown>({
    mutationFn: (input: unknown) => releaseRepairOrderLineReservationAction(input).then(unwrap),
    onSuccess: () => {
      toast.success(t("toasts.reservationReleasedSuccess"));
      qc.invalidateQueries({ queryKey: workshopKeys.lineReservations(branchId, lineId) });
    },
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
