"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Loader2, Send } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shipInternalOrderAction } from "@/app/actions/warehouse/internal-orders";

export type ShipBranch = { id: string; name: string; externalCodes: string[] };

/** The branch a ZW goes to by its codes: the note code (WYSOG) or the client's unit (3642). */
export function destinationBranchOf(
  order: { destinationCode: string | null; clientName: string | null },
  branches: ShipBranch[]
) {
  const code = order.destinationCode?.toUpperCase() ?? null;
  const unit = order.clientName?.match(/^\s*(\d{3,6})\b/)?.[1] ?? null;
  return (
    branches.find((b) => code && b.externalCodes.includes(code)) ??
    branches.find((b) => unit && b.externalCodes.includes(unit)) ??
    null
  );
}

/**
 * "Wyślij na oddział": the ZW's reserved parts go onto ONE MMJ- to the branch
 * found by its code (or the one picked here). As in AutoStacja: "Tak —
 * wyślij w drogę" sends it (both sides see it "w drodze" until the receiver
 * accepts), "Nie — wstrzymaj" keeps it as a draft. The parts stay reserved
 * at the sender until the receiver accepts.
 */
export function ShipInternalOrderDialog({
  order,
  branches,
  onClose,
}: {
  order: { id: string; number: string; destinationCode: string | null; clientName: string | null };
  branches: ShipBranch[];
  onClose: () => void;
}) {
  const t = useTranslations("modules.warehouse.internalOrders.actions");
  const tErr = useTranslations("modules.warehouse.internalOrders.errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const found = destinationBranchOf(order, branches);
  const [branchId, setBranchId] = useState(found?.id ?? "");

  const ship = (send: boolean) =>
    startTransition(async () => {
      const result = await shipInternalOrderAction({
        internalOrderId: order.id,
        destinationBranchId: branchId || null,
        send,
      });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
        return;
      }
      const data = (result as { data: { transferNumber: string; branchName: string } }).data;
      toast.success(
        send ? t("shipped", { branch: data.branchName }) : t("held", { branch: data.branchName })
      );
      onClose();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="zw-ship-dialog">
        <DialogHeader>
          <DialogTitle>{t("shipTitle", { number: order.number })}</DialogTitle>
          <DialogDescription>
            {found ? t("shipFound", { branch: found.name }) : t("shipPick")}
          </DialogDescription>
        </DialogHeader>
        {branches.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noBranches")}</p>
        ) : (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("pickBranch")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                  {b.externalCodes.length > 0 ? ` (${b.externalCodes.join(", ")})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="bg-muted/40 rounded-md border p-3 text-sm" data-testid="zw-ship-notice">
          {t("shipNotice")}
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => ship(false)}
            disabled={!branchId || isPending}
            data-testid="zw-ship-hold"
          >
            {t("shipHold")}
          </Button>
          <Button
            type="button"
            onClick={() => ship(true)}
            disabled={!branchId || isPending}
            data-testid="zw-ship-confirm"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t("shipConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
