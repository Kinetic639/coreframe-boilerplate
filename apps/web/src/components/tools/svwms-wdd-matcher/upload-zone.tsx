"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadCloud, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadZoneProps {
  onProcess: (files: File[]) => void;
  isProcessing: boolean;
}

export function UploadZone({ onProcess, isProcessing }: UploadZoneProps) {
  const t = useTranslations("modules.tools.wddMatcher");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === "application/pdf");
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files ?? []));
      // Reset input so the same file can be re-added after removal
      if (inputRef.current) inputRef.current.value = "";
    },
    [addFiles]
  );

  const removeFile = useCallback((name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleProcess = () => {
    if (files.length > 0) onProcess(files);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          p-12 cursor-pointer transition-colors select-none
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"}
        `}
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">{t("uploadZone.title")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("uploadZone.subtitle")}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="rounded-lg border divide-y">
          {files.map((file) => (
            <div key={file.name} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.name);
                }}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Process button */}
      <Button
        className="w-full"
        disabled={files.length === 0 || isProcessing}
        onClick={handleProcess}
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("uploadZone.processing")}
          </>
        ) : (
          t("uploadZone.process", { count: files.length })
        )}
      </Button>
    </div>
  );
}
