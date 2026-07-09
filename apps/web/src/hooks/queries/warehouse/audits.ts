"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import {
  addUnexpectedCountLineAction,
  approveInventoryCountSessionAction,
  bulkApproveCountLinesAction,
  createInventoryCountSessionAction,
  getInventoryCountSessionAction,
  getReorderReportAction,
  listInventoryCountSessionsAction,
  updateInventoryCountLineAction,
} from "@/app/actions/warehouse/inventory/count-sessions";

// ─── Discriminated result helper (mirrors src/hooks/queries/warehouse/index.ts) ─

type SR<T> = { success: true; data: T } | { success: false; error: string };

function unwrapSR<T>(result: SR<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { error: string }).error);
}

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CountSessionListRow {
  id: string;
  count_number: string;
  status: "draft" | "counting" | "submitted" | "approved" | "cancelled";
  scope: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  total_lines: number;
  counted_lines: number;
  variance_lines: number;
}

export interface CountSessionListResult {
  rows: CountSessionListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CountLineRow {
  id: string;
  count_session_id: string;
  sequence_no: number | null;
  variant_id: string;
  location_id: string;
  lot_id: string | null;
  serial_id: string | null;
  expected_quantity: number;
  counted_quantity: number | null;
  variance_quantity: number | null;
  unit_id: string;
  status: "pending" | "counted" | "skipped" | "needs_recount" | "approved";
  source: "generated" | "unexpected_found";
  reason_code: string | null;
  note: string | null;
  counted_by: string | null;
  counted_at: string | null;
}

export interface CountSessionDetail {
  session: Record<string, unknown>;
  lines: CountLineRow[];
}

export interface ReorderReportRow {
  variant_id: string;
  location_id: string | null;
  on_hand_quantity: number;
  reorder_point: number;
  min_quantity: number | null;
  suggested_order_quantity: number;
  preferred_supplier_id: string | null;
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const auditKeys = {
  all: ["warehouse", "audits"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (branchId: string, params: Record<string, unknown> = {}) =>
    [...auditKeys.lists(), branchId, params] as const,
  details: () => [...auditKeys.all, "detail"] as const,
  detail: (id: string) => [...auditKeys.details(), id] as const,
  reorderReport: (branchId: string, params: Record<string, unknown> = {}) =>
    [...auditKeys.all, "reorder-report", branchId, params] as const,
};

// ─── List sessions ────────────────────────────────────────────────────────────

export function useCountSessionsQuery(
  branchId: string | null | undefined,
  params: { search?: string; status?: string; page?: number; pageSize?: number } = {},
  initialData?: CountSessionListResult
) {
  return useQuery({
    // branchId is used only for cache-key scoping; the action derives the
    // active branch from server context, never from a client-supplied value.
    queryKey: branchId ? auditKeys.list(branchId, params) : auditKeys.lists(),
    queryFn: async () =>
      unwrapSR((await listInventoryCountSessionsAction(params)) as SR<CountSessionListResult>),
    enabled: !!branchId,
    initialData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Session detail ───────────────────────────────────────────────────────────

export function useCountSessionDetailQuery(
  sessionId: string | null | undefined,
  initialData?: CountSessionDetail
) {
  return useQuery({
    queryKey: sessionId ? auditKeys.detail(sessionId) : auditKeys.details(),
    queryFn: async () =>
      unwrapSR(
        (await getInventoryCountSessionAction({ id: sessionId! })) as SR<CountSessionDetail>
      ),
    enabled: !!sessionId,
    initialData,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Create session ───────────────────────────────────────────────────────────

export function useCreateCountSessionMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseInventory.audits.feedback");

  return useMutation({
    mutationFn: async (input: unknown) =>
      unwrapSR((await createInventoryCountSessionAction(input)) as SR<Record<string, unknown>>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
      }
      toast.success(t("sessionCreated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("sessionCreateFailed"));
    },
  });
}

// ─── Update count line (optimistic) ────────────────────────────────────────────

export function useUpdateCountLineMutation(sessionId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseInventory.audits.feedback");

  return useMutation({
    mutationFn: async (input: { id: string } & Record<string, unknown>) =>
      unwrapSR((await updateInventoryCountLineAction(input)) as SR<{ id: string }>),
    onMutate: async (input) => {
      if (!sessionId) return;
      const detailKey = auditKeys.detail(sessionId);
      await queryClient.cancelQueries({ queryKey: detailKey });

      const previousDetail = queryClient.getQueryData<CountSessionDetail>(detailKey);
      queryClient.setQueryData<CountSessionDetail | undefined>(detailKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          lines: old.lines.map((line) =>
            line.id === input.id ? ({ ...line, ...input } as CountLineRow) : line
          ),
        };
      });

      return { previousDetail };
    },
    onError: (err: Error, _input, context) => {
      if (sessionId && context?.previousDetail) {
        queryClient.setQueryData(auditKeys.detail(sessionId), context.previousDetail);
      }
      toast.error(err.message || t("lineUpdateFailed"));
    },
    onSettled: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: auditKeys.detail(sessionId) });
      }
    },
  });
}

// ─── Add unexpected line ────────────────────────────────────────────────────────

export function useAddUnexpectedLineMutation(sessionId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseInventory.audits.feedback");

  return useMutation({
    mutationFn: async (input: unknown) =>
      unwrapSR((await addUnexpectedCountLineAction(input)) as SR<{ id: string }>),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: auditKeys.detail(sessionId) });
      }
      toast.success(t("unexpectedLineAdded"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("unexpectedLineAddFailed"));
    },
  });
}

// ─── Bulk approve lines ─────────────────────────────────────────────────────────

export function useBulkApproveLinesMutation(sessionId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseInventory.audits.feedback");

  return useMutation({
    mutationFn: async (input: { line_ids: string[]; require_reason_for_variance?: boolean }) =>
      unwrapSR(
        (await bulkApproveCountLinesAction(input)) as SR<{
          approvedIds: string[];
          skippedIds: string[];
        }>
      ),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: auditKeys.detail(sessionId) });
      }
      toast.success(t("bulkApproved"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("bulkApproveFailed"));
    },
  });
}

// ─── Approve (post) session ─────────────────────────────────────────────────────

export function useApproveCountSessionMutation() {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseInventory.audits.feedback");

  return useMutation({
    mutationFn: async (input: { id: string }) =>
      unwrapSR((await approveInventoryCountSessionAction(input)) as SR<Record<string, unknown>>),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
      toast.success(t("sessionApproved"));
    },
    onError: (err: Error) => {
      // Surfaces the RPC's own rejection reason unchanged (all-or-nothing
      // posting gate, or missing warehouse.inventory.adjust) — never
      // generalized to a fixed message.
      toast.error(err.message || t("sessionApproveFailed"));
    },
  });
}

// ─── Reorder report ─────────────────────────────────────────────────────────────

export function useReorderReportQuery(
  branchId: string | null | undefined,
  params: { locationId?: string; supplierId?: string } = {}
) {
  const t = useTranslations("warehouseInventory.audits.feedback");

  return useQuery({
    queryKey: branchId ? auditKeys.reorderReport(branchId, params) : auditKeys.all,
    queryFn: async () => {
      const result = (await getReorderReportAction(params)) as SR<ReorderReportRow[]>;
      if (!result.success) {
        toast.error(
          (result as { success: false; error: string }).error || t("reorderReportFailed")
        );
      }
      return unwrapSR(result);
    },
    enabled: !!branchId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
