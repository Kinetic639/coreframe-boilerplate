"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { UploadZone } from "./upload-zone";
import { ExtractionReviewView } from "./extraction-review-view";
import { PIPELINE_STEPS, type WddMatcherPipelineState } from "./pipeline-progress";
import { wddMatcherKeys, useSessionsQuery } from "@/hooks/queries/tools/wdd-matcher";
import {
  getEnhancedPdfDataAction,
  getSessionResultsAction,
  listSessionsAction,
  persistPreparedSessionAction,
  prepareFastSessionAction,
} from "@/app/actions/tools/wdd-matcher";
import type {
  ExtractedFileData,
  PdfBlockData,
  WddMatcherSession,
  WddMatchResultEntry,
} from "@/server/services/wdd-matcher.service";

// ---------------------------------------------------------------------------
// View state
// ---------------------------------------------------------------------------

type View = { name: "home" } | { name: "extraction-review"; sessionId: string };

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function unwrap<T>(result: ActionResult<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { success: false; error: string }).error);
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function SvwmsWddMatcher() {
  const [view, setView] = useState<View>({ name: "home" });
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [backgroundPipeline, setBackgroundPipeline] = useState<WddMatcherPipelineState | null>(
    null
  );
  const [matchedSession, setMatchedSession] = useState<WddMatcherSession | null>(null);

  const t = useTranslations("modules.tools.wddMatcher");
  const queryClient = useQueryClient();
  const { data: sessions } = useSessionsQuery();

  const runBackgroundPersistence = useCallback(
    async (session: WddMatcherSession, files: File[], extractedFiles: ExtractedFileData[]) => {
      const sessionId = session.id;
      try {
        setBackgroundPipeline({
          status: "running",
          activeStep: "match",
          completedSteps: ["session", "extract", "preview"],
          error: null,
        });

        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("extractedFiles", JSON.stringify(extractedFiles));
        for (const file of files) formData.append("files", file);

        unwrap(await persistPreparedSessionAction(formData));

        const [results, pdfBlocks, sessionsResult] = await Promise.all([
          getSessionResultsAction(sessionId).then(unwrap<WddMatchResultEntry[]>),
          getEnhancedPdfDataAction(sessionId).then(unwrap<PdfBlockData[]>),
          listSessionsAction(),
        ]);

        queryClient.setQueryData(wddMatcherKeys.results(sessionId), results);
        queryClient.setQueryData(wddMatcherKeys.enhancedPdfData(sessionId), pdfBlocks);
        if (sessionsResult.success) {
          queryClient.setQueryData(wddMatcherKeys.sessions(), sessionsResult.data);
          const updatedSession = sessionsResult.data.find((item) => item.id === sessionId);
          if (updatedSession) setMatchedSession(updatedSession);
        }

        setBackgroundPipeline({
          status: "ready",
          activeStep: null,
          completedSteps: PIPELINE_STEPS,
          error: null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Background persistence failed";
        setBackgroundPipeline((prev) => ({
          status: "error",
          activeStep: prev?.activeStep ?? "match",
          completedSteps: prev?.completedSteps ?? ["session", "extract", "preview"],
          error: msg,
        }));
        toast.error(msg);
      }
    },
    [queryClient]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      setMatchedSession(null);
      setBackgroundPipeline(null);
      setIsPreparingSession(true);
      try {
        const formData = new FormData();
        for (const file of files) formData.append("files", file);
        const prepared = unwrap(await prepareFastSessionAction(formData));
        const sessionId = prepared.session.id;

        queryClient.setQueryData(wddMatcherKeys.extractedData(sessionId), prepared.extractedFiles);
        queryClient.setQueryData(wddMatcherKeys.results(sessionId), prepared.results);
        queryClient.setQueryData(wddMatcherKeys.enhancedPdfData(sessionId), prepared.pdfBlocks);
        queryClient.setQueryData<WddMatcherSession[] | undefined>(
          wddMatcherKeys.sessions(),
          (current) => [prepared.session, ...(current ?? [])]
        );

        setMatchedSession(prepared.session);
        setView({ name: "extraction-review", sessionId });
        void runBackgroundPersistence(prepared.session, files, prepared.extractedFiles);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Processing failed";
        toast.error(msg);
      } finally {
        setIsPreparingSession(false);
      }
    },
    [queryClient, runBackgroundPersistence]
  );

  const goHome = useCallback(() => {
    setView({ name: "home" });
    setBackgroundPipeline(null);
    setMatchedSession(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Extraction review
  // ---------------------------------------------------------------------------

  if (view.name === "extraction-review") {
    return (
      <ExtractionReviewView
        sessionId={view.sessionId}
        onMatchingComplete={(session) => setMatchedSession(session)}
        onBack={goHome}
        pipeline={backgroundPipeline}
        matchedSession={matchedSession}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Home view — upload zone + history
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8 p-6 max-w-3xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Upload zone */}
      <UploadZone onProcess={processFiles} isProcessing={isPreparingSession} />

      {/* Past uploads */}
      {sessions && sessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t("history.title")}</h3>
          <div className="rounded-lg border divide-y">
            {sessions.slice(0, 10).map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onClick={() => {
                  setMatchedSession(session);
                  setBackgroundPipeline(null);
                  setView({ name: "extraction-review", sessionId: session.id });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session history row
// ---------------------------------------------------------------------------

function SessionRow({ session, onClick }: { session: WddMatcherSession; onClick: () => void }) {
  const t = useTranslations("modules.tools.wddMatcher");
  const summary = session.match_summary as Record<string, number> | null;

  const statusCls: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-blue-100 text-blue-800",
    ready_for_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
    >
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{session.name}</p>
        {summary && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("history.summary", {
              exact: summary.exact_block_matches ?? 0,
              partial: summary.partial_block_matches ?? 0,
              unmatched: summary.unmatched_bc ?? 0,
            })}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${statusCls[session.status] ?? "bg-muted text-muted-foreground"}`}
      >
        {t(`status.${session.status}`)}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
