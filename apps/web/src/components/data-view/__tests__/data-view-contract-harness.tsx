import React from "react";
import type { DataViewProps, PaginatedResult } from "../data-view.types";

export type DataViewContractRecord = {
  id: string;
  label: string;
};

/**
 * Domain-neutral fixture for consumers that want to run DataView's shared
 * list/detail, URL-selection, mobile-renderer, and replacement-mode contract.
 */
export function createDataViewContractFixture(
  rows: DataViewContractRecord[] = [
    { id: "record-1", label: "Contract record one" },
    { id: "record-2", label: "Contract record two" },
  ]
): DataViewProps<DataViewContractRecord, DataViewContractRecord> {
  const page: PaginatedResult<DataViewContractRecord> = {
    rows,
    totalCount: rows.length,
    page: 1,
    pageSize: 25,
  };

  return {
    entity: "data-view-contract-fixture",
    scope: { projectId: "project-1", workspaceId: "workspace-2" },
    queryKey: ["data-view-contract-fixture"],
    columns: [{ key: "label", header: "Label", accessor: (row) => row.label, sortable: true }],
    initialData: page,
    listFetcher: async () => page,
    detailFetcher: async (id) => rows.find((row) => row.id === id) ?? null,
    getRowId: (row) => row.id,
    renderCompactItem: (row) => <span>{row.label}</span>,
    renderMobileItem: (row) => <span data-testid={`contract-mobile-${row.id}`}>{row.label}</span>,
    renderDetail: (detail) => (
      <article data-testid="contract-detail">Detail: {detail.label}</article>
    ),
  };
}
