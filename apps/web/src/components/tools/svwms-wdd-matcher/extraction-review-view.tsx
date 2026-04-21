"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Play,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  Copy,
  Check,
  Download,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import {
  useSessionExtractedDataQuery,
  useRunMatchingMutation,
} from "@/hooks/queries/tools/wdd-matcher";
import { listSessionsAction } from "@/app/actions/tools/wdd-matcher";
import type {
  WddMatcherSession,
  WddMatcherBlock,
  WddMatcherLine,
  WddMatcherSessionFile,
  ExtractedBlockData,
  ExtractedFileData,
} from "@/server/services/wdd-matcher.service";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExtractionReviewViewProps {
  sessionId: string;
  onMatchingComplete: (session: WddMatcherSession) => void;
  onBack: () => void;
}

function buildExtractionJsonPayload(extractedFiles: ExtractedFileData[]) {
  return extractedFiles.map(({ file, blocks }) => ({
    file: {
      id: file.id,
      name: file.file_name,
      role: file.file_role,
      size_bytes: file.file_size,
      brand_label: file.brand_label,
      parsed_at: file.parsed_at,
      parse_error: file.parse_error,
    },
    blocks: blocks.map(({ block, lines }) => ({
      block_index: block.block_index,
      block_type: block.block_type,
      is_excluded: block.is_excluded,
      header: block.block_header_text,
      warehouse_section: block.warehouse_section,
      brand_label: block.brand_label,
      page_number: block.page_number,
      metadata: block.metadata,
      lines: lines.map((l) => ({
        line_number: l.line_number,
        product_code: l.product_code,
        product_name: l.product_name,
        quantity: l.quantity,
        unit: l.unit,
        raw_text: l.raw_text,
        page_number: l.page_number,
      })),
    })),
  }));
}

function downloadJsonFile(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function metadataString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value : null;
}

interface ValidationInfo {
  status: "trusted" | "review" | "failed";
  confidenceScore: number | null;
  reasons: string[];
  humanSummary: string | null;
}

function isValidationStatus(value: unknown): value is ValidationInfo["status"] {
  return value === "trusted" || value === "review" || value === "failed";
}

function metadataValidation(meta: Record<string, unknown>, key: string): ValidationInfo | null {
  const value = meta[key];
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const status = record.status;
  if (!isValidationStatus(status)) return null;
  const reasons = Array.isArray(record.reasons)
    ? record.reasons.filter((reason): reason is string => typeof reason === "string")
    : [];
  return {
    status,
    confidenceScore:
      typeof record.confidenceScore === "number" && Number.isFinite(record.confidenceScore)
        ? record.confidenceScore
        : null,
    reasons,
    humanSummary: typeof record.humanSummary === "string" ? record.humanSummary : null,
  };
}

function metadataWarnings(meta: Record<string, unknown>, key: string): string[] {
  const value = meta[key];
  if (!value || typeof value !== "object") return [];
  const warnings = (value as Record<string, unknown>).warnings;
  return Array.isArray(warnings)
    ? warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
}

function formatConfidence(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function statusClass(status: ValidationInfo["status"] | "unknown"): string {
  if (status === "trusted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  return "border-muted bg-muted/40 text-muted-foreground";
}

function StatusPill({
  status,
  confidence,
  t,
}: {
  status: ValidationInfo["status"] | "unknown";
  confidence?: number | null;
  t: any;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${statusClass(status)}`}
    >
      {status === "trusted" && <CheckCircle2 className="h-3 w-3" />}
      {status === "review" && <AlertCircle className="h-3 w-3" />}
      {status === "failed" && <XCircle className="h-3 w-3" />}
      {t(`extractionReview.validation.status.${status}`)}
      {confidence != null && <span className="opacity-70">{formatConfidence(confidence)}</span>}
    </span>
  );
}

function HeaderDatum({ label, value }: { label: string; value: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExtractionReviewView({
  sessionId,
  onMatchingComplete,
  onBack,
}: ExtractionReviewViewProps) {
  const t = useTranslations("modules.tools.wddMatcher");
  const { data: extractedFiles, isLoading, error } = useSessionExtractedDataQuery(sessionId);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const runMatching = useRunMatchingMutation();

  const toggleFile = useCallback((fileId: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const toggleBlock = useCallback((blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  const handleRunMatching = async () => {
    setIsRunning(true);
    try {
      await runMatching.mutateAsync(sessionId);
      const sessionsResult = await listSessionsAction();
      if (sessionsResult.success) {
        const updated = sessionsResult.data.find((s) => s.id === sessionId);
        if (updated) {
          onMatchingComplete(updated);
          return;
        }
      }
      onMatchingComplete({ id: sessionId } as WddMatcherSession);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyJson = useCallback(async () => {
    if (!extractedFiles) return;
    const payload = buildExtractionJsonPayload(extractedFiles);
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [extractedFiles]);

  const handleDownloadJson = useCallback(() => {
    if (!extractedFiles) return;
    const payload = buildExtractionJsonPayload(extractedFiles);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJsonFile(
      `wdd-parser-results-${sessionId}-${timestamp}.json`,
      JSON.stringify(payload, null, 2)
    );
  }, [extractedFiles, sessionId]);

  // Total counts across all files
  const totalBlocks = extractedFiles?.reduce((sum, f) => sum + f.blocks.length, 0) ?? 0;
  const totalLines =
    extractedFiles?.reduce((sum, f) => sum + f.blocks.reduce((s, b) => s + b.lines.length, 0), 0) ??
    0;

  return (
    <div className="space-y-5 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold">{t("extractionReview.title")}</h2>
            {!isLoading && extractedFiles && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("extractionReview.summary", {
                  files: extractedFiles.length,
                  blocks: totalBlocks,
                  lines: totalLines,
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            disabled={isLoading || !extractedFiles?.length}
          >
            {copied ? (
              <Check className="mr-1.5 h-4 w-4 text-green-600" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            {t("extractionReview.copyJson")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadJson}
            disabled={isLoading || !extractedFiles?.length}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {t("extractionReview.downloadJson")}
          </Button>
          <Button
            onClick={handleRunMatching}
            disabled={isRunning || isLoading || !extractedFiles?.length}
            size="sm"
          >
            {isRunning ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            {t("extractionReview.runMatching")}
          </Button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {String(error)}
        </div>
      ) : !extractedFiles?.length ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground text-sm">
          <AlertCircle className="h-8 w-8" />
          {t("extractionReview.noFiles")}
        </div>
      ) : (
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">{t("extractionReview.tabs.list")}</TabsTrigger>
            <TabsTrigger value="diagnostics">{t("extractionReview.tabs.diagnostics")}</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-0">
            <div className="rounded-lg border divide-y">
              {extractedFiles.map(({ file, blocks }) => (
                <FileRow
                  key={file.id}
                  file={file}
                  blocks={blocks}
                  isExpanded={expandedFiles.has(file.id)}
                  onToggle={() => toggleFile(file.id)}
                  expandedBlocks={expandedBlocks}
                  onToggleBlock={toggleBlock}
                  t={t}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="diagnostics" className="mt-0">
            <DiagnosticsTab extractedFiles={extractedFiles} t={t} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File row
// ---------------------------------------------------------------------------

interface FileRowProps {
  file: WddMatcherSessionFile;
  blocks: ExtractedBlockData[];
  isExpanded: boolean;
  onToggle: () => void;
  expandedBlocks: Set<string>;
  onToggleBlock: (blockId: string) => void;

  t: any;
}

function FileRow({
  file,
  blocks,
  isExpanded,
  onToggle,
  expandedBlocks,
  onToggleBlock,
  t,
}: FileRowProps) {
  const nonExcluded = blocks.filter((b) => !b.block.is_excluded);
  const excluded = blocks.filter((b) => b.block.is_excluded);
  const totalLines = nonExcluded.reduce((s, b) => s + b.lines.length, 0);
  const hasError = !!file.parse_error;

  const roleCls: Record<string, string> = {
    bc: "bg-blue-100 text-blue-800",
    brand: "bg-purple-100 text-purple-800",
    wdd: "bg-emerald-100 text-emerald-800",
  };

  return (
    <div>
      {/* File header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium truncate">{file.file_name}</span>

        <span
          className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium uppercase ${roleCls[file.file_role] ?? "bg-muted text-muted-foreground"}`}
        >
          {file.file_role}
        </span>

        {hasError ? (
          <span className="shrink-0 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {t("extractionReview.parseError")}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("extractionReview.fileStats", {
              blocks: blocks.length,
              lines: totalLines,
            })}
            {excluded.length > 0 && (
              <span className="ml-1 text-muted-foreground/60">
                ({excluded.length} {t("extractionReview.excluded")})
              </span>
            )}
          </span>
        )}
      </button>

      {/* Blocks list */}
      {isExpanded && (
        <div className="border-t bg-muted/10 divide-y">
          {blocks.length === 0 ? (
            <p className="px-8 py-3 text-xs text-muted-foreground">
              {t("extractionReview.noBlocks")}
            </p>
          ) : (
            blocks.map(({ block, lines }) => (
              <BlockRow
                key={block.id}
                block={block}
                lines={lines}
                isExpanded={expandedBlocks.has(block.id)}
                onToggle={() => onToggleBlock(block.id)}
                t={t}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnostics tab
// ---------------------------------------------------------------------------

function DiagnosticsTab({ extractedFiles, t }: { extractedFiles: ExtractedFileData[]; t: any }) {
  const [visibleBlockStatuses, setVisibleBlockStatuses] = useState<Set<ValidationInfo["status"]>>(
    () => new Set(["trusted", "review", "failed"])
  );
  const fileDiagnostics = extractedFiles.map((entry) => buildFileDiagnostics(entry));
  const filteredDiagnostics = fileDiagnostics
    .map((item) => ({
      ...item,
      visibleBlocks: item.diagnosticBlocks.filter(({ validation }) =>
        visibleBlockStatuses.has(validation?.status ?? "review")
      ),
    }))
    .filter((item) => item.visibleBlocks.length > 0 || item.file.parse_error);
  const totals = fileDiagnostics.reduce(
    (acc, item) => {
      acc.files += 1;
      acc.blocks += item.blockCount;
      acc.lines += item.lineCount;
      acc.trustedBlocks += item.blockStatusCounts.trusted;
      acc.reviewBlocks += item.blockStatusCounts.review;
      acc.failedBlocks += item.blockStatusCounts.failed;
      acc.trustedLines += item.lineStatusCounts.trusted;
      acc.reviewLines += item.lineStatusCounts.review;
      acc.failedLines += item.lineStatusCounts.failed;
      if (item.fileStatus === "trusted") acc.trustedFiles += 1;
      else if (item.fileStatus === "review") acc.reviewFiles += 1;
      else if (item.fileStatus === "failed") acc.failedFiles += 1;
      return acc;
    },
    {
      files: 0,
      blocks: 0,
      lines: 0,
      trustedFiles: 0,
      reviewFiles: 0,
      failedFiles: 0,
      trustedBlocks: 0,
      reviewBlocks: 0,
      failedBlocks: 0,
      trustedLines: 0,
      reviewLines: 0,
      failedLines: 0,
    }
  );

  const toggleStatus = (status: ValidationInfo["status"]) => {
    setVisibleBlockStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <DiagnosticMetric
          label={t("extractionReview.diagnostics.files")}
          value={`${totals.trustedFiles}/${totals.reviewFiles}/${totals.failedFiles}`}
          hint={t("extractionReview.diagnostics.trustedReviewFailed")}
        />
        <DiagnosticMetric
          label={t("extractionReview.diagnostics.blocks")}
          value={`${totals.trustedBlocks}/${totals.reviewBlocks}/${totals.failedBlocks}`}
          hint={t("extractionReview.diagnostics.trustedReviewFailed")}
        />
        <DiagnosticMetric
          label={t("extractionReview.diagnostics.lines")}
          value={`${totals.trustedLines}/${totals.reviewLines}/${totals.failedLines}`}
          hint={t("extractionReview.diagnostics.trustedReviewFailed")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          {t("extractionReview.diagnostics.filterBlocks")}
        </span>
        {(["trusted", "review", "failed"] as const).map((status) => {
          const isActive = visibleBlockStatuses.has(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                isActive
                  ? statusClass(status)
                  : "border-muted bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {t(`extractionReview.validation.status.${status}`)}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border divide-y">
        {filteredDiagnostics.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {t("extractionReview.diagnostics.noBlocksForFilter")}
          </div>
        ) : (
          filteredDiagnostics.map((item) => (
            <FileDiagnosticsRow key={item.file.id} item={item} t={t} />
          ))
        )}
      </div>
    </div>
  );
}

function DiagnosticMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function buildFileDiagnostics({ file, blocks }: ExtractedFileData) {
  const firstMeta = (blocks[0]?.block.metadata ?? {}) as Record<string, unknown>;
  const fileValidation = metadataValidation(firstMeta, "file_validation");
  const fileParserWarnings = metadataWarnings(firstMeta, "file_parser_quality");
  const fileParserStatus = metadataString(firstMeta, "file_parser_status");
  const tokenCoverageValue = firstMeta.file_validation;
  const tokenCoverage =
    tokenCoverageValue && typeof tokenCoverageValue === "object"
      ? ((tokenCoverageValue as Record<string, unknown>).tokenCoverage as
          | Record<string, unknown>
          | undefined)
      : undefined;

  const blockStatusCounts = { trusted: 0, review: 0, failed: 0 };
  const lineStatusCounts = { trusted: 0, review: 0, failed: 0 };
  const diagnosticBlocks: Array<{
    block: WddMatcherBlock;
    validation: ValidationInfo | null;
    parserWarnings: string[];
    lines: WddMatcherLine[];
  }> = [];
  const problemBlocks: Array<{
    block: WddMatcherBlock;
    validation: ValidationInfo | null;
    parserWarnings: string[];
    lines: WddMatcherLine[];
  }> = [];
  const problemLines: Array<{
    block: WddMatcherBlock;
    line: WddMatcherLine;
    validation: ValidationInfo | null;
    warnings: string[];
  }> = [];

  for (const { block, lines } of blocks) {
    const meta = block.metadata as Record<string, unknown>;
    const validation = metadataValidation(meta, "block_validation");
    const blockStatus = validation?.status ?? "review";
    blockStatusCounts[blockStatus] += 1;
    const parserWarnings = metadataWarnings(meta, "parser_quality");
    diagnosticBlocks.push({ block, validation, parserWarnings, lines });

    if (validation?.status !== "trusted" || parserWarnings.length > 0 || block.is_excluded) {
      problemBlocks.push({ block, validation, parserWarnings, lines });
    }

    for (const line of lines) {
      const lineMeta = line.metadata as Record<string, unknown>;
      const lineValidation = metadataValidation(lineMeta, "line_validation");
      const lineStatus = lineValidation?.status ?? "review";
      lineStatusCounts[lineStatus] += 1;
      const warnings = Array.isArray(lineMeta.warnings)
        ? lineMeta.warnings.filter((warning): warning is string => typeof warning === "string")
        : [];
      if (lineValidation?.status !== "trusted" || warnings.length > 0) {
        problemLines.push({ block, line, validation: lineValidation, warnings });
      }
    }
  }

  const fileStatus =
    file.parse_error || fileValidation?.status === "failed"
      ? "failed"
      : (fileValidation?.status ??
        (problemBlocks.length > 0 || problemLines.length > 0 ? "review" : "trusted"));

  return {
    file,
    blockCount: blocks.length,
    lineCount: blocks.reduce((sum, block) => sum + block.lines.length, 0),
    fileStatus,
    fileValidation,
    fileParserStatus,
    fileParserWarnings,
    tokenCoverage,
    blockStatusCounts,
    lineStatusCounts,
    diagnosticBlocks,
    problemBlocks,
    problemLines,
  };
}

function FileDiagnosticsRow({
  item,
  t,
}: {
  item: ReturnType<typeof buildFileDiagnostics> & {
    visibleBlocks?: ReturnType<typeof buildFileDiagnostics>["diagnosticBlocks"];
  };
  t: any;
}) {
  const coverageRatio =
    typeof item.tokenCoverage?.coverageRatio === "number"
      ? `${Math.round(item.tokenCoverage.coverageRatio * 1000) / 10}%`
      : "—";
  const unassigned =
    typeof item.tokenCoverage?.unassignedTokens === "number"
      ? item.tokenCoverage.unassignedTokens
      : null;

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.file.file_name}</div>
          <div className="text-xs text-muted-foreground">
            {item.blockCount} {t("extractionReview.diagnostics.blocksShort")} · {item.lineCount}{" "}
            {t("extractionReview.positions")} · {t("extractionReview.diagnostics.coverage")}{" "}
            {coverageRatio}
            {unassigned != null && unassigned > 0
              ? ` · ${unassigned} ${t("extractionReview.diagnostics.unassignedTokens")}`
              : ""}
          </div>
        </div>
        <StatusPill
          status={item.fileStatus}
          confidence={item.fileValidation?.confidenceScore}
          t={t}
        />
      </div>

      {item.file.parse_error && (
        <DiagnosticProblem
          tone="failed"
          title={t("extractionReview.diagnostics.parseError")}
          details={[item.file.parse_error]}
        />
      )}

      {(item.fileValidation?.reasons.length || item.fileParserWarnings.length) && (
        <DiagnosticProblem
          tone={item.fileStatus}
          title={t("extractionReview.diagnostics.fileProblems")}
          details={[...(item.fileValidation?.reasons ?? []), ...item.fileParserWarnings]}
        />
      )}

      {(item.visibleBlocks ?? item.problemBlocks).length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("extractionReview.diagnostics.blocksPreview")}
          </div>
          {(item.visibleBlocks ?? item.problemBlocks)
            .slice(0, 12)
            .map(({ block, validation, parserWarnings, lines }) => {
              const meta = block.metadata as Record<string, unknown>;
              const id =
                metadataString(meta, "wdd_number") ??
                metadataString(meta, "zw_number") ??
                block.block_header_text ??
                `#${block.block_index}`;
              return (
                <div key={block.id} className="rounded-md border bg-muted/10 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{id}</span>
                    <span className="text-muted-foreground">{block.block_type}</span>
                    <span className="text-muted-foreground">
                      {lines.length} {t("extractionReview.positions")}
                    </span>
                    <StatusPill
                      status={validation?.status ?? "unknown"}
                      confidence={validation?.confidenceScore}
                      t={t}
                    />
                  </div>
                  <ReasonList reasons={[...(validation?.reasons ?? []), ...parserWarnings]} />
                </div>
              );
            })}
          {(item.visibleBlocks ?? item.problemBlocks).length > 12 && (
            <p className="text-xs text-muted-foreground">
              +{(item.visibleBlocks ?? item.problemBlocks).length - 12}{" "}
              {t("extractionReview.diagnostics.moreProblems")}
            </p>
          )}
        </div>
      )}

      {item.problemLines.filter(({ block }) =>
        (item.visibleBlocks ?? item.problemBlocks).some(
          ({ block: visibleBlock }) => visibleBlock.id === block.id
        )
      ).length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("extractionReview.diagnostics.lineProblems")}
          </div>
          {item.problemLines
            .filter(({ block }) =>
              (item.visibleBlocks ?? item.problemBlocks).some(
                ({ block: visibleBlock }) => visibleBlock.id === block.id
              )
            )
            .slice(0, 8)
            .map(({ block, line, validation, warnings }) => (
              <div key={line.id} className="rounded-md border bg-muted/10 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{line.product_code ?? "—"}</span>
                  <span className="text-muted-foreground">#{line.line_number}</span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {line.product_name ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {metadataString(block.metadata as Record<string, unknown>, "zw_number") ??
                      metadataString(block.metadata as Record<string, unknown>, "wdd_number") ??
                      block.block_type}
                  </span>
                  <StatusPill
                    status={validation?.status ?? "unknown"}
                    confidence={validation?.confidenceScore}
                    t={t}
                  />
                </div>
                <ReasonList reasons={[...(validation?.reasons ?? []), ...warnings]} />
              </div>
            ))}
          {item.problemLines.filter(({ block }) =>
            (item.visibleBlocks ?? item.problemBlocks).some(
              ({ block: visibleBlock }) => visibleBlock.id === block.id
            )
          ).length > 8 && (
            <p className="text-xs text-muted-foreground">
              +
              {item.problemLines.filter(({ block }) =>
                (item.visibleBlocks ?? item.problemBlocks).some(
                  ({ block: visibleBlock }) => visibleBlock.id === block.id
                )
              ).length - 8}{" "}
              {t("extractionReview.diagnostics.moreProblems")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DiagnosticProblem({
  tone,
  title,
  details,
}: {
  tone: ValidationInfo["status"] | "unknown";
  title: string;
  details: string[];
}) {
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${statusClass(tone)}`}>
      <div className="font-medium">{title}</div>
      <ReasonList reasons={details} />
    </div>
  );
}

function ReasonList({ reasons }: { reasons: string[] }) {
  const unique = [...new Set(reasons)].filter(Boolean);
  if (!unique.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {unique.map((reason) => (
        <span
          key={reason}
          className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {reason}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block row
// ---------------------------------------------------------------------------

interface BlockRowProps {
  block: WddMatcherBlock;
  lines: WddMatcherLine[];
  isExpanded: boolean;
  onToggle: () => void;

  t: any;
}

function BlockRow({ block, lines, isExpanded, onToggle, t }: BlockRowProps) {
  const blockTypeCls: Record<string, string> = {
    wdd_reconciliation: "bg-blue-50 text-blue-700",
    direct_order: "bg-slate-100 text-slate-500",
    brand_order: "bg-violet-50 text-violet-700",
    wdd_source: "bg-emerald-50 text-emerald-700",
  };

  const meta = block.metadata as Record<string, unknown>;
  const wddNumber = metadataString(meta, "wdd_number");
  const zwNumber = metadataString(meta, "zw_number");
  const zlNumber = metadataString(meta, "zl_number");
  const orderNumber = metadataString(meta, "order_number");
  const vin = metadataString(meta, "vin");
  const clientName = metadataString(meta, "client_name");
  const groupName = metadataString(meta, "group_name");
  const groupSourceLabel = metadataString(meta, "group_source_label");
  const shipmentCode = metadataString(meta, "shipment_code");
  const warehouseCode = metadataString(meta, "warehouse_code") ?? block.warehouse_section;
  const primaryId = wddNumber ?? zwNumber ?? orderNumber ?? block.block_header_text;
  const compactGroup = groupSourceLabel
    ? shipmentCode
      ? `${groupSourceLabel} · ${shipmentCode}`
      : groupSourceLabel
    : groupName;

  return (
    <div>
      {/* Block header */}
      <button
        onClick={block.is_excluded ? undefined : onToggle}
        disabled={block.is_excluded}
        className={`w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-left transition-colors
          ${block.is_excluded ? "opacity-50 cursor-default" : "hover:bg-muted/20"}`}
      >
        {block.is_excluded ? (
          <MinusCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        <span
          className={`shrink-0 text-[10px] rounded px-1.5 py-0.5 font-medium ${blockTypeCls[block.block_type] ?? "bg-muted text-muted-foreground"}`}
        >
          {block.block_type.replace(/_/g, " ")}
        </span>

        {primaryId && (
          <span className="font-mono text-xs text-foreground shrink-0">{primaryId}</span>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-4">
          {zlNumber && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{zlNumber}</span>
          )}
          {orderNumber && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{orderNumber}</span>
          )}
          {warehouseCode && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("extractionReview.headerFields.whShort")} {warehouseCode}
            </span>
          )}
          {compactGroup && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{compactGroup}</span>
          )}
        </div>

        {block.is_excluded ? (
          <span className="shrink-0 text-[10px] text-muted-foreground italic">
            {t("extractionReview.excludedLabel")}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            {lines.length} {t("extractionReview.positions")}
          </span>
        )}
      </button>

      {/* Lines table */}
      {!block.is_excluded && isExpanded && (
        <div className="pl-10 pr-4 pb-3">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 rounded-md border bg-muted/10 px-3 py-2">
            <HeaderDatum label="VIN" value={vin} />
            <HeaderDatum label={t("extractionReview.headerFields.client")} value={clientName} />
            <HeaderDatum
              label={t("extractionReview.headerFields.groupShort")}
              value={compactGroup}
            />
          </div>
          <div className="rounded-md border overflow-x-auto">
            {lines.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                {t("extractionReview.noLines")}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right w-10">#</th>
                    <th className="px-3 py-2 text-left">{t("extractionReview.columns.code")}</th>
                    <th className="px-3 py-2 text-left">{t("extractionReview.columns.name")}</th>
                    <th className="px-3 py-2 text-right">{t("extractionReview.columns.qty")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line) => (
                    <LineTableRow key={line.id} line={line} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line table row
// ---------------------------------------------------------------------------

function LineTableRow({ line }: { line: WddMatcherLine }) {
  return (
    <tr className="hover:bg-muted/10">
      <td className="px-3 py-1.5 text-right text-muted-foreground">{line.line_number}</td>
      <td className="px-3 py-1.5 font-mono">{line.product_code ?? "—"}</td>
      <td className="px-3 py-1.5 text-muted-foreground max-w-[260px] truncate">
        {line.product_name ?? "—"}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        {line.quantity != null ? line.quantity.toLocaleString("pl-PL") : "—"}
      </td>
    </tr>
  );
}
