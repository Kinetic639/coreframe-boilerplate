"use client";

import { useEffect, useRef } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface QrPdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blobUrl: string | null;
  generating: boolean;
  fileName: string;
  title: string;
}

export function QrPdfPreviewDialog({
  open,
  onOpenChange,
  blobUrl,
  generating,
  fileName,
  title,
}: QrPdfPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!open) return;
    return () => {
      if (iframeRef.current) {
        iframeRef.current.src = "about:blank";
      }
    };
  }, [open]);

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
  }

  function handlePrint() {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 p-0" hideClose>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b px-4 py-3">
          <DialogTitle className="truncate pr-4 text-sm font-medium">{title}</DialogTitle>
          <div className="mr-12 flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={!blobUrl}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={!blobUrl}>
              <Download className="mr-1.5 h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/30">
          {generating ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating preview…
            </div>
          ) : null}
          {!generating && blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              className="h-full w-full border-0"
              title="QR labels PDF preview"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
