"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Loader2, Pencil, Printer, Send, X, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import type { InventoryMovementDetail } from "@/lib/warehouse/inventory-types";
import {
  acceptInventoryBranchTransferAction,
  cancelMovementAction,
  declineInventoryBranchTransferAction,
  finalizePostingAction,
} from "@/app/actions/warehouse/inventory";

type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

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

function formatLocation(location: LocationOption) {
  return location.code ? `${location.code} - ${location.name}` : location.name;
}

export function InventoryMovementDetailPanel({
  detail,
  activeBranchId,
  locations,
  canOperate,
  showOpenPageAction = true,
  showPrintAction = false,
}: InventoryMovementDetailPanelProps) {
  const t = useTranslations("warehouseInventory.movements");
  const tt = useTranslations("warehouseInventory.transfers");
  const tc = useTranslations("warehouseInventory.common");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canRespondToTransfer = canOperate && detail.status === "in_transit";
  const isDraft = detail.status === "draft";

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {detail.document_number ?? detail.draft_number}
            </h2>
            <Badge variant={statusVariant[detail.status] ?? "outline"}>{detail.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.movement_type_name}
            {detail.external_reference ? ` · ${detail.external_reference}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPrintAction ? (
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              {t("pdfPrint")}
            </Button>
          ) : null}
          {showOpenPageAction ? (
            <Button asChild type="button" variant="outline">
              <Link
                href={{
                  pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
                  params: { movementId: detail.id },
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("openMovement")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        {/* Draft actions: Edit / Post / Cancel */}
        {isDraft && canOperate && (
          <div className="flex gap-2 border-b pb-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/warehouse/inventory/movements/${detail.id}/edit` as any}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit Draft
              </Link>
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = (await finalizePostingAction({ id: detail.id })) as any;
                  if (result.success) {
                    toast.success(`Document ${result.data?.document_number ?? ""} posted.`);
                    router.refresh();
                  } else {
                    toast.error(result.error ?? "Failed to post");
                  }
                });
              }}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Post Movement
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = (await cancelMovementAction({ id: detail.id })) as any;
                  if (result.success) {
                    toast.info("Movement cancelled.");
                    router.refresh();
                  } else {
                    toast.error(result.error ?? "Failed to cancel");
                  }
                });
              }}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-3.5 w-3.5" />
              )}
              Cancel
            </Button>
          </div>
        )}

        {/* Header info */}
        {detail.note ? <p className="text-sm">{detail.note}</p> : null}
        {(detail.counterparty_name || detail.operation_date || detail.document_date) && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {detail.counterparty_name && (
              <span>
                Counterparty:{" "}
                <strong className="text-foreground">{detail.counterparty_name}</strong>
              </span>
            )}
            {detail.operation_date && <span>Operation: {detail.operation_date}</span>}
            {detail.document_date && <span>Document: {detail.document_date}</span>}
          </div>
        )}

        {/* Lines */}
        <div className="space-y-2">
          {detail.lines.map((line) => (
            <div key={line.id} className="rounded-md border p-2 text-sm">
              <div className="font-medium">
                {line.sku} - {line.product_name}
              </div>
              <div className="text-muted-foreground">
                {line.quantity} {line.unit_code}
                {line.source_location_name
                  ? ` ${t("from", { location: line.source_location_name })}`
                  : ""}
                {line.destination_location_name
                  ? ` ${t("to", { location: line.destination_location_name })}`
                  : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Audit log */}
        {detail.audit_log && detail.audit_log.length > 0 && (
          <div className="border-t pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Audit Log
            </p>
            <div className="space-y-1">
              {detail.audit_log.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded bg-muted/40 px-2 py-1.5 text-xs"
                >
                  <span>
                    <Badge variant="outline" className="mr-2 text-[10px]">
                      {entry.action}
                    </Badge>
                    {entry.old_status && entry.new_status
                      ? `${entry.old_status} → ${entry.new_status}`
                      : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.actor_user_name ?? "system"} ·{" "}
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {canRespondToTransfer ? (
          <div className="grid gap-2 border-t pt-4 md:grid-cols-2">
            <form action={acceptTransfer} className="flex gap-2">
              <input type="hidden" name="id" value={detail.id} />
              <select
                name="destination_location_id"
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">{tt("receiveToLocation")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {formatLocation(location)}
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
        ) : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
