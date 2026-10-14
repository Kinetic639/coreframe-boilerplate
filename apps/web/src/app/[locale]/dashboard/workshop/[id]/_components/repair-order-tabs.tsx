"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const REPAIR_ORDER_TABS = [
  "overview",
  "lines",
  "warehouse",
  "documents",
  "related",
] as const;
export type RepairOrderTab = (typeof REPAIR_ORDER_TABS)[number];

export function isRepairOrderTab(value: unknown): value is RepairOrderTab {
  return REPAIR_ORDER_TABS.includes(value as RepairOrderTab);
}

export interface RepairOrderTabDefinition {
  id: RepairOrderTab;
  label: string;
  /** Shown next to the label (lines, related items); hidden when 0 or undefined */
  count?: number;
  content: ReactNode;
}

/**
 * The repair order's page as tabs. The open tab is kept in the URL (`?tab=`)
 * so a link can point at one; switching does not reload the page. Every panel
 * stays mounted (hidden when inactive), so an edit in progress in one tab
 * survives a look at another.
 */
export function RepairOrderTabs({
  tabs,
  initialTab,
  label,
}: {
  tabs: RepairOrderTabDefinition[];
  initialTab: RepairOrderTab;
  label: string;
}) {
  const [active, setActive] = useState<RepairOrderTab>(initialTab);

  const select = (value: string) => {
    if (!isRepairOrderTab(value)) return;
    setActive(value);
    const url = new URL(window.location.href);
    if (value === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <Tabs value={active} onValueChange={select} className="flex flex-col gap-4">
      <TabsList
        aria-label={label}
        className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="relative h-9 shrink-0 rounded-none border-0 bg-transparent px-3 text-sm text-muted-foreground shadow-none after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-primary"
          >
            {tab.label}
            {tab.count ? (
              <span className="ml-1.5 rounded bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          forceMount
          className="mt-0 flex flex-col gap-6 data-[state=inactive]:hidden"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
