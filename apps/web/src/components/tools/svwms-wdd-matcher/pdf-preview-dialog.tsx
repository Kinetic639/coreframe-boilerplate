"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PdfBlockData } from "@/server/services/wdd-matcher.service";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: PdfBlockData[] | null;
  prebuiltBlobUrl?: string | null;
  sessionName: string;
  sessionId: string;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  blocks,
  prebuiltBlobUrl = null,
  sessionName,
  sessionId,
}: PdfPreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  // Generate blob whenever dialog opens with fresh data
  useEffect(() => {
    if (!open || !blocks) return;
    if (prebuiltBlobUrl) {
      setGenerating(false);
      setError(null);
      setBlobUrl(prebuiltBlobUrl);
      return;
    }

    let cancelled = false;
    setGenerating(true);
    setError(null);
    setBlobUrl(null);

    (async () => {
      try {
        const { generateEnhancedPdfBlob } =
          await import("@/lib/tools/svwms-wdd-matcher/enhanced-delivery-pdf");
        const blob = await generateEnhancedPdfBlob(blocks, sessionName);
        if (cancelled) return;

        // Revoke any previous URL before creating a new one
        if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
        const url = URL.createObjectURL(blob);
        prevBlobUrl.current = url;
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Błąd generowania PDF");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, blocks, prebuiltBlobUrl, sessionName]);

  // Revoke URL when dialog closes
  useEffect(() => {
    if (!open && prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
    if (!open) setBlobUrl(prebuiltBlobUrl);
  }, [open, prebuiltBlobUrl]);

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `wdd-enhanced-${sessionId}.pdf`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-4 py-3 shrink-0">
          <DialogTitle className="text-sm font-medium truncate pr-4">{sessionName}</DialogTitle>
          <div className="flex items-center gap-2 shrink-0 mr-12">
            <Button size="sm" onClick={handleDownload} disabled={!blobUrl}>
              <Download className="mr-1.5 h-4 w-4" />
              Pobierz
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/30">
          {generating && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generowanie podglądu…
            </div>
          )}
          {error && (
            <div className="flex h-full items-center justify-center text-sm text-destructive">
              {error}
            </div>
          )}
          {blobUrl && (
            <iframe src={blobUrl} className="h-full w-full border-0" title="Podgląd PDF" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
