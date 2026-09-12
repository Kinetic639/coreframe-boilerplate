"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, FileText } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { RepairOrderProvenanceDocument } from "@/server/services/repair-orders.service";

type Props = {
  documents: RepairOrderProvenanceDocument[];
  loadError?: boolean;
};

/**
 * Phase 9: the "Source documents" provenance-inspection section --
 * explicitly distinct from Phase 8's logical-line list above it. Answers
 * "where did this RepairOrder come from?" -- which source document(s)
 * contributed, and (once a document is expanded) which source line(s) each
 * one carried and how much each contributed to a logical line.
 *
 * A plain client component (needs local expand/collapse state per
 * document) -- but deliberately NOT the final Phase 11 Magazyn/
 * Zamówienia-Przyjęcia sub-view system; a compact, reusable
 * provenance-inspection surface only, per this phase's explicit scope
 * boundary. `import type` only from `repair-orders.service.ts` (erased at
 * compile time, never bundles that `server-only`-guarded module's runtime
 * code into the client).
 *
 * Deliberately does NOT show Matcher session navigation -- no stable route
 * to a specific Matcher session detail view exists anywhere in this
 * codebase today (verified, not assumed, before choosing to omit it); the
 * `sourceSessionId` is not rendered as a dead/fake link.
 */
export function RepairOrderProvenance({ documents, loadError = false }: Props) {
  const t = useTranslations("modules.workshop.repairOrders.provenance");

  return (
    <div className="flex flex-col gap-3" data-testid="repair-order-provenance-section">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
      </div>

      {loadError ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm"
          data-testid="repair-order-provenance-error-state"
        >
          {t("errors.loadFailed")}
        </div>
      ) : documents.length === 0 ? (
        <div
          className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center"
          data-testid="repair-order-provenance-empty-state"
        >
          <FileText className="text-muted-foreground h-7 w-7" />
          <div>
            <p className="text-sm font-medium">{t("emptyStateTitle")}</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">{t("emptyStateSubtitle")}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((document) => (
            <DocumentRow key={document.id} document={document} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ document }: { document: RepairOrderProvenanceDocument }) {
  const t = useTranslations("modules.workshop.repairOrders.provenance");
  const [open, setOpen] = useState(false);
  // `document.lines` here only ever contains lines with >= 1 contribution
  // to THIS RepairOrder -- getRepairOrderProvenance's own cross-order
  // metadata-leak fix (2026-09-12) omits a source line entirely once it
  // has zero own-order contributions (whether never-linked, or linked only
  // to a different RepairOrder sharing this document), rather than
  // returning it with an empty contributions array. There is therefore no
  // reachable "unlinked" state left to render here.

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border rounded-lg border"
      data-testid="repair-order-provenance-document"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium">
              {document.documentType.toUpperCase()} {document.externalDocumentNumber}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("documentLinesCount", { count: document.lines.length })}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border flex flex-col gap-2 border-t px-3 py-2.5">
          {document.lines.map((line) => (
            <div
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs"
              data-testid="repair-order-provenance-source-line"
            >
              <div className="min-w-0">
                <span className="font-mono font-medium">{line.productCode ?? "—"}</span>
                <span className="text-muted-foreground ml-2 truncate">
                  {line.productName ?? "—"}
                </span>
              </div>
              <div className="text-muted-foreground shrink-0 font-mono">
                {line.quantity}
                {line.unit ? ` ${line.unit}` : ""}
                {line.contributions.length > 0 && (
                  <span className="text-foreground ml-2">
                    → {line.contributions.map((c) => c.quantityContribution).join(" + ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
