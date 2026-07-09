"use client";

import { useCallback } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  useUpdateCountLineMutation,
  useUpdateCountSessionStatusMutation,
} from "@/hooks/queries/warehouse/audits";
import type { EnrichedCountLine } from "./types";

export interface SaveLineInput {
  countedQuantity: number;
  reasonCode?: string | null;
  note?: string | null;
}

/**
 * Wraps the count-line and session-status mutations with the guided-count
 * screen's specific save/skip/not-found/finish semantics, mirroring the
 * prototype's executeSaveAndNext / handleSkipAndReturn / handleNotFound /
 * onFinishCounting. variance_quantity is never sent to the server — it's a
 * DB-generated stored column derived from counted_quantity.
 */
export function useCountSubmission(sessionId: string) {
  const t = useTranslations("warehouseInventory.audits.feedback");
  const tCount = useTranslations("warehouseInventory.audits.count");
  const router = useRouter();
  const updateLine = useUpdateCountLineMutation(sessionId);
  const updateSessionStatus = useUpdateCountSessionStatusMutation();

  const saveLine = useCallback(
    async (line: EnrichedCountLine, input: SaveLineInput) => {
      await updateLine.mutateAsync({
        id: line.id,
        current_status: line.status,
        counted_quantity: input.countedQuantity,
        status: "counted",
        reason_code: input.reasonCode ?? null,
        note: input.note ?? null,
      });
      toast.success(t("lineUpdated"));
    },
    [updateLine, t]
  );

  const markNotFound = useCallback(
    async (line: EnrichedCountLine) => {
      await updateLine.mutateAsync({
        id: line.id,
        current_status: line.status,
        counted_quantity: 0,
        status: "counted",
        reason_code: "damaged",
        note: tCount("itemNotFoundNote"),
      });
      toast.warning(tCount("lineMarkedMissing"));
    },
    [updateLine, tCount]
  );

  const skipLine = useCallback(
    async (line: EnrichedCountLine) => {
      await updateLine.mutateAsync({
        id: line.id,
        current_status: line.status,
        status: "skipped",
      });
      toast.info(tCount("lineSkipped"));
    },
    [updateLine, tCount]
  );

  const saveNote = useCallback(
    async (line: EnrichedCountLine, note: string) => {
      await updateLine.mutateAsync({
        id: line.id,
        current_status: line.status,
        note: note.trim() === "" ? null : note,
      });
      toast.success(t("lineUpdated"));
    },
    [updateLine, t]
  );

  const finishCounting = useCallback(async () => {
    await updateSessionStatus.mutateAsync({ id: sessionId, status: "submitted" });
    router.push({
      pathname: "/dashboard/warehouse/audits/[id]/review",
      params: { id: sessionId },
    });
  }, [updateSessionStatus, sessionId, router]);

  const pauseSession = useCallback(() => {
    router.push({ pathname: "/dashboard/warehouse/audits" });
  }, [router]);

  return {
    saveLine,
    markNotFound,
    skipLine,
    saveNote,
    finishCounting,
    pauseSession,
    isSaving: updateLine.isPending,
  };
}
