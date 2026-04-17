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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/server/services/wdd-matcher.service";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExtractionReviewViewProps {
  sessionId: string;
  onMatchingComplete: (session: WddMatcherSession) => void;
  onBack: () => void;
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
    const payload = extractedFiles.map(({ file, blocks }) => ({
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
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [extractedFiles]);

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

  const headerShort = block.block_header_text
    ? block.block_header_text.length > 60
      ? block.block_header_text.slice(0, 60) + "…"
      : block.block_header_text
    : "—";

  const meta = block.metadata as Record<string, unknown>;
  const identifier =
    (meta?.wdd_number as string) ??
    (meta?.zw_number as string) ??
    (meta?.order_number as string) ??
    null;

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

        {identifier && (
          <span className="font-mono text-xs text-muted-foreground shrink-0">{identifier}</span>
        )}

        <span className="flex-1 text-xs text-muted-foreground truncate">{headerShort}</span>

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
