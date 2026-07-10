"use client";

import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";

interface CountNotesModalProps {
  open: boolean;
  itemName: string;
  note: string;
  onNoteChange: (note: string) => void;
  onClear: () => void;
  onDone: () => void;
}

export function CountNotesModal({
  open,
  itemName,
  note,
  onNoteChange,
  onClear,
  onDone,
}: CountNotesModalProps) {
  const t = useTranslations("warehouseInventory.audits.count");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 text-left shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {t("notesModalTitle")}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t("notesModalDescription")} <strong className="text-foreground">{itemName}</strong>
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("noteContentLabel")}
          </label>
          <textarea
            ref={textareaRef}
            placeholder={t("notePlaceholder")}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-muted/40 p-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary md:text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClear}
            title={t("clear")}
            className="cursor-pointer rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20"
          >
            {t("clear")}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 cursor-pointer rounded-lg bg-primary py-2.5 text-center text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
          >
            {t("done")}
          </button>
        </div>
      </div>
    </div>
  );
}
