"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Clock, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { UploadZone } from "./upload-zone";
import { ResultsView } from "./results-view";
import { ExtractionReviewView } from "./extraction-review-view";
import {
  useSessionsQuery,
  useCreateAutoSessionMutation,
  useUploadAndParseFileMutation,
} from "@/hooks/queries/tools/wdd-matcher";
import type { WddMatcherSession } from "@/server/services/wdd-matcher.service";

// ---------------------------------------------------------------------------
// View state
// ---------------------------------------------------------------------------

type View =
  | { name: "home" }
  | { name: "extraction-review"; sessionId: string }
  | { name: "results"; session: WddMatcherSession };

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function SvwmsWddMatcher() {
  const [view, setView] = useState<View>({ name: "home" });
  const [isProcessing, setIsProcessing] = useState(false);

  const t = useTranslations("modules.tools.wddMatcher");
  const { data: sessions } = useSessionsQuery();

  const createSession = useCreateAutoSessionMutation((session) => {
    void session;
  });

  const uploadAndParse = useUploadAndParseFileMutation();

  const processFiles = useCallback(
    async (files: File[]) => {
      setIsProcessing(true);
      try {
        // 1. Create session
        const sessionResult = await createSession.mutateAsync();
        const sessionId = sessionResult.id;

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

        // 3. Show extraction review — user verifies parsed blocks before matching runs
        setView({ name: "extraction-review", sessionId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Processing failed";
        toast.error(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [createSession, uploadAndParse, t]
  );

  const goHome = useCallback(() => setView({ name: "home" }), []);

  // ---------------------------------------------------------------------------
  // Extraction review
  // ---------------------------------------------------------------------------

  if (view.name === "extraction-review") {
    return (
      <ExtractionReviewView
        sessionId={view.sessionId}
        onMatchingComplete={(session) => setView({ name: "results", session })}
        onBack={goHome}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Results view
  // ---------------------------------------------------------------------------

  if (view.name === "results") {
    return <ResultsView session={view.session} onNewUpload={goHome} />;
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
      <UploadZone onProcess={processFiles} isProcessing={isProcessing} />

      {/* Past uploads */}
      {sessions && sessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t("history.title")}</h3>
          <div className="rounded-lg border divide-y">
            {sessions.slice(0, 10).map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onClick={() => setView({ name: "results", session })}
              />
            ))}
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-xl shadow-lg p-8 flex flex-col items-center gap-4 max-w-sm mx-auto text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-semibold">{t("processing.title")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("processing.subtitle")}</p>
            </div>
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
