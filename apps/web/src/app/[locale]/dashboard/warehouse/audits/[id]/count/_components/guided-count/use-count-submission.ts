"use client";

import { useCallback, useState } from "react";
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
 *
 * Line mutations are fire-and-forget (`.mutate`, not `.mutateAsync`) and the
 * feedback toast fires immediately at call time rather than after the
 * network round-trip resolves — the optimistic cache patch already updates
 * the UI instantly, so waiting for the server before toasting only adds a
 * visible lag, and on a backgrounded tab (throttled fetch/timers) it made
 * toasts queue up and burst all at once when the tab regained focus.
 * `onError` (wired in the mutation itself) still surfaces failures and rolls
 * the optimistic patch back.
 */
export function useCountSubmission(sessionId: string) {
  const t = useTranslations("warehouseInventory.audits.feedback");
  const tCount = useTranslations("warehouseInventory.audits.count");
  const router = useRouter();
  const updateLine = useUpdateCountLineMutation(sessionId);
  const updateSessionStatus = useUpdateCountSessionStatusMutation();
  // updateSessionStatus.isPending resets as soon as the network call settles,
  // but router.push() + the review screen's own data fetch still take a beat
  // after that — leaving a window where the button looks idle and clickable
  // again before the navigation actually lands. This stays true across that
  // whole span and is only cleared on failure (success navigates away and
  // unmounts this screen, so there's nothing left to reset it for).
  const [isNavigating, setIsNavigating] = useState(false);

  const saveLine = useCallback(
    (line: EnrichedCountLine, input: SaveLineInput) => {
      updateLine.mutate({
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
    (line: EnrichedCountLine) => {
      updateLine.mutate({
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
    (line: EnrichedCountLine) => {
      updateLine.mutate({
        id: line.id,
        current_status: line.status,
        status: "skipped",
      });
      toast.info(tCount("lineSkipped"));
    },
    [updateLine, tCount]
  );

  const saveNote = useCallback(
    (line: EnrichedCountLine, note: string) => {
      updateLine.mutate({
        id: line.id,
        current_status: line.status,
        note: note.trim() === "" ? null : note,
      });
      toast.success(t("lineUpdated"));
    },
    [updateLine, t]
  );

  const finishCounting = useCallback(async () => {
    setIsNavigating(true);
    try {
      await updateSessionStatus.mutateAsync({ id: sessionId, status: "submitted" });
      router.push({
        pathname: "/dashboard/warehouse/audits/[id]/review",
        params: { id: sessionId },
      });
    } catch {
      setIsNavigating(false);
    }
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
    isFinishing: isNavigating || updateSessionStatus.isPending,
  };
}
