"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
  listSessionsAction,
  getSessionResultsAction,
  getSessionExtractedDataAction,
  createAutoSessionAction,
  uploadAndParseFileAction,
  runMatchingAction,
  exportCsvAction,
  getEnhancedPdfDataAction,
  approveAndMaterializeSessionAction,
  retryMaterializationAction,
  getMaterializationStatusAction,
  type ApproveAndMaterializeResult,
} from "@/app/actions/tools/wdd-matcher";
import type {
  WddMatcherSession,
  ExtractedFileData,
  PdfBlockData,
} from "@/server/services/wdd-matcher.service";
import type { MaterializationResult } from "@/server/services/repair-orders.service";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const wddMatcherKeys = {
  all: ["svwms-wdd-matcher"] as const,
  sessions: () => [...wddMatcherKeys.all, "sessions"] as const,
  results: (sessionId: string) => [...wddMatcherKeys.all, "results", sessionId] as const,
  extractedData: (sessionId: string) =>
    [...wddMatcherKeys.all, "extracted-data", sessionId] as const,
  enhancedPdfData: (sessionId: string) =>
    [...wddMatcherKeys.all, "enhanced-pdf-data", sessionId] as const,
  materializationStatus: (sessionId: string) =>
    [...wddMatcherKeys.all, "materialization-status", sessionId] as const,
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

export function useSessionsQuery(initialData?: WddMatcherSession[]) {
  return useQuery({
    queryKey: wddMatcherKeys.sessions(),
    queryFn: () => listSessionsAction().then(unwrap),
    initialData,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSessionExtractedDataQuery(sessionId: string | null) {
  return useQuery<ExtractedFileData[]>({
    queryKey: wddMatcherKeys.extractedData(sessionId ?? ""),
    queryFn: () => getSessionExtractedDataAction(sessionId!).then(unwrap),
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });
}

export function useSessionResultsQuery(sessionId: string | null) {
  return useQuery({
    queryKey: wddMatcherKeys.results(sessionId ?? ""),
    queryFn: () => getSessionResultsAction(sessionId!).then(unwrap),
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateAutoSessionMutation(onCreated: (session: WddMatcherSession) => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => createAutoSessionAction().then(unwrap),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: wddMatcherKeys.sessions() });
      onCreated(session);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUploadAndParseFileMutation() {
  return useMutation({
    mutationFn: (formData: FormData) => uploadAndParseFileAction(formData).then(unwrap),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRunMatchingMutation(onComplete?: () => void) {
  const qc = useQueryClient();
  const t = useTranslations("modules.tools.wddMatcher");

  return useMutation({
    mutationFn: (sessionId: string) => runMatchingAction(sessionId).then(unwrap),
    onSuccess: (_data, sessionId) => {
      qc.invalidateQueries({ queryKey: wddMatcherKeys.sessions() });
      qc.invalidateQueries({ queryKey: wddMatcherKeys.results(sessionId) });
      toast.success(t("toasts.matchingComplete"));
      onComplete?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useEnhancedPdfDataMutation(onData: (blocks: PdfBlockData[]) => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const cached = qc.getQueryData<PdfBlockData[]>(wddMatcherKeys.enhancedPdfData(sessionId));
      if (cached) return cached;

      const result = await getEnhancedPdfDataAction(sessionId);
      if (!result.success) throw new Error((result as { success: false; error: string }).error);
      qc.setQueryData(wddMatcherKeys.enhancedPdfData(sessionId), result.data);
      return result.data;
    },
    onSuccess: onData,
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Read-model query: has this (already-approved) session actually produced
 * RepairOrders yet? Enabled only for approved sessions -- there is nothing
 * to check for a session still in ready_for_review.
 */
export function useMaterializationStatusQuery(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: wddMatcherKeys.materializationStatus(sessionId ?? ""),
    queryFn: () => getMaterializationStatusAction(sessionId!).then(unwrap),
    enabled: !!sessionId && enabled,
    staleTime: 10 * 1000,
  });
}

/**
 * Phase 4/5 -- the "Approve" button: approval, then (non-blocking) an
 * immediate materialization attempt. Always resolves successfully once
 * approval itself commits; a materialization failure is carried inside the
 * resolved payload (`materializationError`), not thrown -- so callers
 * render the "Approved / Materialization failed" state from the payload,
 * not from useMutation's onError.
 */
export function useApproveAndMaterializeSessionMutation() {
  const qc = useQueryClient();
  const t = useTranslations("modules.tools.wddMatcher");

  return useMutation({
    mutationFn: (sessionId: string) =>
      approveAndMaterializeSessionAction({ sessionId }).then(unwrap),
    onSuccess: (result: ApproveAndMaterializeResult) => {
      qc.invalidateQueries({ queryKey: wddMatcherKeys.sessions() });
      // Finding F (corrective review, CONFIRMED BUG, fixed here): this
      // previously seeded repairOrderCount from createdRepairOrders alone,
      // undercounting whenever materialization reused an existing
      // RepairOrder instead of creating a new one -- inconsistent with
      // useRetryMaterializationMutation below (createdRepairOrders +
      // reusedRepairOrders) and with the component's own inline
      // computation for the same value. materialized now reflects the
      // actual resulting count rather than the previous always-true
      // `>= 0` check (which was never false for a non-negative number).
      const repairOrderCount =
        (result.materialization?.createdRepairOrders ?? 0) +
        (result.materialization?.reusedRepairOrders ?? 0);
      qc.setQueryData(wddMatcherKeys.materializationStatus(result.session.id), {
        materialized: !!result.materialization && repairOrderCount > 0,
        repairOrderCount,
      });
      if (result.materializationError) {
        toast.error(t("approval.materializationFailedToast"));
      } else {
        toast.success(t("approval.approveSuccessToast"));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Phase 5 -- "Retry Materialization". Only meaningful for an already
 * `approved` session. Idempotent against the same Phase 3 RPC -- a retry
 * against an already-materialized session is a harmless no-op.
 */
export function useRetryMaterializationMutation() {
  const qc = useQueryClient();
  const t = useTranslations("modules.tools.wddMatcher");

  return useMutation({
    mutationFn: (sessionId: string) => retryMaterializationAction(sessionId).then(unwrap),
    onSuccess: (result: MaterializationResult, sessionId) => {
      qc.setQueryData(wddMatcherKeys.materializationStatus(sessionId), {
        materialized: true,
        repairOrderCount: result.createdRepairOrders + result.reusedRepairOrders,
      });
      qc.invalidateQueries({ queryKey: wddMatcherKeys.materializationStatus(sessionId) });
      toast.success(t("approval.retrySuccessToast"));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useExportCsvMutation(sessionId: string) {
  const t = useTranslations("modules.tools.wddMatcher");

  return useMutation({
    mutationFn: () => exportCsvAction({ sessionId }).then(unwrap),
    onSuccess: (csvString) => {
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wdd-matcher-${sessionId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("toasts.exportSuccess"));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
