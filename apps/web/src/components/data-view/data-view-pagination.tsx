"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDataViewDetail,
  useDataViewList,
  useDataViewSelection,
  useDataViewUrl,
} from "./use-data-view";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataViewPagination() {
  const { listData } = useDataViewList();
  const { urlState } = useDataViewUrl();
  const { clearReturnHighlight, returnHighlightId } = useDataViewDetail();
  const { keepOnlySelected, selectedRowCount } = useDataViewSelection();
  const { totalCount, page, pageSize } = listData;

  const totalPages = keepOnlySelected ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const pageDisplay = keepOnlySelected ? 1 : page;
  const from = keepOnlySelected
    ? selectedRowCount === 0
      ? 0
      : 1
    : totalCount === 0
      ? 0
      : (page - 1) * pageSize + 1;
  const to = keepOnlySelected ? selectedRowCount : Math.min(page * pageSize, totalCount);

  const canPrev = !keepOnlySelected && page > 1;
  const canNext = !keepOnlySelected && page < totalPages;

  const handleMeaningfulInteraction = () => {
    if (returnHighlightId) {
      clearReturnHighlight();
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t bg-background text-sm">
      <p className="text-muted-foreground" data-testid="pagination-info">
        {keepOnlySelected
          ? selectedRowCount === 0
            ? "No selected rows"
            : `Showing ${from}-${to} of ${selectedRowCount} selected row${selectedRowCount === 1 ? "" : "s"}`
          : totalCount === 0
            ? "No results"
            : `Showing ${from}–${to} of ${totalCount} results`}
      </p>

      <div className="flex items-center gap-3">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          {keepOnlySelected ? (
            <>
              <span className="text-muted-foreground hidden sm:inline">Rows shown</span>
              <div className="flex h-8 min-w-16 items-center justify-center rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {selectedRowCount}
              </div>
            </>
          ) : (
            <>
              <span className="text-muted-foreground hidden sm:inline">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  handleMeaningfulInteraction();
                  urlState.setPageSize(Number(v));
                }}
              >
                <SelectTrigger className="h-8 w-16" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              handleMeaningfulInteraction();
              urlState.setPage(page - 1);
            }}
            disabled={!canPrev || keepOnlySelected}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-xs px-1">
            {pageDisplay} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              handleMeaningfulInteraction();
              urlState.setPage(page + 1);
            }}
            disabled={!canNext || keepOnlySelected}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
