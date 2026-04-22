"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Download,
  UploadCloud,
  CheckCircle2,
  HelpCircle,
  XCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSessionResultsQuery,
  useExportCsvMutation,
  useEnhancedPdfDataMutation,
} from "@/hooks/queries/tools/wdd-matcher";
import dynamic from "next/dynamic";
const PdfPreviewDialog = dynamic(
  () =>
    import("@/components/tools/svwms-wdd-matcher/pdf-preview-dialog").then((m) => ({
      default: m.PdfPreviewDialog,
    })),
  { ssr: false, loading: () => null }
);
import type { WddMatcherSession, PdfBlockData } from "@/server/services/wdd-matcher.service";
import type { BlockMatchType } from "@/lib/validations/wdd-matcher";

interface ResultsViewProps {
  session: WddMatcherSession;
  onNewUpload: () => void;
}

export function ResultsView({ session, onNewUpload }: ResultsViewProps) {
  const t = useTranslations("modules.tools.wddMatcher");
  const { data: results, isLoading } = useSessionResultsQuery(session.id);
  const exportCsv = useExportCsvMutation(session.id);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlocks, setPdfBlocks] = useState<PdfBlockData[] | null>(null);
  const fetchPdfData = useEnhancedPdfDataMutation((blocks) => {
    setPdfBlocks(blocks);
    setPreviewOpen(true);
  });

  const summary = session.match_summary as Record<string, number> | null;
  const totalWddBlocks = summary?.total_wdd_blocks ?? 0;
  const directOrders = summary?.direct_orders ?? 0;

  const exact = results?.filter((r) => r.matchType === "exact").length ?? 0;
  const subset = results?.filter((r) => r.matchType === "subset").length ?? 0;
  const partial =
    (results?.filter((r) => r.matchType === "partial" || r.matchType === "ambiguous").length ?? 0) +
    subset;
  const unmatched = results?.filter((r) => r.matchType === "unmatched_bc").length ?? 0;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t("results.session")}</p>
          <h2 className="text-xl font-semibold">{session.name}</h2>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPdfData.mutate(session.id)}
            disabled={fetchPdfData.isPending || isLoading}
          >
            {fetchPdfData.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-4 w-4" />
            )}
            {t("results.exportEnhancedPdf")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv.mutate()}
            disabled={exportCsv.isPending || isLoading}
          >
            {exportCsv.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            {t("results.exportCsv")}
          </Button>
          <Button size="sm" onClick={onNewUpload}>
            <UploadCloud className="mr-1.5 h-4 w-4" />
            {t("results.newUpload")}
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <SummaryChip label={t("results.exactMatches")} value={exact} color="green" />
        <SummaryChip label={t("results.partialMatches")} value={partial} color="yellow" />
        <SummaryChip label={t("results.unmatched")} value={unmatched} color="red" />
        {summary && typeof summary.unmatched_brand === "number" && summary.unmatched_brand > 0 && (
          <SummaryChip
            label={t("results.unmatchedOrders")}
            value={summary.unmatched_brand}
            color="orange"
          />
        )}
      </div>

      {/* Scope line */}
      {totalWddBlocks > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("results.totalScope", { total: totalWddBlocks })}
          </span>
          {directOrders > 0 && (
            <span>{t("results.directOrdersNote", { count: directOrders })}</span>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !results?.length ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <HelpCircle className="h-8 w-8" />
          <p className="text-sm">{t("results.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left">{t("results.columns.wddNumber")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.groupName")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.parts")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.orderNumber")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.zwNumber")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.zlNumber")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.client")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.confidence")}</th>
                <th className="px-3 py-3 text-left">{t("results.columns.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((r, idx) => (
                <tr key={idx} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs">{r.wdd.wddNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {r.wdd.groupName ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-center">{r.wdd.partsCount}</td>
                  <td className="px-3 py-3 font-mono text-xs">{r.order?.orderNumber ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{r.order?.zwNumber ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{r.order?.zlNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                    {r.order?.clientName ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {r.matchType !== "unmatched_bc" ? (
                      <ConfidenceBar value={r.confidence} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <MatchTypeBadge type={r.matchType} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        blocks={pdfBlocks}
        sessionName={session.name}
        sessionId={session.id}
      />
    </div>
  );
}

function SummaryChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "yellow" | "red" | "orange";
}) {
  const cls = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    orange: "bg-orange-100 text-orange-800",
  }[color];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      <span className="font-bold">{value}</span>
      <span className="font-normal opacity-80">{label}</span>
    </span>
  );
}

function MatchTypeBadge({ type }: { type: BlockMatchType }) {
  const t = useTranslations("modules.tools.wddMatcher.matchType");
  const config: Record<BlockMatchType, { cls: string; icon: React.ReactNode }> = {
    exact: {
      cls: "bg-green-100 text-green-800",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    subset: {
      cls: "bg-emerald-100 text-emerald-800",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    partial: {
      cls: "bg-yellow-100 text-yellow-800",
      icon: <HelpCircle className="h-3 w-3" />,
    },
    ambiguous: {
      cls: "bg-orange-100 text-orange-800",
      icon: <HelpCircle className="h-3 w-3" />,
    },
    unmatched_bc: {
      cls: "bg-red-100 text-red-800",
      icon: <XCircle className="h-3 w-3" />,
    },
    unmatched_brand: {
      cls: "bg-slate-100 text-slate-600",
      icon: <HelpCircle className="h-3 w-3" />,
    },
  };
  const { cls, icon } = config[type] ?? config.unmatched_bc;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {icon}
      {t(type)}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 90 ? "bg-green-500" : value >= 55 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}
