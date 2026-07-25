"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataViewDetail, useDataViewStatic } from "./use-data-view";

export function DataViewDetail() {
  const { renderDetail } = useDataViewStatic();
  const { detailData, detailIsLoading, closeDetail, isClosingDetail } = useDataViewDetail();
  const t = useTranslations("dataView");

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background"
      data-testid="detail-panel"
    >
      <div className="flex h-12 shrink-0 items-center justify-end border-b px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => void closeDetail()}
          disabled={isClosingDetail}
          aria-label={t("detail.closeAria")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {detailIsLoading ? (
          <div className="space-y-3" aria-label={t("detail.loadingAria")}>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detailData ? (
          renderDetail(detailData)
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            {t("detail.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
