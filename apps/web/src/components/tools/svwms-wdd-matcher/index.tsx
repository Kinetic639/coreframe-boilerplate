"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { UploadZone } from "./upload-zone";
import { ExtractionReviewView } from "./extraction-review-view";
import {
  PIPELINE_STEPS,
  PipelineProgressOverlay,
  runningPipeline,
  type PipelineStepId,
  type WddMatcherPipelineState,
} from "./pipeline-progress";
import {
  wddMatcherKeys,
  useSessionsQuery,
  useCreateAutoSessionMutation,
  useUploadAndParseFileMutation,
} from "@/hooks/queries/tools/wdd-matcher";
import {
  getEnhancedPdfDataAction,
  getSessionExtractedDataAction,
  getSessionResultsAction,
  listSessionsAction,
  runMatchingAction,
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
  const [blockingPipeline, setBlockingPipeline] = useState<WddMatcherPipelineState | null>(null);
  const [backgroundPipeline, setBackgroundPipeline] = useState<WddMatcherPipelineState | null>(
    null
  );
  const [matchedSession, setMatchedSession] = useState<WddMatcherSession | null>(null);

  const t = useTranslations("modules.tools.wddMatcher");
  const queryClient = useQueryClient();
  const { data: sessions } = useSessionsQuery();

  const createSession = useCreateAutoSessionMutation((session) => {
    void session;
  });

  const uploadAndParse = useUploadAndParseFileMutation();

  const markBlockingStep = useCallback((activeStep: PipelineStepId) => {
    setBlockingPipeline((prev) => {
      const completedSteps = prev?.completedSteps ?? [];
      const previousActive = prev?.activeStep;
      const nextCompleted =
        previousActive && !completedSteps.includes(previousActive)
          ? [...completedSteps, previousActive]
          : completedSteps;

      return {
        status: "running",
        activeStep,
        completedSteps: nextCompleted,
        error: null,
      };
    });
  }, []);

  const markBackgroundStep = useCallback((activeStep: PipelineStepId) => {
    setBackgroundPipeline((prev) => {
      const completedSteps = prev?.completedSteps ?? ["session", "extract", "preview"];
      const previousActive = prev?.activeStep;
      const nextCompleted =
        previousActive && !completedSteps.includes(previousActive)
          ? [...completedSteps, previousActive]
          : completedSteps;

      return {
        status: "running",
        activeStep,
        completedSteps: nextCompleted,
        error: null,
      };
    });
  }, []);

  const prefetchExtractionPreview = useCallback(
    async (sessionId: string) => {
      const extractedFiles = unwrap<ExtractedFileData[]>(
        await getSessionExtractedDataAction(sessionId)
      );
      queryClient.setQueryData(wddMatcherKeys.extractedData(sessionId), extractedFiles);
      return extractedFiles;
    },
    [queryClient]
  );

  const runBackgroundAutomation = useCallback(
    async (session: WddMatcherSession) => {
      const sessionId = session.id;
      try {
        setBackgroundPipeline({
          status: "running",
          activeStep: "match",
          completedSteps: ["session", "extract", "preview"],
          error: null,
        });

        unwrap(await runMatchingAction(sessionId));
        const results = unwrap<WddMatchResultEntry[]>(await getSessionResultsAction(sessionId));
        queryClient.setQueryData(wddMatcherKeys.results(sessionId), results);
        queryClient.invalidateQueries({ queryKey: wddMatcherKeys.sessions() });

        const sessionsResult = await listSessionsAction();
        const updatedSessions = sessionsResult.success ? sessionsResult.data : null;
        if (updatedSessions) queryClient.setQueryData(wddMatcherKeys.sessions(), updatedSessions);
        const updatedSession = updatedSessions?.find((item) => item.id === sessionId) ?? session;
        setMatchedSession(updatedSession);

        markBackgroundStep("pdf");
        const pdfBlocks = unwrap<PdfBlockData[]>(await getEnhancedPdfDataAction(sessionId));
        queryClient.setQueryData(wddMatcherKeys.enhancedPdfData(sessionId), pdfBlocks);

        setBackgroundPipeline({
          status: "ready",
          activeStep: null,
          completedSteps: PIPELINE_STEPS,
          error: null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Background processing failed";
        setBackgroundPipeline((prev) => ({
          status: "error",
          activeStep: prev?.activeStep ?? "match",
          completedSteps: prev?.completedSteps ?? ["session", "extract", "preview"],
          error: msg,
        }));
        toast.error(msg);
      }
    },
    [markBackgroundStep, queryClient]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      setMatchedSession(null);
      setBackgroundPipeline(null);
      setBlockingPipeline(runningPipeline("session"));
      try {
        // 1. Create session
        const sessionResult = await createSession.mutateAsync();
        const sessionId = sessionResult.id;
        markBlockingStep("extract");

        // 2. Upload + parse all files in parallel
        const uploadResults = await Promise.allSettled(
          files.map((file) => {
            const fd = new FormData();
            fd.append("sessionId", sessionId);
            fd.append("file", file);
            return uploadAndParse.mutateAsync(fd);
          })
        );

        const failures = uploadResults.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          const msg = (failures[0] as PromiseRejectedResult).reason?.message ?? "Upload failed";
          toast.error(msg);
        }

        const successes = uploadResults.filter((r) => r.status === "fulfilled");
        if (successes.length === 0) {
          toast.error(t("errors.noFilesProcessed"));
          return;
        }

        // 3. Warm the extraction query cache before the review screen mounts.
        markBlockingStep("preview");
        await prefetchExtractionPreview(sessionId);

        // 4. Show extraction review immediately, then continue matching/PDF prep in background.
        setView({ name: "extraction-review", sessionId });
        setBlockingPipeline(null);
        void runBackgroundAutomation(sessionResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Processing failed";
        setBlockingPipeline((prev) => ({
          status: "error",
          activeStep: prev?.activeStep ?? "extract",
          completedSteps: prev?.completedSteps ?? [],
          error: msg,
        }));
        toast.error(msg);
      } finally {
        setBlockingPipeline((prev) => (prev?.status === "error" ? prev : null));
      }
    },
    [
      createSession,
      markBlockingStep,
      prefetchExtractionPreview,
      runBackgroundAutomation,
      t,
      uploadAndParse,
    ]
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
      <UploadZone onProcess={processFiles} isProcessing={blockingPipeline?.status === "running"} />

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

      {blockingPipeline && <PipelineProgressOverlay pipeline={blockingPipeline} />}
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
