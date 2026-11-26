"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  patchRequest,
  requestKeys,
  restore,
  useRequestsScope,
  type Snapshot,
} from "@/lib/requests-query";
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
 * Requester-only: "Sprawa załatwiona" closes, "Wycofaj" withdraws (confirmed). The card and
 * the list show the new state at once; the saved row replaces it, an error puts it back.
 */
export function CloseActions({ ticketId }: { ticketId: string }) {
  const t = useTranslations("requests.close");
  const qc = useQueryClient();
  const scope = useRequestsScope();

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
      void qc.invalidateQueries({ queryKey: requestKeys.lists(scope) });
      void qc.invalidateQueries({ queryKey: requestKeys.detail(scope, ticketId) });
    },
    onError: (_error, _outcome, snapshot) => {
      if (snapshot) restore(qc, snapshot);
      window.alert(t("failed"));
    },
  });

  const run = (outcome: Outcome) => {
    if (!window.confirm(t(outcome === "closed" ? "confirmClose" : "confirmCancel"))) return;
    close.mutate(outcome);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={close.isPending}
        onClick={() => run("closed")}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#BBE5C8] bg-[#F0FAF3] px-3 text-[12.5px] font-semibold text-[#15803D] disabled:opacity-60"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
        {t("close")}
      </button>
      <button
        type="button"
        disabled={close.isPending}
        onClick={() => run("cancelled")}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12.5px] font-medium text-stone-600 disabled:opacity-60"
      >
        <Undo2 className="h-3.5 w-3.5" />
        {t("cancel")}
      </button>
    </div>
  );
}
