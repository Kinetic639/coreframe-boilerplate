"use client";

import React, { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, X, RefreshCw } from "lucide-react";
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
import { invalidateDataViewEntity } from "./data-view-query-keys";

// Both toolbar variants use this height so the body area never shifts vertically.
const TOOLBAR_CLS =
  "flex min-w-0 flex-wrap items-center gap-2 border-b bg-background px-3 py-1.5 shrink-0 min-h-[3rem]";

type DataViewToolbarProps = {
  mode?: "list" | "compact";
  filterMode?: "inline" | "dropdown";
};

export function DataViewToolbar({ mode = "list", filterMode = "inline" }: DataViewToolbarProps) {
  const { renderToolbarControls, entity, scope } = useDataViewStatic();
  const { closeDetail, isClosingDetail } = useDataViewDetail();
  const { listIsTransitioning } = useDataViewList();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(() => {
    void invalidateDataViewEntity(queryClient, entity, scope);
  }, [queryClient, entity, scope]);
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
        <DataViewFilters mode={filterMode} />
        <div className="min-w-0 flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleRefresh}
          disabled={listIsTransitioning}
          aria-label={t("toolbar.refreshAria")}
          title={t("toolbar.refreshAria")}
          data-testid="refresh-button"
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-4 w-4 ${listIsTransitioning ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
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
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{t("detail.backToList")}</span>
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
      <X aria-hidden="true" className="h-4 w-4" />
    </Button>
  );
}
