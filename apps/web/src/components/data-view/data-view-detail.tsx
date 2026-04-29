"use client";

import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataView } from "./use-data-view";

export function DataViewDetail() {
  const { detailData, detailIsLoading, renderDetail, urlState } = useDataView();

  return (
    <div className="h-full flex flex-col border-l overflow-hidden" data-testid="detail-panel">
      {/* Close button row */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => urlState.setSelected(null)}
          aria-label="Close detail"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {detailIsLoading ? (
          <div className="space-y-3" aria-label="Loading detail">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detailData ? (
          renderDetail(detailData)
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No detail data available.
          </div>
        )}
      </div>
    </div>
  );
}
