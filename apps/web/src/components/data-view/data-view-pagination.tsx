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
import { useDataView } from "./use-data-view";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataViewPagination() {
  const { listData, urlState } = useDataView();
  const { totalCount, page, pageSize } = listData;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t bg-background text-sm">
      <p className="text-muted-foreground" data-testid="pagination-info">
        {totalCount === 0 ? "No results" : `Showing ${from}–${to} of ${totalCount} results`}
      </p>

      <div className="flex items-center gap-3">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden sm:inline">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => urlState.setPageSize(Number(v))}>
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
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => urlState.setPage(page - 1)}
            disabled={!canPrev}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-xs px-1">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => urlState.setPage(page + 1)}
            disabled={!canNext}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
