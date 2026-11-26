"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  patchRequest,
  requestKeys,
  restore,
  useRequestsScope,
  type Snapshot,
} from "@/lib/requests-query";
import { cn } from "@/lib/utils";
import type { RequestListItem } from "@/server/requests/types";

type Outcome = "closed" | "cancelled";

async function closeRequest(ticketId: string, outcome: Outcome): Promise<RequestListItem> {
  const res = await fetch(`/api/requests/${ticketId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome }),
  });
  if (!res.ok) throw new Error("close_failed");
  return (await res.json()) as RequestListItem;
}

/**
 * Requester-only: "Sprawa załatwiona" closes, "Wycofaj" withdraws, each after a named
 * confirmation. The card and the list show the new state at once; the saved row replaces
 * it, an error puts it back. `stretch` lays them out as the phone's bottom bar.
 */
export function CloseActions({
  ticketId,
  stretch = false,
}: {
  ticketId: string;
  stretch?: boolean;
}) {
  const t = useTranslations("requests.close");
  const qc = useQueryClient();
  const scope = useRequestsScope();
  const [asking, setAsking] = useState<Outcome | null>(null);

  const close = useMutation<RequestListItem, Error, Outcome, Snapshot>({
    mutationFn: (outcome) => closeRequest(ticketId, outcome),
    onMutate: async (outcome) => {
      await qc.cancelQueries({ queryKey: requestKeys.all(scope) });
      return patchRequest(qc, scope, ticketId, {
        state: outcome,
        status: outcome,
        canClose: false,
      });
    },
    onSuccess: (saved, outcome) => {
      patchRequest(qc, scope, ticketId, { ...saved, status: outcome, canClose: false });
      toast.success(t(outcome === "closed" ? "closedToast" : "cancelledToast"));
      void qc.invalidateQueries({ queryKey: requestKeys.lists(scope) });
      void qc.invalidateQueries({ queryKey: requestKeys.detail(scope, ticketId) });
    },
    onError: (_error, _outcome, snapshot) => {
      if (snapshot) restore(qc, snapshot);
      toast.error(t("failed"));
    },
  });

  return (
    <>
      <div className={cn("flex gap-2", stretch ? "[&>*]:flex-1" : "flex-wrap")}>
        <Button
          variant="outline"
          size={stretch ? "lg" : "default"}
          disabled={close.isPending}
          onClick={() => setAsking("closed")}
        >
          <CircleCheck className="h-4 w-4" />
          {stretch ? t("closeShort") : t("close")}
        </Button>
        <Button
          variant={stretch ? "outline" : "ghost"}
          size={stretch ? "lg" : "default"}
          disabled={close.isPending}
          onClick={() => setAsking("cancelled")}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Undo2 className="h-4 w-4" />
          {t("cancel")}
        </Button>
      </div>
      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(asking === "cancelled" ? "confirmCancel" : "confirmClose")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(asking === "cancelled" ? "confirmCancelBody" : "confirmCloseBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(asking === "cancelled" && buttonVariants({ variant: "destructive" }))}
              onClick={() => asking && close.mutate(asking)}
            >
              {t(asking === "cancelled" ? "cancelConfirm" : "closeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
