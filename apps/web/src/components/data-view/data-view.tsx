"use client";

import React from "react";
import { cn } from "@/utils";
import type { DataViewProps } from "./data-view.types";
import { DataViewProvider } from "./data-view-provider";
import { DataViewLayout } from "./data-view-layout";

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
  scope,
  columns,
  filters,
  initialData,
  initialDataUpdatedAt,
  queryKey,
  listFetcher,
  detailFetcher,
  resolveSelectedPage,
  getRowId,
  renderCompactItem,
  renderMobileItem,
  renderExpandedRow,
  renderRowControl,
  renderToolbarControls,
  renderDetail,
  onSelectionChange,
  refreshToken,
  className,
}: DataViewProps<TListRow, TDetail>) {
  return (
    <DataViewProvider
      entity={entity}
      scope={scope}
      columns={columns}
      filters={filters}
      initialData={initialData}
      initialDataUpdatedAt={initialDataUpdatedAt}
      queryKey={queryKey}
      listFetcher={listFetcher}
      detailFetcher={detailFetcher}
      resolveSelectedPage={resolveSelectedPage}
      getRowId={getRowId}
      renderCompactItem={renderCompactItem}
      renderMobileItem={renderMobileItem}
      renderExpandedRow={renderExpandedRow}
      renderRowControl={renderRowControl}
      renderToolbarControls={renderToolbarControls}
      renderDetail={renderDetail}
      onSelectionChange={onSelectionChange}
      refreshToken={refreshToken}
    >
      <div className={cn("h-full", className)}>
        <DataViewLayout />
      </div>
    </DataViewProvider>
  );
}
