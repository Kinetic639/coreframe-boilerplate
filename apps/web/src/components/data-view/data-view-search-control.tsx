"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDataViewUrl } from "./use-data-view";

const SEARCH_TRANSITION = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };

type DataViewSearchControlProps = {
  mode?: "list" | "compact";
  persistent?: boolean;
};

export function DataViewSearchControl({
  mode = "list",
  persistent = false,
}: DataViewSearchControlProps) {
  const { urlState } = useDataViewUrl();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("dataView");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (mode === "compact") setSearchOpen(false);
  }, [mode]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      urlState.setSearch(event.target.value);
    },
    [urlState]
  );

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setSearchOpen(false);
  }, []);

  if (persistent) {
    return (
      <div className="relative min-w-0 w-full">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={urlState.search}
          onChange={handleSearchChange}
          placeholder={t("toolbar.searchPlaceholder")}
          className="h-11 w-full min-w-0 pl-9 text-sm"
          name="data-view-search"
          autoComplete="off"
          aria-label={t("toolbar.searchAria")}
          data-testid="search-input"
        />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {searchOpen ? (
          <motion.div
            key="search-input"
            initial={{ x: -4, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -4, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : SEARCH_TRANSITION}
            className="relative w-44 shrink-0 overflow-hidden"
          >
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              value={urlState.search}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("toolbar.searchPlaceholder")}
              className="h-9 w-44 pl-8 pr-8 text-sm"
              name="data-view-search"
              autoComplete="off"
              aria-label={t("toolbar.searchAria")}
              data-testid="search-input"
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("toolbar.closeSearchAria")}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="search-button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : SEARCH_TRANSITION}
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
              <Search aria-hidden="true" className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
