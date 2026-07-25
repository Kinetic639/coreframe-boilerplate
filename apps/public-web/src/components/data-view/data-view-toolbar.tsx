"use client";

import React, { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Filter, X, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  useDataViewDetail,
  useDataViewList,
  useDataViewSelection,
  useDataViewStatic,
} from "./use-data-view";
import { DataViewFilters } from "./data-view-filters";
import { DataViewSearchControl } from "./data-view-search-control";

// Both toolbar variants use this height so the body area never shifts vertically.
const TOOLBAR_CLS =
  "flex items-center gap-2 px-3 py-1 border-b bg-background shrink-0 min-h-[3rem]";

type DataViewToolbarProps = {
  mode?: "list" | "compact";
};

export function DataViewToolbar({ mode = "list" }: DataViewToolbarProps) {
  const { renderToolbarControls, queryKey } = useDataViewStatic();
  const { closeDetail, isClosingDetail } = useDataViewDetail();
  const { listIsTransitioning } = useDataViewList();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);
  const {
    selectedRowCount,
    keepOnlySelected,
    enableKeepOnlySelected,
    disableKeepOnlySelected,
    clearSelectedRows,
  } = useDataViewSelection();
  const t = useTranslations("dataView");

  if (mode === "list") {
    return (
      <div className={TOOLBAR_CLS} data-testid="toolbar-list">
        <DataViewSearchControl mode={mode} />
        <DataViewFilters mode="inline" />
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleRefresh}
          disabled={listIsTransitioning}
          aria-label="Refresh"
          title="Refresh"
          data-testid="refresh-button"
        >
          <RefreshCw className={`h-4 w-4 ${listIsTransitioning ? "animate-spin" : ""}`} />
        </Button>
        {renderToolbarControls ? renderToolbarControls() : null}
        {selectedRowCount > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("selection.selectedCount", { count: selectedRowCount })}
            </span>
            {keepOnlySelected ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                onClick={disableKeepOnlySelected}
              >
                {t("selection.showAll")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                onClick={enableKeepOnlySelected}
              >
                {t("selection.keepSelected")}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearSelectedRows}>
              {t("selection.clear")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={TOOLBAR_CLS} data-testid="toolbar-detail">
      <DataViewSearchControl mode={mode} />
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 text-xs shrink-0"
        onClick={() => void closeDetail()}
        disabled={isClosingDetail}
        aria-label={t("toolbar.backToListAria")}
        data-testid="back-to-list-button"
      >
        <Filter className="h-3.5 w-3.5" />
        <span>{t("filters.button")}</span>
      </Button>
    </div>
  );
}

export function DataViewCloseDetail() {
  const { closeDetail, isClosingDetail } = useDataViewDetail();
  const t = useTranslations("dataView");
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => void closeDetail()}
      disabled={isClosingDetail}
      aria-label={t("detail.closeAria")}
      className="h-8 w-8"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
