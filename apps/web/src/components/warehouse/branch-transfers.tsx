"use client";

import { useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowDownToLine, Ban, Loader2, PauseCircle, Send, Truck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acceptBranchTransferIntoReceivingAction,
  sendBranchTransferAction,
  withdrawBranchTransferAction,
} from "@/app/actions/warehouse/internal-orders";
import type {
  BranchTransferLists,
  BranchTransferView,
} from "@/server/services/internal-orders.service";

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

type Action = "accept" | "send" | "withdraw";

/**
 * MMJ transfers of the branch not yet accepted, as in AutoStacja's "POTEM":
 * arriving MMJ+ (w drodze, the receiver accepts -- in full, into the
 * receiving zone), sent MMJ- (w drodze, the sender may withdraw) and drafts
 * ("wstrzymane": reserved, not sent). Neither document has a number until
 * the receiver accepts; the parts stay on the sender's stock until then.
 */
export function BranchTransfers({
  transfers,
  canOperate,
}: {
  transfers: BranchTransferLists;
  canOperate: boolean;
}) {
  const t = useTranslations("modules.warehouse.putaway.transfers");
  const tErr = useTranslations("modules.warehouse.internalOrders.errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (action: Action, transfer: BranchTransferView) =>
    startTransition(async () => {
      const result =
        action === "accept"
          ? await acceptBranchTransferIntoReceivingAction({ transferId: transfer.id })
          : action === "send"
            ? await sendBranchTransferAction({ transferId: transfer.id })
            : await withdrawBranchTransferAction({ transferId: transfer.id, reason: null });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
        return;
      }
      if (action === "accept") {
        const data = (result as { data: { outNumber: string | null; inNumber: string | null } })
          .data;
        toast.success(
          t("accepted", { mmIn: data.inNumber ?? "MMJ+", mmOut: data.outNumber ?? "MMJ-" })
        );
      } else {
        toast.success(t(action === "send" ? "sent" : "withdrawn"));
      }
      router.refresh();
    });

  const card = (
    transfer: BranchTransferView,
    kind: "incoming" | "outgoing" | "draft",
    actions: ReactNode
  ) => (
    <div
      key={transfer.id}
      className="bg-card rounded-lg border px-3 py-2"
      data-testid={`branch-transfer-${kind}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold">
          {kind === "incoming" ? "MMJ+" : "MMJ-"}
        </span>
        <Badge variant={kind === "draft" ? "outline" : "secondary"}>
          {kind === "draft" ? t("statusDraft") : t("statusInTransit")}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {kind === "incoming"
            ? t("from", { branch: transfer.sourceBranchName ?? "—" })
            : t("to", { branch: transfer.destinationBranchName ?? "—" })}
        </span>
        {transfer.internalOrderNumber && (
          <Badge variant="outline">{transfer.internalOrderNumber}</Badge>
        )}
        <span className="text-muted-foreground font-mono text-[11px]">{transfer.number}</span>
        {canOperate && <div className="ml-auto flex gap-2">{actions}</div>}
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

  const button = (
    action: Action,
    transfer: BranchTransferView,
    label: string,
    icon: ReactNode,
    variant: "default" | "outline" = "default"
  ) => (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className="h-8"
      disabled={isPending}
      onClick={() => run(action, transfer)}
      data-testid={`branch-transfer-${action}-button`}
    >
      {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  const section = (
    testId: string,
    icon: ReactNode,
    title: string,
    hint: string,
    children: ReactNode
  ) => (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      {children}
    </section>
  );

  const { incoming, outgoing, toSend } = transfers;
  if (incoming.length === 0 && outgoing.length === 0 && toSend.length === 0) return null;
  return (
    <div className="grid gap-5">
      {incoming.length > 0 &&
        section(
          "putaway-section-incoming",
          <ArrowDownToLine className="text-muted-foreground h-4 w-4" />,
          t("incomingTitle"),
          t("incomingHint"),
          incoming.map((x) =>
            card(
              x,
              "incoming",
              button("accept", x, t("accept"), <ArrowDownToLine className="mr-1.5 h-4 w-4" />)
            )
          )
        )}
      {outgoing.length > 0 &&
        section(
          "putaway-section-outgoing",
          <Truck className="text-muted-foreground h-4 w-4" />,
          t("outgoingTitle"),
          t("outgoingHint"),
          outgoing.map((x) =>
            card(
              x,
              "outgoing",
              button("withdraw", x, t("withdraw"), <Ban className="mr-1.5 h-4 w-4" />, "outline")
            )
          )
        )}
      {toSend.length > 0 &&
        section(
          "putaway-section-to-send",
          <PauseCircle className="text-muted-foreground h-4 w-4" />,
          t("toSendTitle"),
          t("toSendHint"),
          toSend.map((x) =>
            card(
              x,
              "draft",
              <>
                {button(
                  "withdraw",
                  x,
                  t("withdraw"),
                  <Ban className="mr-1.5 h-4 w-4" />,
                  "outline"
                )}
                {button("send", x, t("send"), <Send className="mr-1.5 h-4 w-4" />)}
              </>
            )
          )
        )}
    </div>
  );
}
