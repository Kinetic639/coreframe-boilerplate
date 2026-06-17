"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  X,
  Copy,
  Download,
  Check,
  FileJson,
  Info,
  Database,
  Search,
  LayoutGrid,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { generateLocationExport, LocationExportSchema } from "../../lib/locationExport";
import { LogicalLocation, Layout } from "../../types";

interface LocationExportDialogProps {
  locations: LogicalLocation[];
  layouts: Layout[];
  onClose: () => void;
}

export default function LocationExportDialog({
  locations,
  layouts,
  onClose,
}: LocationExportDialogProps) {
  const t = useTranslations("ambraLocations.export");
  const [copied, setCopied] = useState(false);
  const branchId = layouts[0]?.branchId || "unknown";

  const exportData = React.useMemo(
    () => generateLocationExport(locations, branchId),
    [locations, branchId]
  );
  const jsonString = JSON.stringify(exportData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ambra-locations-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-5xl h-[85vh] bg-card border border-border rounded-lg shadow-sm flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-border bg-card/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-normal uppercase">
                {t("title")}
              </h2>
              <p className="text-xs text-muted-foreground font-semibold tracking-wide mt-0.5">
                {t("schemaVersion", { version: exportData.schemaVersion })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Summary Sidebar */}
          <div className="w-80 border-r border-border p-8 overflow-y-auto bg-background/40 scrollbar-thin scrollbar-thumb-muted space-y-8">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                <Info className="w-3.5 h-3.5" />
                {t("summary")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <SummaryStat
                  label={t("totalNodes")}
                  value={exportData.metadata.counts.totalLocations}
                />
                <SummaryStat
                  label={t("leafNodes")}
                  value={exportData.metadata.counts.leafLocations}
                />
                <SummaryStat label={t("maxDepth")} value={exportData.metadata.maxDepth} />
                <SummaryStat
                  label={t("rootNodes")}
                  value={exportData.metadata.counts.rootLocations}
                />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-amber-500 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t("diagnostics")}
              </h3>
              <div className="space-y-2">
                <DiagnosticItem
                  label={t("duplicateCodes")}
                  count={exportData.diagnostics.duplicateCodes.length}
                  severity={exportData.diagnostics.duplicateCodes.length > 0 ? "warning" : "ok"}
                />
                <DiagnosticItem
                  label={t("missingParents")}
                  count={exportData.diagnostics.missingParents.length}
                  severity={exportData.diagnostics.missingParents.length > 0 ? "critical" : "ok"}
                />
                <DiagnosticItem
                  label={t("invalidCodes")}
                  count={exportData.diagnostics.locationsWithoutCodes.length}
                  severity={
                    exportData.diagnostics.locationsWithoutCodes.length > 0 ? "critical" : "ok"
                  }
                />
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5" />
                {t("mappingEligibility")}
              </h3>
              <div className="space-y-2">
                <MappingFact
                  label={t("visualEligible")}
                  count={exportData.visualizationReadiness.locationsEligibleForVisualization.length}
                />
                <MappingFact
                  label={t("storageReady")}
                  count={exportData.visualizationReadiness.storageCapableLeafLocations.length}
                />
                <MappingFact
                  label={t("workspaceRoots")}
                  count={exportData.visualizationReadiness.suggestedWorkspaceRoots.length}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-[10px] leading-relaxed text-muted-foreground font-medium">
                <span className="font-bold text-muted-foreground">{t("noticeLabel")}:</span>{" "}
                {t("notice")}
              </p>
            </div>
          </div>

          {/* JSON View */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-6 py-3 border-b border-border bg-card/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("liveJsonPayload")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-muted hover:bg-muted text-[10px] font-bold text-foreground/80 hover:text-foreground transition-all border border-border flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copied ? t("copied") : t("copyJson")}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-[10px] font-bold text-primary transition-all border border-primary/20 flex-shrink-0"
                >
                  <Download className="w-3 h-3" />
                  {t("download")}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8 font-mono text-[11px] bg-background/60 scrollbar-thin scrollbar-thumb-muted">
              <pre className="text-muted-foreground leading-relaxed whitespace-pre font-mono">
                {jsonString}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-card border-t border-border flex items-center justify-between shrink-0">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide italic">
            {t("readOnly")}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-muted hover:bg-muted font-semibold text-[10px] uppercase tracking-wide text-foreground transition-all border border-border"
          >
            {t("finishedInspection")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/30 border border-border p-3 rounded-xl">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DiagnosticItem({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  severity: "ok" | "warning" | "critical";
}) {
  const styles = {
    ok: "text-emerald-700 dark:text-emerald-300/50",
    warning: "text-amber-500 font-bold",
    critical: "text-rose-500 font-bold",
  };

  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={styles[severity]}>{count === 0 ? "0" : count}</span>
    </div>
  );
}

function MappingFact({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <div className="flex items-center gap-2">
        <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
        <span className="text-muted-foreground font-bold tracking-tight">{label}</span>
      </div>
      <span className="font-mono text-muted-foreground">{count}</span>
    </div>
  );
}
