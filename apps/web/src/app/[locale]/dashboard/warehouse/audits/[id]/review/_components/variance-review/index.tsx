"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  CornerDownRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  useApproveCountSessionMutation,
  useBulkApproveLinesMutation,
  useCountSessionDetailQuery,
  useUpdateCountLineMutation,
} from "@/hooks/queries/warehouse/audits";
import { LoadingOverlay } from "@/components/branding";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { useVarianceGrouping } from "./use-variance-grouping";
import { VarianceGroupSection } from "./variance-group-section";
import { VarianceBulkApproveBar } from "./variance-bulk-approve-bar";
import { VarianceApproveSessionButton } from "./variance-approve-session-button";
import { VarianceLeaveDialog } from "./variance-leave-dialog";
import type { EnrichedCountLine, ReviewSessionInfo } from "./types";

interface VarianceReviewScreenProps {
  session: ReviewSessionInfo;
  initialLines: EnrichedCountLine[];
}

export function VarianceReviewScreen({ session, initialLines }: VarianceReviewScreenProps) {
  const t = useTranslations("warehouseInventory.audits.review");
  const router = useRouter();

  const requireReasonForVariance = session.scope.require_reason_for_variance !== false;

  // Same live-query wiring as GuidedCountScreen — approve/unapprove/
  // bulk-approve all invalidate this cache key already; without subscribing
  // here, the approve buttons and group counts stayed frozen at the SSR
  // snapshot until a full reload.
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

  const groups = useVarianceGrouping(lines);
  const updateLine = useUpdateCountLineMutation(session.id);
  const bulkApprove = useBulkApproveLinesMutation(session.id);
  const approveSession = useApproveCountSessionMutation();

  const unapprovedCount = useMemo(
    () => lines.filter((l) => l.status !== "approved" && l.status !== "pending").length,
    [lines]
  );

  const eligibleIds = useMemo(
    () =>
      [...groups.shortages, ...groups.surpluses, ...groups.matches]
        .filter((l) => l.status === "counted")
        .map((l) => l.id),
    [groups]
  );

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  // approveSession.isPending resets as soon as the network call settles, but
  // router.push() + the report screen's own data fetch still take a beat
  // after that — leaving a window where the button looks idle and clickable
  // again before the navigation actually lands. This stays true across that
  // whole span and is only cleared on failure.
  const [isPosting, setIsPosting] = useState(false);

  const blocked =
    groups.pending.length > 0 ||
    groups.needsRecount.length > 0 ||
    groups.shortages.some((l) => l.status !== "approved") ||
    groups.surpluses.some((l) => l.status !== "approved") ||
    groups.matches.some((l) => l.status !== "approved");

  function approveLine(lineId: string) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    updateLine.mutate({
      id: lineId,
      current_status: line.status,
      status: "approved",
      require_reason_for_variance: requireReasonForVariance,
    });
  }

  function unapproveLine(lineId: string) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    updateLine.mutate({ id: lineId, current_status: line.status, status: "counted" });
  }

  function updateReasonAndNote(lineId: string, reasonCode: string | null, note: string | null) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    updateLine.mutate({
      id: lineId,
      current_status: line.status,
      reason_code: reasonCode,
      note,
    });
  }

  function enterQuantity(lineId: string, quantity: number) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    updateLine.mutate({
      id: lineId,
      current_status: line.status,
      counted_quantity: quantity,
      status: "counted",
    });
  }

  function handleApproveAll() {
    if (eligibleIds.length === 0) return;
    bulkApprove.mutate({
      line_ids: eligibleIds,
      require_reason_for_variance: requireReasonForVariance,
    });
  }

  function handleLeave() {
    setLeaveDialogOpen(false);
    router.push({ pathname: "/dashboard/warehouse/audits" });
  }

  function handlePost() {
    setIsPosting(true);
    approveSession.mutate(
      { id: session.id },
      {
        onSuccess: () => {
          router.push({
            pathname: "/dashboard/warehouse/audits/[id]/report",
            params: { id: session.id },
          });
        },
        onError: () => setIsPosting(false),
      }
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-transparent">
      <div className="sticky top-0 z-40 flex min-h-[56px] items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 shadow-md">
        <button
          type="button"
          onClick={() => setLeaveDialogOpen(true)}
          title={t("leaveAudit")}
          className="flex w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted/20 p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-primary"
        >
          <ChevronLeft size={16} className="stroke-[3]" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="block text-xs font-black uppercase tracking-widest leading-tight text-primary">
            {t("title")}
          </h1>
          <span className="mt-0.5 block truncate font-mono text-[10px] font-bold leading-none text-muted-foreground">
            {session.count_number}
          </span>
        </div>
        <div className="w-9 shrink-0" />
      </div>

      <div className="relative z-10 mx-auto max-w-md space-y-4 px-4 py-4">
        {groups.pending.length > 0 && (
          <div className="flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">{t("pendingWarningTitle")}</span>
              <p className="mt-0.5 leading-relaxed text-destructive/90">
                {t("pendingWarningDescription", { count: groups.pending.length })}
              </p>
            </div>
          </div>
        )}

        {lines.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("emptyState")}
          </div>
        )}

        <VarianceGroupSection
          title={t("groupShortages", { count: groups.shortages.length })}
          icon={<TrendingDown size={14} />}
          titleClassName="text-red-500"
          lines={groups.shortages}
          kind="shortage"
          requireReasonForVariance={requireReasonForVariance}
          onApprove={approveLine}
          onUnapprove={unapproveLine}
          onUpdateReasonAndNote={updateReasonAndNote}
          onEnterQuantity={enterQuantity}
        />

        <VarianceGroupSection
          title={t("groupSurpluses", { count: groups.surpluses.length })}
          icon={<TrendingUp size={14} />}
          titleClassName="text-blue-500"
          lines={groups.surpluses}
          kind="surplus"
          requireReasonForVariance={requireReasonForVariance}
          onApprove={approveLine}
          onUnapprove={unapproveLine}
          onUpdateReasonAndNote={updateReasonAndNote}
          onEnterQuantity={enterQuantity}
        />

        <VarianceGroupSection
          title={t("groupNeedsRecount", { count: groups.needsRecount.length })}
          icon={<AlertCircle size={14} />}
          titleClassName="text-amber-500"
          lines={groups.needsRecount}
          kind="needsRecount"
          requireReasonForVariance={requireReasonForVariance}
          onApprove={approveLine}
          onUnapprove={unapproveLine}
          onUpdateReasonAndNote={updateReasonAndNote}
          onEnterQuantity={enterQuantity}
        />

        <VarianceGroupSection
          title={t("groupSkipped", { count: groups.skipped.length })}
          icon={<CornerDownRight size={14} />}
          titleClassName="text-muted-foreground"
          lines={groups.skipped}
          kind="skipped"
          requireReasonForVariance={requireReasonForVariance}
          onApprove={approveLine}
          onUnapprove={unapproveLine}
          onUpdateReasonAndNote={updateReasonAndNote}
          onEnterQuantity={enterQuantity}
        />

        <VarianceGroupSection
          title={t("groupMatches", { count: groups.matches.length })}
          icon={<CheckCircle2 size={14} />}
          titleClassName="text-emerald-500"
          lines={groups.matches}
          kind="match"
          requireReasonForVariance={requireReasonForVariance}
          onApprove={approveLine}
          onUnapprove={unapproveLine}
          onUpdateReasonAndNote={updateReasonAndNote}
          onEnterQuantity={enterQuantity}
        />

        {lines.length > 0 && (
          <VarianceBulkApproveBar
            totalLines={lines.length}
            unapprovedCount={unapprovedCount}
            eligibleCount={eligibleIds.length}
            isApproving={bulkApprove.isPending}
            onApproveAll={handleApproveAll}
          />
        )}
      </div>

      <VarianceApproveSessionButton
        countNumber={session.count_number}
        blocked={blocked}
        unresolvedCount={unapprovedCount}
        isPosting={isPosting || approveSession.isPending}
        onConfirm={handlePost}
      />

      <VarianceLeaveDialog
        open={leaveDialogOpen}
        onConfirm={handleLeave}
        onCancel={() => setLeaveDialogOpen(false)}
      />

      <LoadingOverlay visible={isPosting || approveSession.isPending} label={t("posting")} />
    </div>
  );
}
