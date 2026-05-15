"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Filter, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useDataViewDetail,
  useDataViewSelection,
  useDataViewStatic,
  useDataViewUrl,
} from "./use-data-view";
import { DataViewFilters } from "./data-view-filters";

// Both toolbar variants use this height so the body area never shifts vertically.
const TOOLBAR_CLS =
  "flex items-center gap-2 px-3 py-1 border-b bg-background shrink-0 min-h-[3rem]";
const SEARCH_TRANSITION = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };

type DataViewToolbarProps = {
  mode?: "list" | "compact";
};

export function DataViewToolbar({ mode = "list" }: DataViewToolbarProps) {
  const { urlState } = useDataViewUrl();
  const { renderToolbarControls } = useDataViewStatic();
  const { closeDetail, isClosingDetail } = useDataViewDetail();
  const {
    selectedRowCount,
    keepOnlySelected,
    enableKeepOnlySelected,
    disableKeepOnlySelected,
    clearSelectedRows,
  } = useDataViewSelection();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("dataView");

  useEffect(() => {
    if (mode === "compact") setSearchOpen(false);
  }, [mode]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      urlState.setSearch(e.target.value);
    },
    [urlState]
  );

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setSearchOpen(false);
  }, []);

  const searchControl = (
    <div className="flex shrink-0 items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {searchOpen ? (
          <motion.div
            key="search-input"
            initial={{ width: 36, opacity: 0 }}
            animate={{ width: 176, opacity: 1 }}
            exit={{ width: 36, opacity: 0 }}
            transition={SEARCH_TRANSITION}
            className="relative shrink-0 overflow-hidden"
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={urlState.search}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("toolbar.searchPlaceholder")}
              className="h-9 w-44 pl-8 pr-8 text-sm"
              aria-label={t("toolbar.searchAria")}
              data-testid="search-input"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("toolbar.closeSearchAria")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="search-button"
            initial={{ width: 32, opacity: 0 }}
            animate={{ width: 36, opacity: 1 }}
            exit={{ width: 32, opacity: 0 }}
            transition={SEARCH_TRANSITION}
            className="shrink-0 overflow-hidden"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setSearchOpen(true)}
              aria-label={t("toolbar.searchAria")}
              data-testid="search-icon-button"
            >
              <Search className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (mode === "list") {
    return (
      <div className={TOOLBAR_CLS} data-testid="toolbar-list">
        {searchControl}
        <DataViewFilters mode="inline" />
        <div className="flex-1" />
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
      {searchControl}
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
