"use client";

import { useTransition } from "react";
import { Check, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { closeRequestAction } from "@/app/actions/requests";

/** Requester-only: "Sprawa załatwiona" closes, "Wycofaj" withdraws (confirmed). */
export function CloseActions({ ticketId }: { ticketId: string }) {
  const t = useTranslations("requests.close");
  const [pending, start] = useTransition();
  const run = (outcome: "closed" | "cancelled") => {
    if (!window.confirm(t(outcome === "closed" ? "confirmClose" : "confirmCancel"))) return;
    start(async () => {
      const res = await closeRequestAction(ticketId, outcome);
      if (res?.error) window.alert(t("failed"));
    });
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("closed")}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#BBE5C8] bg-[#F0FAF3] px-3 text-[12.5px] font-semibold text-[#15803D] disabled:opacity-60"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
        {t("close")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("cancelled")}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12.5px] font-medium text-stone-600 disabled:opacity-60"
      >
        <Undo2 className="h-3.5 w-3.5" />
        {t("cancel")}
      </button>
    </div>
  );
}
