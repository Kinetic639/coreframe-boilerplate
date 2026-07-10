"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  useCountSessionDetailQuery,
  useUpdateCountSessionStatusMutation,
} from "@/hooks/queries/warehouse/audits";
import { LoadingOverlay } from "@/components/branding";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { useCountSessionState } from "./use-count-session-state";
import { useCountSubmission } from "./use-count-submission";
import { CountProgressHeader } from "./count-progress-header";
import { CountItemCard, type CountItemViewMode } from "./count-item-card";
import { CountPrimaryActions } from "./count-not-found-action";
import { CountReasonModal } from "./count-reason-modal";
import { CountNotesModal } from "./count-notes-modal";
import { CountInterruptDialog } from "./count-interrupt-dialog";
import { CountLocationJumpSheet } from "./count-location-jump-sheet";
import { CountScanTrigger } from "./count-scan-trigger";
import type { EnrichedCountLine, GuidedCountSessionInfo } from "./types";

interface LocationSummary {
  id: string;
  code: string;
  name: string;
}

interface GuidedCountScreenProps {
  session: GuidedCountSessionInfo;
  initialLines: EnrichedCountLine[];
  locations: LocationSummary[];
}

export function GuidedCountScreen({ session, initialLines, locations }: GuidedCountScreenProps) {
  const t = useTranslations("warehouseInventory.audits.count");

  const showExpectedQuantity = session.scope.show_expected_quantity !== false;
  const requireReasonForVariance =
    session.scope.require_reason_for_variance !== false && showExpectedQuantity;

  // Subscribes to the same React Query cache every mutation on this screen
  // writes to (optimistic patch + invalidate) — without this, the progress
  // bar/position tracker would stay frozen at the SSR snapshot until a full
  // page reload. `session` itself (status/scope) intentionally stays a
  // static prop: every place its status changes on this screen is followed
  // immediately by either the mutation this effect issues (draft->counting)
  // or a router.push away (finishCounting), so it never needs live wiring.
  const { data } = useCountSessionDetailQuery(session.id, {
    session: session as unknown as Record<string, unknown>,
    lines: initialLines,
  });
  const lines = data?.lines ?? initialLines;

  // Full-bleed mobile-first screen — no dashboard-shell padding around it.
  const setFlushContent = useUiStoreV2((s) => s.setFlushContent);
  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  const {
    allSortedLines,
    filteredLines,
    currentLine,
    currentIndex,
    locationFilterId,
    overallStats,
    filteredStats,
    goToNextUnresolved,
    goToPreviousUnresolved,
    selectIndex,
    setLocationFilter,
  } = useCountSessionState(lines);

  const { saveLine, skipLine, saveNote, finishCounting, pauseSession, isFinishing } =
    useCountSubmission(session.id);
  const updateSessionStatus = useUpdateCountSessionStatusMutation();

  // Mark the session as "counting" the first time someone enters this screen.
  useEffect(() => {
    if (session.status === "draft") {
      updateSessionStatus.mutate({ id: session.id, status: "counting" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  const [inputVal, setInputVal] = useState("");
  const [incrementStep, setIncrementStep] = useState(1);
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (currentLine) {
      setInputVal(
        currentLine.counted_quantity != null ? currentLine.counted_quantity.toString() : ""
      );
      setReasonCode(currentLine.reason_code ?? "");
      setNote(currentLine.note ?? "");
    }
  }, [currentLine]);

  const [interruptDialogOpen, setInterruptDialogOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [scanMode, setScanMode] = useState<"location" | "item" | null>(null);
  const [viewMode, setViewMode] = useState<CountItemViewMode>("compact");

  const liveVariance = useMemo(() => {
    if (inputVal.trim() === "" || !currentLine) return null;
    const qty = parseInt(inputVal, 10) || 0;
    return qty - currentLine.expected_quantity;
  }, [inputVal, currentLine]);

  function advanceAfterResolution() {
    const next = goToNextUnresolved();
    if (next === -1) {
      toast.success(t("allResolved"));
    }
  }

  function executeSaveAndNext(finalReasonCode?: string) {
    if (!currentLine) return;
    const countedQty = inputVal.trim() === "" ? 0 : parseInt(inputVal, 10);
    // Fire-and-forget: the optimistic cache patch (which the progress
    // tracker reactively observes) already lands synchronously on
    // `mutate()`. Awaiting the full network round-trip here before
    // advancing made the main card visibly lag a couple seconds behind
    // the progress tracker on every save.
    saveLine(currentLine, {
      countedQuantity: countedQty,
      reasonCode: (finalReasonCode ?? reasonCode) || null,
      note: note.trim() === "" ? null : note,
    });
    advanceAfterResolution();
  }

  function handleSaveAndNext() {
    if (!currentLine) return;
    const countedQty = inputVal.trim() === "" ? 0 : parseInt(inputVal, 10);
    const hasDifference = !isNaN(countedQty) && countedQty !== currentLine.expected_quantity;

    if (hasDifference && !reasonCode && requireReasonForVariance) {
      setReasonModalOpen(true);
      return;
    }
    executeSaveAndNext();
  }

  function handleSkip() {
    if (!currentLine) return;
    skipLine(currentLine);
    const next = goToNextUnresolved();
    if (next === -1) toast.info(t("noOtherUnresolved"));
  }

  function handleSaveNote() {
    if (currentLine) saveNote(currentLine, note);
    setNotesDialogOpen(false);
  }

  function handlePrevious() {
    const prev = goToPreviousUnresolved();
    if (prev === -1) toast.info(t("noOtherUnresolved"));
  }

  function handleNext() {
    const next = goToNextUnresolved();
    if (next === -1) toast.info(t("noOtherUnresolved"));
  }

  async function handleFinishCounting() {
    await finishCounting();
  }

  function handleExitWithoutSaving() {
    setInterruptDialogOpen(false);
    pauseSession();
  }

  function handleSaveAndExit() {
    setInterruptDialogOpen(false);
    pauseSession();
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-transparent">
      <CountProgressHeader
        overallStats={overallStats}
        currentLine={currentLine}
        locationFilterActive={!!locationFilterId}
        onClearLocationFilter={() => setLocationFilter(null)}
        onOpenLocationSheet={() => setLocationSheetOpen(true)}
        onScanItem={() => setScanMode("item")}
        lines={filteredLines}
        currentIndex={currentIndex}
        showExpectedQuantity={showExpectedQuantity}
        onSelectIndex={selectIndex}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 space-y-4 px-3 py-4">
        {currentLine ? (
          <>
            <CountItemCard
              line={currentLine}
              showExpectedQuantity={showExpectedQuantity}
              inputVal={inputVal}
              onInputChange={setInputVal}
              incrementStep={incrementStep}
              onIncrementStepChange={setIncrementStep}
              liveVariance={liveVariance}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            <CountPrimaryActions
              hasNote={note.trim() !== ""}
              onOpenNotes={() => setNotesDialogOpen(true)}
              onSkip={() => void handleSkip()}
              onSave={handleSaveAndNext}
              saveDisabled={inputVal.trim() === ""}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
            <Info size={40} className="mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("emptySessionTitle")}</p>
          </div>
        )}

        {currentLine && (
          <div className="border-t border-border pt-3">
            {filteredStats.percent === 100 ? (
              <button
                type="button"
                disabled={isFinishing}
                onClick={() => void handleFinishCounting()}
                className="flex w-full cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFinishing && <Loader2 size={12} className="animate-spin" />}
                {t("finishAndSubmit")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setInterruptDialogOpen(true)}
                className="flex w-full cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 py-3 text-[11px] font-bold uppercase tracking-wider text-destructive transition-all hover:bg-destructive/20"
              >
                {t("interruptCounting")}
              </button>
            )}
          </div>
        )}
      </div>

      <CountReasonModal
        open={reasonModalOpen}
        expectedQuantity={currentLine?.expected_quantity ?? 0}
        enteredQuantity={inputVal}
        variance={liveVariance ?? 0}
        reasonCode={reasonCode}
        onReasonCodeChange={setReasonCode}
        comment={note}
        onCommentChange={setNote}
        onCancel={() => setReasonModalOpen(false)}
        onConfirm={() => {
          setReasonModalOpen(false);
          void executeSaveAndNext(reasonCode);
        }}
      />

      <CountNotesModal
        open={notesDialogOpen}
        itemName={currentLine?.productName ?? ""}
        note={note}
        onNoteChange={setNote}
        onClear={() => setNote("")}
        onDone={() => void handleSaveNote()}
      />

      <CountInterruptDialog
        open={interruptDialogOpen}
        progressPercent={filteredStats.percent}
        onExitWithoutSaving={handleExitWithoutSaving}
        onSaveAndExit={handleSaveAndExit}
        onCancel={() => setInterruptDialogOpen(false)}
      />

      <CountLocationJumpSheet
        open={locationSheetOpen}
        locations={locations}
        allLines={allSortedLines}
        activeLocationId={locationFilterId}
        onSelectLocation={(locationId) => {
          setLocationFilter(locationId);
          setLocationSheetOpen(false);
        }}
        onClearFilter={() => {
          setLocationFilter(null);
          setLocationSheetOpen(false);
        }}
        onOpenScanner={() => {
          setLocationSheetOpen(false);
          setScanMode("location");
        }}
        onClose={() => setLocationSheetOpen(false)}
      />

      <CountScanTrigger
        mode={scanMode}
        currentLocationId={currentLine?.location_id ?? ""}
        currentLocationCode={currentLine?.locationCode ?? ""}
        currentSku={currentLine?.sku ?? ""}
        onClose={() => setScanMode(null)}
        onLocationVerified={() => setScanMode(null)}
        onLocationMismatch={() => {
          // Mismatch message is already shown inline by CountScanTrigger;
          // the scanner stays open so the counter can retry.
        }}
        onItemVerified={() => setScanMode(null)}
      />

      <LoadingOverlay visible={isFinishing} label={t("finishingAndSubmitting")} />
    </div>
  );
}
