"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Loader2, Pencil, Printer, Send, X, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import type { InventoryMovementDetail } from "@/lib/warehouse/inventory-types";
import { getMovementDetailHref, getMovementRouteKey } from "@/lib/warehouse/movement-route-key";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import { normalizeRichText } from "@/components/primitives/rich-text/rich-text-utils";
import {
  acceptInventoryBranchTransferAction,
  cancelMovementAction,
  declineInventoryBranchTransferAction,
  finalizePostingAction,
} from "@/app/actions/warehouse/inventory";

type LocationOption = { id: string; name: string; code: string | null };

type InventoryMovementDetailPanelProps = {
  detail: InventoryMovementDetail;
  activeBranchId: string | null;
  locations: LocationOption[];
  canOperate: boolean;
  showOpenPageAction?: boolean;
  showPrintAction?: boolean;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  posted: "default",
  reversed: "outline",
  cancelled: "destructive",
  in_transit: "outline",
  accepted: "default",
  declined: "destructive",
};

export function InventoryMovementDetailPanel({
  detail,
  activeBranchId,
  locations,
  canOperate,
  showOpenPageAction = true,
  showPrintAction = false,
}: InventoryMovementDetailPanelProps) {
  const t = useTranslations("warehouseInventory.movements");
  const td = useTranslations("warehouseInventory.movementDetail");
  const tt = useTranslations("warehouseInventory.transfers");
  const tc = useTranslations("warehouseInventory.common");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDraft = detail.status === "draft";
  const canRespondToTransfer = canOperate && detail.status === "in_transit";

  const STATUS_KEYS: Record<string, string> = {
    draft: "statusDraft",
    posted: "statusPosted",
    reversed: "statusReversed",
    cancelled: "statusCancelled",
    in_transit: "statusInTransit",
    accepted: "statusAccepted",
    declined: "statusDeclined",
  };
  const ACTION_KEYS: Record<string, string> = {
    created: "actionCreated",
    posted: "actionPosted",
    cancelled: "actionCancelled",
    reversed: "actionReversed",
    sent: "actionSent",
    accepted: "actionAccepted",
    declined: "actionDeclined",
    updated: "actionUpdated",
    draft_updated: "actionDraftUpdated",
    draft_saved: "actionDraftSaved",
  };
  const tStatus = (s: string) => td((STATUS_KEYS[s] ?? s) as any);
  const tAction = (a: string) => td((ACTION_KEYS[a] ?? a) as any);
  const totalQty = detail.lines.reduce((s, l) => s + l.quantity, 0);

  // Derive common locations from lines
  const allDestinations = detail.lines.map((l) => l.destination_location_name).filter(Boolean);
  const allSources = detail.lines.map((l) => l.source_location_name).filter(Boolean);
  const commonDestination =
    allDestinations.length > 0 && new Set(allDestinations).size === 1 ? allDestinations[0] : null;
  const commonSource =
    allSources.length > 0 && new Set(allSources).size === 1 ? allSources[0] : null;

  const acceptTransfer = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await acceptInventoryBranchTransferAction({
        id: String(formData.get("id") ?? ""),
        destination_location_id: String(formData.get("destination_location_id") ?? ""),
      });
      setMessage(
        result.success ? tt("accepted") : "error" in result ? result.error : tc("unexpectedError")
      );
      if (result.success) router.refresh();
    });
  };
  const declineTransfer = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await declineInventoryBranchTransferAction({
        id: String(formData.get("id") ?? ""),
        decline_reason: String(formData.get("decline_reason") ?? "") || null,
      });
      setMessage(
        result.success ? tt("declined") : "error" in result ? result.error : tc("unexpectedError")
      );
      if (result.success) router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Title + Actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {detail.document_number ?? detail.draft_number}
            </h2>
            <Badge variant={statusVariant[detail.status] ?? "outline"}>
              {tStatus(detail.status)}
            </Badge>
            {detail.document_type_code && (
              <Badge variant="outline" className="text-xs">
                {detail.document_type_code}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{detail.movement_type_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPrintAction && (
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              {t("pdfPrint")}
            </Button>
          )}
          {showOpenPageAction && (
            <Button asChild type="button" variant="outline" size="sm">
              <Link href={getMovementDetailHref(detail)}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {t("openMovement")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Draft Actions */}
      {isDraft && canOperate && (
        <div className="flex gap-2 border-b pb-3">
          <Button asChild variant="outline" size="sm">
            <Link
              href={
                `/dashboard/warehouse/inventory/movements/${getMovementRouteKey(detail)}/edit` as any
              }
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {td("editDraft")}
            </Link>
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = (await finalizePostingAction({ id: detail.id })) as any;
                if (result.success) {
                  toast.success(
                    td("documentPosted", { number: result.data?.document_number ?? "" })
                  );
                  router.refresh();
                } else {
                  toast.error(result.error ?? td("failedToPost"));
                }
              });
            }}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            {td("post")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = (await cancelMovementAction({ id: detail.id })) as any;
                if (result.success) {
                  toast.info(td("movementCancelled"));
                  router.refresh();
                } else {
                  toast.error(result.error ?? td("failedToCancel"));
                }
              });
            }}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            {td("cancel")}
          </Button>
        </div>
      )}

      {/* Document Header Info — two-column: details left, counterparty right */}
      <div className="rounded-sm border bg-muted/20 p-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          {/* Left: Document details */}
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <span className="text-muted-foreground">{td("type")}</span>
            <span className="font-medium">
              {detail.movement_type_code} · {detail.movement_type_name}
            </span>

            <span className="text-muted-foreground">{td("document")}</span>
            <span>{detail.document_type_code ?? "—"}</span>

            {detail.branch_name && (
              <>
                <span className="text-muted-foreground">{td("branch")}</span>
                <span className="font-semibold">{detail.branch_name}</span>
              </>
            )}
            {detail.created_by_name && (
              <>
                <span className="text-muted-foreground">{td("createdBy")}</span>
                <span>{detail.created_by_name}</span>
              </>
            )}

            <span className="text-muted-foreground">{td("status")}</span>
            <span>
              <Badge variant={statusVariant[detail.status] ?? "outline"} className="text-xs">
                {tStatus(detail.status)}
              </Badge>
            </span>

            {detail.document_number && (
              <>
                <span className="text-muted-foreground">{td("documentNumber")}</span>
                <span className="font-mono font-semibold">{detail.document_number}</span>
              </>
            )}
            {detail.draft_number && (
              <>
                <span className="text-muted-foreground">{td("draftNumber")}</span>
                <span className="font-mono">{detail.draft_number}</span>
              </>
            )}
            {detail.operation_date && (
              <>
                <span className="text-muted-foreground">{td("operationDate")}</span>
                <span className="font-mono">{detail.operation_date}</span>
              </>
            )}
            {detail.document_date && (
              <>
                <span className="text-muted-foreground">{td("documentDate")}</span>
                <span className="font-mono">{detail.document_date}</span>
              </>
            )}
            {detail.posted_at && (
              <>
                <span className="text-muted-foreground">{td("postedAt")}</span>
                <span className="font-mono">{new Date(detail.posted_at).toLocaleString()}</span>
              </>
            )}
            {detail.external_reference && (
              <>
                <span className="text-muted-foreground">{td("reference")}</span>
                <span>{detail.external_reference}</span>
              </>
            )}

            {commonSource && (
              <>
                <span className="text-muted-foreground">{td("sourceLocation")}</span>
                <span>{commonSource}</span>
              </>
            )}

            {commonDestination && (
              <>
                <span className="text-muted-foreground">{td("destinationLocation")}</span>
                <span>{commonDestination}</span>
              </>
            )}

            <span className="text-muted-foreground">{td("positions")}</span>
            <span>{td("positionsSummary", { count: detail.lines.length, qty: totalQty })}</span>
          </div>

          {/* Right: Counterparty / Supplier */}
          {detail.counterparty_name && (
            <div className="md:w-64 md:border-l md:pl-4">
              <div className="rounded-sm border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {td("counterparty")}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    {td("supplier")}
                  </Badge>
                </div>
                <h4 className="text-sm font-bold text-foreground">{detail.counterparty_name}</h4>
                {detail.counterparty_details && (
                  <div className="text-xs text-muted-foreground font-mono space-y-0.5 mt-2">
                    {detail.counterparty_details.nip && (
                      <p>
                        NIP:{" "}
                        <strong className="text-foreground">
                          {detail.counterparty_details.nip}
                        </strong>
                      </p>
                    )}
                    {detail.counterparty_details.street && (
                      <p>
                        {detail.counterparty_details.street}
                        {detail.counterparty_details.postalCode &&
                          `, ${detail.counterparty_details.postalCode}`}
                        {detail.counterparty_details.city && ` ${detail.counterparty_details.city}`}
                      </p>
                    )}
                    {detail.counterparty_details.phone && (
                      <p>Tel: {detail.counterparty_details.phone}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {detail.note && (
          <div className="mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground font-semibold uppercase">
              {td("note")}
            </span>
            <div className="mt-1">
              {(() => {
                try {
                  const parsed = JSON.parse(detail.note);
                  const richText = normalizeRichText(parsed);
                  if (richText) return <RichTextRenderer value={richText} />;
                } catch {
                  /* not JSON, render as plain text */
                }
                return <p className="text-sm">{detail.note}</p>;
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Compact Items Table */}
      {detail.lines.length > 0 && (
        <div className="rounded-sm border">
          <div className="px-3 py-2 border-b bg-muted/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {td("items", { count: detail.lines.length })}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/20">
              <tr className="border-b">
                <th className="px-3 py-1.5 text-center w-8">{td("colNumber")}</th>
                <th className="px-3 py-1.5 text-left">{td("colSku")}</th>
                <th className="px-3 py-1.5 text-left">{td("colProduct")}</th>
                <th className="px-3 py-1.5 text-center w-14">{td("colUnit")}</th>
                <th className="px-3 py-1.5 text-right w-16">{td("colQty")}</th>
                {!commonSource && allSources.length > 0 && (
                  <th className="px-3 py-1.5 text-left">{td("colSource")}</th>
                )}
                {!commonDestination && allDestinations.length > 0 && (
                  <th className="px-3 py-1.5 text-left">{td("colDestination")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line, idx) => (
                <tr key={line.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-1.5 text-center text-muted-foreground text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-1.5 font-mono font-medium">{line.sku}</td>
                  <td className="px-3 py-1.5">{line.product_name}</td>
                  <td className="px-3 py-1.5 text-center">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {line.unit_code}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold">
                    {line.quantity}
                  </td>
                  {!commonSource && allSources.length > 0 && (
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {line.source_location_name ?? "—"}
                    </td>
                  )}
                  {!commonDestination && allDestinations.length > 0 && (
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {line.destination_location_name ?? "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Log */}
      {detail.audit_log && detail.audit_log.length > 0 && (
        <div className="border-t pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {td("auditLog")}
          </span>
          <div className="mt-2 space-y-1">
            {detail.audit_log.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-sm bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {tAction(entry.action)}
                  </Badge>
                  {entry.actor_user_id ? (
                    <Link
                      href="/dashboard/organization/users/members"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {entry.actor_user_name}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {entry.actor_user_name ?? td("system")}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branch Transfer */}
      {canRespondToTransfer && (
        <div className="grid gap-2 border-t pt-4 md:grid-cols-2">
          <form action={acceptTransfer} className="flex gap-2">
            <input type="hidden" name="id" value={detail.id} />
            <select
              name="destination_location_id"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">{tt("receiveToLocation")}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code ? `${loc.code} - ${loc.name}` : loc.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={isPending}>
              <Check className="mr-2 h-4 w-4" />
              {tt("accept")}
            </Button>
          </form>
          <form action={declineTransfer} className="flex gap-2">
            <input type="hidden" name="id" value={detail.id} />
            <input
              name="decline_reason"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              placeholder={tc("reason")}
            />
            <Button type="submit" variant="outline" disabled={isPending}>
              <X className="mr-2 h-4 w-4" />
              {tt("decline")}
            </Button>
          </form>
        </div>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
