"use client";

import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * Phase 9: the smallest useful line-level provenance affordance -- a
 * "Sources (N)" trigger on a Phase 8 line row, opening a small popover that
 * lists exactly which source line(s) contributed to THIS logical line and
 * how much each one contributed. Deliberately does NOT duplicate the whole
 * "Source documents" section (`repair-order-provenance.tsx`) inside every
 * row -- just enough to answer "which source line contributed to this
 * line, and how much?" without leaving the line list.
 *
 * Takes plain, already-resolved, server-computed data (never imports
 * anything from `repair-orders.service.ts` itself, type or value -- that
 * file is `import "server-only"`-guarded; a client component may safely
 * `import type` from it, but this component avoids even that coupling by
 * accepting a small local prop shape instead, computed by the server
 * component that renders it).
 */
export interface LineSourceEntry {
  documentType: string;
  externalDocumentNumber: string;
  sourceLineProductCode: string | null;
  sourceLineProductName: string | null;
  quantityContribution: number;
}

type Props = {
  sources: LineSourceEntry[];
};

export function LineSourcesPopover({ sources }: Props) {
  const t = useTranslations("modules.workshop.repairOrders.lines");

  if (sources.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-2"
          data-testid="repair-order-line-sources-trigger"
        >
          <Layers className="h-3 w-3" />
          {t("sourcesButton", { count: sources.length })}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72"
        align="start"
        data-testid="repair-order-line-sources-popover"
      >
        <p className="mb-2 text-xs font-medium">{t("sourcesPopoverTitle")}</p>
        <ul className="flex flex-col gap-2">
          {sources.map((source, i) => (
            <li key={i} className="border-border border-t pt-2 text-xs first:border-t-0 first:pt-0">
              <div className="font-mono font-medium">
                {source.documentType.toUpperCase()} {source.externalDocumentNumber}
              </div>
              <div className="text-muted-foreground flex items-center justify-between gap-2">
                <span className="truncate">
                  {source.sourceLineProductCode ?? "—"}
                  {source.sourceLineProductName ? ` · ${source.sourceLineProductName}` : ""}
                </span>
                <span className="text-foreground shrink-0 font-mono">
                  {source.quantityContribution}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
