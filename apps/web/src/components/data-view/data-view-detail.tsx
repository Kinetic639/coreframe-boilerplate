"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataViewDetail, useDataViewStatic } from "./use-data-view";

type DataViewDetailProps = {
  mode?: "split" | "replacement";
  focusRef?: React.RefObject<HTMLButtonElement | null>;
};

export function DataViewDetail({ mode = "split", focusRef }: DataViewDetailProps) {
  const { renderDetail } = useDataViewStatic();
  const {
    detailData,
    detailIsLoading,
    detailIsRefreshing,
    detailError,
    detailNotFound,
    selectedOutsideCurrentResults,
    closeDetail,
    isClosingDetail,
  } = useDataViewDetail();
  const t = useTranslations("dataView");
  const isReplacement = mode === "replacement";

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background"
      data-testid="detail-panel"
    >
      <div className="flex min-h-12 shrink-0 items-center border-b px-2 sm:px-4">
        {isReplacement ? (
          <Button
            ref={focusRef}
            variant="ghost"
            size="sm"
            className="min-h-11 touch-manipulation gap-2 px-3 focus-visible:ring-2"
            onClick={() => void closeDetail()}
            disabled={isClosingDetail}
            aria-label={t("detail.backToList")}
            data-testid="back-to-list-button"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            <span>{t("detail.backToList")}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-9 w-9"
            onClick={() => void closeDetail()}
            disabled={isClosingDetail}
            aria-label={t("detail.closeAria")}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-4">
        {selectedOutsideCurrentResults ? (
          <div
            className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            role="status"
          >
            {t("detail.selectedOutsideResults")}
          </div>
        ) : null}
        {detailIsRefreshing ? (
          <span className="sr-only" role="status">
            {t("detail.refreshing")}
          </span>
        ) : null}
        {detailError && detailData ? (
          <div
            className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {t("detail.refreshError")}
          </div>
        ) : null}
        {detailIsLoading ? (
          <div className="space-y-3" aria-label={t("detail.loadingAria")}>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detailData ? (
          renderDetail(detailData)
        ) : detailError ? (
          <div
            className="flex h-24 items-center justify-center text-sm text-destructive"
            role="alert"
          >
            {t("detail.error")}
          </div>
        ) : detailNotFound ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            {t("detail.notFound")}
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            {t("detail.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
