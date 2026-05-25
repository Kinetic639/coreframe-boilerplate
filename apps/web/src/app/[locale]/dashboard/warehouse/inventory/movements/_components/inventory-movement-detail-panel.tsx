"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Printer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/navigation";
import type { InventoryMovementDetail } from "@/lib/warehouse/inventory-types";
import {
  acceptInventoryBranchTransferAction,
  declineInventoryBranchTransferAction,
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
  const relatedDocuments = detail.related_documents ?? [];
  const canRespondToTransfer =
    detail.operation_type === "branch_transfer" &&
    canOperate &&
    detail.destination_branch_id === activeBranchId &&
    detail.status === "in_transit";

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
            <h2 className="text-lg font-semibold">{detail.movement_number}</h2>
            <Badge variant={statusVariant[detail.status] ?? "outline"}>{detail.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.movement_kind === "branch_transfer"
              ? t("branchTransfer")
              : detail.adjustment_direction
                ? `${detail.movement_kind} / ${detail.adjustment_direction}`
                : detail.movement_kind}
            {detail.reference ? ` · ${detail.reference}` : ""}
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="documents">
            {t("relatedDocuments")} ({relatedDocuments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {detail.note ? <p className="text-sm">{detail.note}</p> : null}
          {detail.decline_reason ? (
            <p className="text-sm text-destructive">{detail.decline_reason}</p>
          ) : null}
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
        </TabsContent>

        <TabsContent value="documents" className="space-y-2">
          {relatedDocuments.length ? (
            relatedDocuments.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{document.movement_number}</div>
                  <div className="text-muted-foreground">
                    {t(document.document_role)} · {document.movement_kind}
                  </div>
                </div>
                <div className="text-right text-muted-foreground">
                  <Badge variant={statusVariant[document.status] ?? "outline"}>
                    {document.status}
                  </Badge>
                  <div>
                    {document.posted_at ? new Date(document.posted_at).toLocaleString() : ""}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              {t("noRelatedDocuments")}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
