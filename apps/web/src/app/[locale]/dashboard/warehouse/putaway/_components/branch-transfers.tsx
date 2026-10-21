"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowDownToLine, Loader2, Send } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acceptBranchTransferIntoReceivingAction,
  sendBranchTransferAction,
} from "@/app/actions/warehouse/internal-orders";
import type { BranchTransferView } from "@/server/services/internal-orders.service";

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Transfers between branches on the receiving screen: what arrives from
 * other branches (accept into the receiving zone -- reserved under its ZW
 * when it is for one) and what other branches reserved here (send).
 */
export function BranchTransfers({
  incoming,
  toSend,
  canOperate,
}: {
  incoming: BranchTransferView[];
  toSend: BranchTransferView[];
  canOperate: boolean;
}) {
  const t = useTranslations("modules.warehouse.putaway.transfers");
  const tErr = useTranslations("modules.warehouse.internalOrders.errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (kind: "accept" | "send", transfer: BranchTransferView) =>
    startTransition(async () => {
      const result =
        kind === "accept"
          ? await acceptBranchTransferIntoReceivingAction({ transferId: transfer.id })
          : await sendBranchTransferAction({ transferId: transfer.id });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
        return;
      }
      toast.success(
        kind === "accept"
          ? t("accepted", { number: transfer.number })
          : t("sent", { number: transfer.number })
      );
      router.refresh();
    });

  const card = (transfer: BranchTransferView, kind: "accept" | "send") => (
    <div
      key={transfer.id}
      className="bg-card rounded-lg border px-3 py-2"
      data-testid={`branch-transfer-${kind}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold">{transfer.number}</span>
        <Badge variant="secondary">
          {kind === "accept"
            ? t("from", { branch: transfer.sourceBranchName ?? "—" })
            : t("to", { branch: transfer.destinationBranchName ?? "—" })}
        </Badge>
        {transfer.internalOrderNumber && (
          <Badge variant="outline">{transfer.internalOrderNumber}</Badge>
        )}
        {canOperate && (
          <Button
            type="button"
            size="sm"
            className="ml-auto h-8"
            disabled={isPending}
            onClick={() => run(kind, transfer)}
            data-testid={`branch-transfer-${kind}-button`}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : kind === "accept" ? (
              <ArrowDownToLine className="mr-1.5 h-4 w-4" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            {kind === "accept" ? t("accept") : t("send")}
          </Button>
        )}
      </div>
      <ul className="divide-y text-sm">
        {transfer.lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate">
              <span className="mr-1.5 font-mono font-semibold">{line.sku ?? "—"}</span>
              {line.productName ?? ""}
            </span>
            <span className="shrink-0 font-mono">{fmt(line.quantity)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (incoming.length === 0 && toSend.length === 0) return null;
  return (
    <div className="grid gap-5">
      {incoming.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="putaway-section-incoming">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ArrowDownToLine className="text-muted-foreground h-4 w-4" />
              {t("incomingTitle")}
            </h2>
            <p className="text-muted-foreground text-xs">{t("incomingHint")}</p>
          </div>
          {incoming.map((x) => card(x, "accept"))}
        </section>
      )}
      {toSend.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="putaway-section-to-send">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Send className="text-muted-foreground h-4 w-4" />
              {t("toSendTitle")}
            </h2>
            <p className="text-muted-foreground text-xs">{t("toSendHint")}</p>
          </div>
          {toSend.map((x) => card(x, "send"))}
        </section>
      )}
    </div>
  );
}
