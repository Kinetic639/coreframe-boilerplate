"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDataViewUrlState } from "@/components/data-view/data-view-url-state";
import type { DataViewFilterRecord } from "@/components/data-view/data-view-search-params";
import { cn } from "@/utils";

const OPEN_STATUSES = ["open", "in_progress", "waiting", "waiting_response"];

type QueueKey = "unassigned" | "mine" | "waitingRequester" | "waitingVendor" | "all";

/**
 * Handler queues (Ambra Zapytania, step 5b) as presets of the DataView URL filters, so a
 * queue is just a filtered list: switching never reloads the page and the usual filter
 * controls keep working on top of it. Branch-bound queues use the active branch.
 */
export function QueueTabs({
  currentUserId,
  activeBranchId,
}: {
  currentUserId: string;
  activeBranchId: string | null;
}) {
  const t = useTranslations("modules.helpDesk.tickets.queues");
  const { filters, setFilters } = useDataViewUrlState("helpdesk-tickets");

  const presets = useMemo<Record<QueueKey, DataViewFilterRecord>>(() => {
    const branch: DataViewFilterRecord = activeBranchId ? { branchId: [activeBranchId] } : {};
    return {
      unassigned: { ...branch, unassigned: true, status: OPEN_STATUSES },
      mine: { assignedTo: [currentUserId], status: OPEN_STATUSES },
      waitingRequester: { ...branch, status: ["waiting_response"] },
      waitingVendor: { ...branch, status: ["waiting"] },
      all: {},
    };
  }, [activeBranchId, currentUserId]);

  const active = useMemo(() => {
    const same = (a: DataViewFilterRecord, b: DataViewFilterRecord) =>
      JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
    return (
      (Object.keys(presets) as QueueKey[]).find((k) => same(filters ?? {}, presets[k])) ?? null
    );
  }, [filters, presets]);

  return (
    <div role="tablist" aria-label={t("label")} className="flex flex-wrap gap-1.5">
      {(Object.keys(presets) as QueueKey[]).map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          onClick={() => setFilters(presets[key])}
          className={cn(
            "h-8 rounded-full border px-3 text-sm font-medium transition-colors",
            active === key
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
