"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { AlertCircle, Check, Copy, Download, FileText, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandLockup } from "@/components/branding";
import { UploadZone } from "./upload-zone";
import { ConfidenceBar, MatchTypeBadge, SummaryChip } from "./results-view";
import { PdfPreviewDialog } from "./pdf-preview-dialog";
import {
  runPublicWddMatcherAction,
  type PublicWddMatcherResult,
} from "@/app/actions/tools/wdd-matcher-public";

function downloadJsonFile(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PublicWddMatcher() {
  const t = useTranslations("modules.tools.wddMatcher");
  const [result, setResult] = useState<PublicWddMatcherResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const totals = useMemo(() => {
    if (!result) return { files: 0, blocks: 0, lines: 0 };
    return {
      files: result.extractedFiles.length,
      blocks: result.extractedFiles.reduce((sum, file) => sum + file.blocks.length, 0),
      lines: result.extractedFiles.reduce(
        (sum, file) =>
          sum + file.blocks.reduce((blockSum, block) => blockSum + block.lines.length, 0),
        0
      ),
    };
  }, [result]);

  const exact = result?.results.filter((entry) => entry.matchType === "exact").length ?? 0;
  const subset = result?.results.filter((entry) => entry.matchType === "subset").length ?? 0;
  const partial =
    (result?.results.filter(
      (entry) => entry.matchType === "partial" || entry.matchType === "ambiguous"
    ).length ?? 0) + subset;
  const unmatched =
    result?.results.filter((entry) => entry.matchType === "unmatched_bc").length ?? 0;

  const processFiles = useCallback(async (files: File[]) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      const response = await runPublicWddMatcherAction(formData);
      if (!response.success) {
        throw new Error((response as { success: false; error: string }).error);
      }
      setResult(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const copyJson = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const downloadJson = useCallback(() => {
    if (!result) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJsonFile(`wdd-public-results-${timestamp}.json`, JSON.stringify(result, null, 2));
  }, [result]);

  if (!result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex justify-center">
          <BrandLockup size="hero" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("public.subtitle")}</p>
        </div>
        <UploadZone onProcess={processFiles} isProcessing={isProcessing} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => setResult(null)}>
          {t("results.newUpload")}
        </Button>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 px-0" onClick={copyJson}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("extractionReview.copyJson")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={downloadJson}>
            <Download className="mr-1 h-3.5 w-3.5" />
            {t("extractionReview.downloadJson")}
          </Button>
          <Button size="sm" className="h-8 px-2.5 text-xs" onClick={() => setPreviewOpen(true)}>
            <FileText className="mr-1 h-3.5 w-3.5" />
            {t("results.exportEnhancedPdf")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="results" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="list">{t("extractionReview.tabs.list")}</TabsTrigger>
            <TabsTrigger value="results">{t("extractionReview.tabs.results")}</TabsTrigger>
            <TabsTrigger value="diagnostics">{t("extractionReview.tabs.diagnostics")}</TabsTrigger>
          </TabsList>
          <div className="text-xs text-muted-foreground">
            {t("extractionReview.summary", totals)}
          </div>
        </div>

        <TabsContent value="list" className="mt-0">
          <div className="rounded-lg border divide-y">
            {result.extractedFiles.map(({ file, blocks }) => (
              <div key={file.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">{file.file_role}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("extractionReview.fileStats", {
                      blocks: blocks.length,
                      lines: blocks.reduce((sum, block) => sum + block.lines.length, 0),
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results" className="mt-0">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-xs">
              <SummaryChip label={t("results.exactMatches")} value={exact} color="green" />
              <SummaryChip label={t("results.partialMatches")} value={partial} color="yellow" />
              <SummaryChip label={t("results.unmatched")} value={unmatched} color="red" />
              {result.summary.unmatched_brand > 0 && (
                <SummaryChip
                  label={t("results.unmatchedOrders")}
                  value={result.summary.unmatched_brand}
                  color="orange"
                />
              )}
            </div>

            {!result.results.length ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border py-20 text-muted-foreground">
                <HelpCircle className="h-8 w-8" />
                <p className="text-sm">{t("results.empty")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 text-left">{t("results.columns.wddNumber")}</th>
                      <th className="px-3 py-3 text-left">{t("results.columns.zwNumber")}</th>
                      <th className="px-3 py-3 text-left">{t("results.columns.zlNumber")}</th>
                      <th className="px-3 py-3 text-left">{t("results.columns.parts")}</th>
                      <th className="px-3 py-3 text-left">{t("results.columns.confidence")}</th>
                      <th className="px-3 py-3 text-left">{t("results.columns.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.results.map((entry, index) => (
                      <tr key={index} className="transition-colors hover:bg-muted/20">
                        <td className="px-3 py-3 font-mono text-xs">
                          {entry.wdd.wddNumber ?? "—"}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {entry.order?.zwNumber ?? "—"}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {entry.order?.zlNumber ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-center text-xs">{entry.wdd.partsCount}</td>
                        <td className="px-3 py-3">
                          {entry.matchType !== "unmatched_bc" ? (
                            <ConfidenceBar value={entry.confidence} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <MatchTypeBadge type={entry.matchType} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-0">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {t("extractionReview.diagnostics.files")}
              </p>
              <p className="mt-1 text-2xl font-semibold">{totals.files}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {t("extractionReview.diagnostics.blocks")}
              </p>
              <p className="mt-1 text-2xl font-semibold">{totals.blocks}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {t("extractionReview.diagnostics.lines")}
              </p>
              <p className="mt-1 text-2xl font-semibold">{totals.lines}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {t("public.diagnosticsNote")}
          </div>
        </TabsContent>
      </Tabs>

      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        blocks={result.pdfBlocks}
        sessionName={result.sessionName}
        sessionId="public"
      />
    </div>
  );
}
