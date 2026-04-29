"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cn } from "@/utils";
import type { DataViewProps } from "./data-view.types";
import { DataViewProvider } from "./data-view-provider";
import { DataViewLayout } from "./data-view-layout";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  });
}

/**
 * DataView — Generic SSR-first Master–Detail data view component.
 *
 * Composes:
 * - URL state (via nuqs useQueryStates — requires NuqsAdapter in layout)
 * - TanStack Query for list + detail fetching
 * - TanStack Table for column management + sorting
 * - Framer Motion for detail panel slide-in animation
 */
export function DataView<TListRow, TDetail>({
  entity,
  columns,
  filters,
  initialData,
  queryKey,
  listFetcher,
  detailFetcher,
  resolveSelectedPage,
  getRowId,
  renderCompactItem,
  renderDetail,
  className,
}: DataViewProps<TListRow, TDetail>) {
  // Per-mount QueryClient — isolates cache between DataView instances and test renders.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <DataViewProvider
        entity={entity}
        columns={columns}
        filters={filters}
        initialData={initialData}
        queryKey={queryKey}
        listFetcher={listFetcher}
        detailFetcher={detailFetcher}
        resolveSelectedPage={resolveSelectedPage}
        getRowId={getRowId}
        renderCompactItem={renderCompactItem}
        renderDetail={renderDetail}
      >
        <div className={cn("h-full", className)}>
          <DataViewLayout />
        </div>
      </DataViewProvider>
    </QueryClientProvider>
  );
}
