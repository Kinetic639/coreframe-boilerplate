"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Send, X } from "lucide-react";
import {
  acceptInventoryBranchTransferAction,
  createInventoryBranchTransferAction,
  declineInventoryBranchTransferAction,
} from "@/app/actions/warehouse/inventory";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InventoryBranchTransferListRow,
  InventoryVariantOption,
} from "@/lib/warehouse/inventory-types";

type BranchOption = {
  id: string;
  name: string;
};

type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type BranchTransfersClientProps = {
  activeBranchId: string;
  branches: BranchOption[];
  locations: LocationOption[];
  variants: InventoryVariantOption[];
  transfers: InventoryBranchTransferListRow[];
  canOperate: boolean;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_transit: "outline",
  accepted: "default",
  declined: "destructive",
};

export function BranchTransfersClient({
  activeBranchId,
  branches,
  locations,
  variants,
  transfers,
  canOperate,
}: BranchTransfersClientProps) {
  const t = useTranslations("warehouseInventory.transfers");
  const tc = useTranslations("warehouseInventory.common");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [isPending, startTransition] = useTransition();
  const destinationBranches = branches.filter((branch) => branch.id !== activeBranchId);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);

  const submitTransfer = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await createInventoryBranchTransferAction({
        destination_branch_id: String(formData.get("destination_branch_id") ?? ""),
        notes: String(formData.get("notes") ?? "") || null,
        lines: [
          {
            variant_id: String(formData.get("variant_id") ?? ""),
            source_location_id: String(formData.get("source_location_id") ?? ""),
            unit_id: String(formData.get("unit_id") ?? ""),
            quantity: Number(formData.get("quantity") ?? 0),
          },
        ],
      });
      setMessage(
        result.success ? t("sent") : "error" in result ? result.error : tc("unexpectedError")
      );
      if (result.success) router.refresh();
    });
  };

  const acceptTransfer = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await acceptInventoryBranchTransferAction({
        id: String(formData.get("id") ?? ""),
        destination_location_id: String(formData.get("destination_location_id") ?? ""),
      });
      setMessage(
        result.success ? t("accepted") : "error" in result ? result.error : tc("unexpectedError")
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
        result.success ? t("declined") : "error" in result ? result.error : tc("unexpectedError")
      );
      if (result.success) router.refresh();
    });
  };

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[420px_1fr]">
      {canOperate ? (
        <form action={submitTransfer} className="grid content-start gap-3 rounded-md border p-4">
          <div>
            <h2 className="font-semibold">{t("sendTransfer")}</h2>
            <p className="text-sm text-muted-foreground">{t("sendTransferHelp")}</p>
          </div>
          <select
            name="destination_branch_id"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            <option value="">{t("destinationBranch")}</option>
            {destinationBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <select
            name="variant_id"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            required
          >
            <option value="">{tc("variants")}</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="unit_id" value={selectedVariant?.unit_id ?? ""} />
          <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            {selectedVariant
              ? t("unitSelected", { unit: selectedVariant.unit_code || t("unitBase") })
              : t("unitFollowsVariant")}
          </div>
          <select
            name="source_location_id"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            <option value="">{t("sourceLocation")}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code ? `${location.code} - ${location.name}` : location.name}
              </option>
            ))}
          </select>
          <Input
            name="quantity"
            type="number"
            min="0.000001"
            step="0.000001"
            placeholder={tc("quantity")}
          />
          <Input name="notes" placeholder={tc("notes")} />
          <Button type="submit" disabled={isPending}>
            <Send className="mr-2 h-4 w-4" />
            {t("sendTransfer")}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </form>
      ) : null}

      <div className="grid content-start gap-3">
        {transfers.map((transfer) => {
          const isDestination = transfer.destination_branch_id === activeBranchId;
          const canResolve = canOperate && isDestination && transfer.status === "in_transit";

          return (
            <div key={transfer.id} className="grid gap-3 rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{transfer.transfer_number}</h2>
                    <Badge variant={statusVariant[transfer.status] ?? "outline"}>
                      {transfer.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("route", {
                      source: transfer.source_branch_name,
                      destination: transfer.destination_branch_name,
                    })}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {tc("linesCount", { count: transfer.line_count })}
                </p>
              </div>

              {transfer.notes ? <p className="text-sm">{transfer.notes}</p> : null}
              {transfer.decline_reason ? (
                <p className="text-sm text-destructive">{transfer.decline_reason}</p>
              ) : null}

              {canResolve ? (
                <div className="grid gap-2 border-t pt-3 md:grid-cols-2">
                  <form action={acceptTransfer} className="flex gap-2">
                    <input type="hidden" name="id" value={transfer.id} />
                    <select
                      name="destination_location_id"
                      className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                      required
                    >
                      <option value="">{t("receiveToLocation")}</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code ? `${location.code} - ${location.name}` : location.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" disabled={isPending}>
                      <Check className="mr-2 h-4 w-4" />
                      {t("accept")}
                    </Button>
                  </form>
                  <form action={declineTransfer} className="flex gap-2">
                    <input type="hidden" name="id" value={transfer.id} />
                    <Input name="decline_reason" placeholder={tc("reason")} />
                    <Button type="submit" variant="outline" disabled={isPending}>
                      <X className="mr-2 h-4 w-4" />
                      {t("decline")}
                    </Button>
                  </form>
                </div>
              ) : null}
            </div>
          );
        })}
        {transfers.length === 0 ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">{t("empty")}</div>
        ) : null}
      </div>
    </div>
  );
}
