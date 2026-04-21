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
} from "@/app/actions/tools/wdd-matcher";
import type {
  WddMatcherSession,
  WddMatchResultEntry,
  ExtractedFileData,
} from "@/server/services/wdd-matcher.service";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const wddMatcherKeys = {
  all: ["svwms-wdd-matcher"] as const,
  sessions: () => [...wddMatcherKeys.all, "sessions"] as const,
  results: (sessionId: string) => [...wddMatcherKeys.all, "results", sessionId] as const,
  extractedData: (sessionId: string) =>
    [...wddMatcherKeys.all, "extracted-data", sessionId] as const,
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
