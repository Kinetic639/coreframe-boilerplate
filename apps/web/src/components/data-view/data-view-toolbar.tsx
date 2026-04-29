"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDataView } from "./use-data-view";
import { DataViewFilters } from "./data-view-filters";
import { DataViewColumnManager } from "./data-view-columns";

// Both toolbar variants use this height so the body area never shifts vertically.
const TOOLBAR_CLS = "flex items-center gap-2 px-3 border-b bg-background shrink-0 min-h-[2.75rem]";

export function DataViewToolbar() {
  const { urlState, isDetailOpen } = useDataView();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDetailOpen) setSearchOpen(false);
  }, [isDetailOpen]);

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

  const clearSearch = useCallback(() => {
    urlState.setSearch("");
  }, [urlState]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setSearchOpen(false);
  }, []);

  // ── Full list mode ─────────────────────────────────────────────────────────
  if (!isDetailOpen) {
    return (
      <div className={TOOLBAR_CLS} data-testid="toolbar-list">
        {/* Search */}
        <div className="relative w-44 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            value={urlState.search}
            onChange={handleSearchChange}
            placeholder="Search..."
            className="pl-8 h-8 text-sm"
            aria-label="Search"
            data-testid="search-input"
          />
          {urlState.search && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Inline filters */}
        <DataViewFilters mode="inline" />

        <div className="flex-1" />

        {/* Column manager — list mode only */}
        <DataViewColumnManager />
      </div>
    );
  }

  // ── Detail / sidebar mode ──────────────────────────────────────────────────
  // "Filters" acts as "Back to full list" — clears selection, restores inline filters.
  return (
    <div className={TOOLBAR_CLS} data-testid="toolbar-detail">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs shrink-0"
        onClick={() => urlState.setSelected(null)}
        aria-label="Back to full list"
        data-testid="back-to-list-button"
      >
        <Filter className="h-3.5 w-3.5" />
        <span>Filters</span>
      </Button>

      <div className="flex-1" />

      {searchOpen ? (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            value={urlState.search}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            className="pl-8 pr-8 h-8 text-sm w-40"
            aria-label="Search"
            data-testid="search-input"
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Close search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          data-testid="search-icon-button"
        >
          <Search className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function DataViewCloseDetail() {
  const { urlState } = useDataView();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => urlState.setSelected(null)}
      aria-label="Close detail"
      className="h-8 w-8"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
