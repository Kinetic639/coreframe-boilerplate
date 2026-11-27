"use client";

import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Over a list while rows are ticked: how many, the export of them as CSV, the
 * list's own actions on all of them (`children`), and unticking them.
 */
export function ListBulkBar({
  count,
  onExport,
  onClear,
  children,
  labels = {},
}: {
  count: number;
  onExport?: () => void;
  onClear: () => void;
  /** The list's own actions (e.g. archive), after the export. */
  children?: ReactNode;
  /** bulkActions, bulkSelected, bulkExport, bulkClear (the shared wording by default). */
  labels?: Record<string, string | undefined>;
}) {
  const t = useTranslations("dataTable.bulk");
  return (
    <div
      role="toolbar"
      aria-label={labels.bulkActions ?? t("actions")}
      className="flex h-10 shrink-0 items-center gap-2 border-b bg-primary/5 px-3 text-xs"
    >
      <strong className="font-medium tabular-nums">
        {labels.bulkSelected ?? t("selected")}: {count}
      </strong>
      {onExport ? (
        <Button size="sm" variant="outline" className="h-7" onClick={onExport}>
          <Download className="mr-1.5 size-3.5" />
          {labels.bulkExport ?? t("export")}
        </Button>
      ) : null}
      {children}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
        {labels.bulkClear ?? t("clear")}
      </button>
    </div>
  );
}
