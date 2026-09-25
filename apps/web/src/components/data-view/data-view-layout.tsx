"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils";
import { useDataViewUrl } from "./use-data-view";
import { DataViewToolbar } from "./data-view-toolbar";
import { DataViewTable } from "./data-view-table";
import { DataViewSidebar } from "./data-view-sidebar";
import { DataViewDetail } from "./data-view-detail";
import { DataViewPagination } from "./data-view-pagination";
import { DataViewMobileLayout } from "./data-view-mobile-layout";
import { useMediaQuery } from "./use-media-query";

const COLLAPSE_MS = 220;
const SIDEBAR_WIDTH = 320;
const PAGINATION_HEIGHT = 53;
const SHARED_EASE = [0.22, 1, 0.36, 1] as const;
const WIDTH_TRANSITION = { duration: COLLAPSE_MS / 1000, ease: SHARED_EASE };
const DETAIL_TRANSITION = { duration: COLLAPSE_MS / 1000, ease: SHARED_EASE };

function DataViewDesktopLayout() {
  const { isDetailOpen } = useDataViewUrl();

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border bg-background">
      <motion.div
        animate={{ width: isDetailOpen ? SIDEBAR_WIDTH : "100%" }}
        transition={WIDTH_TRANSITION}
        style={{ willChange: "width" }}
        className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-background"
      >
        <DataViewToolbar mode={isDetailOpen ? "compact" : "list"} />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {isDetailOpen ? <DataViewSidebar /> : <DataViewTable />}
        </div>

        <div
          className={cn(
            "shrink-0 overflow-hidden transition-[height,opacity] duration-200 ease-out",
            !isDetailOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          style={{ height: !isDetailOpen ? PAGINATION_HEIGHT : 0 }}
          aria-hidden={isDetailOpen}
        >
          <div
            className={cn(
              "transition-opacity duration-150",
              !isDetailOpen ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <DataViewPagination />
          </div>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {isDetailOpen && (
          <motion.div
            key="detail-panel"
            initial={{ x: 64, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 64, opacity: 0 }}
            transition={DETAIL_TRANSITION}
            style={{ willChange: "transform, opacity" }}
            className="flex h-full min-w-0 flex-1 overflow-hidden"
          >
            <DataViewDetail />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DataViewLayout() {
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  return isDesktop ? <DataViewDesktopLayout /> : <DataViewMobileLayout />;
}
