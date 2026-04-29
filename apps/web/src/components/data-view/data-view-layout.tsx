"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils";
import { useDataViewUrl } from "./use-data-view";
import { DataViewToolbar } from "./data-view-toolbar";
import { DataViewTable } from "./data-view-table";
import { DataViewSidebar } from "./data-view-sidebar";
import { DataViewDetail } from "./data-view-detail";
import { DataViewPagination } from "./data-view-pagination";

const COLLAPSE_MS = 220;
const SIDEBAR_WIDTH = 320;
const PAGINATION_HEIGHT = 53;
const SHARED_EASE = [0.22, 1, 0.36, 1] as const;
const WIDTH_TRANSITION = { duration: COLLAPSE_MS / 1000, ease: SHARED_EASE };
const DETAIL_TRANSITION = { duration: COLLAPSE_MS / 1000, ease: SHARED_EASE };

type TransitionPhase = "list" | "entering" | "detail" | "exiting";

export function DataViewLayout() {
  const { isDetailOpen } = useDataViewUrl();
  const [phase, setPhase] = useState<TransitionPhase>(isDetailOpen ? "detail" : "list");
  const [showOnlyPrimary, setShowOnlyPrimary] = useState(isDetailOpen);
  const [isCollapsed, setIsCollapsed] = useState(isDetailOpen);
  const [showDetailPanel, setShowDetailPanel] = useState(isDetailOpen);
  const hasMountedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (isDetailOpen) {
      setPhase((current) => (current === "detail" ? current : "entering"));
      setShowOnlyPrimary(true);
      setShowDetailPanel(false);
      frameRef.current = requestAnimationFrame(() => {
        setIsCollapsed(true);
      });
    } else {
      setPhase((current) => (current === "list" ? current : "exiting"));
      setShowDetailPanel(false);
      setShowOnlyPrimary(true);
      setIsCollapsed(false);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isDetailOpen]);

  useEffect(() => {
    if (isDetailOpen || phase !== "list") return;

    setShowOnlyPrimary(false);
    setIsCollapsed(false);
    setShowDetailPanel(false);
  }, [isDetailOpen, phase]);

  const showSidebar = phase === "detail" || phase === "exiting";
  const showPaginationSlot = phase === "list" || phase === "exiting";
  const showPaginationContent = phase === "list";
  const toolbarMode = phase === "list" ? "list" : "compact";

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border bg-background">
      <motion.div
        animate={{ width: isCollapsed ? SIDEBAR_WIDTH : "100%" }}
        transition={WIDTH_TRANSITION}
        onAnimationComplete={() => {
          if (phase === "entering") {
            setShowDetailPanel(true);
            setPhase("detail");
          }

          if (phase === "exiting") {
            setShowOnlyPrimary(false);
            setPhase("list");
          }
        }}
        style={{ willChange: "width" }}
        className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-background"
      >
        <DataViewToolbar mode={toolbarMode} />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {showSidebar ? <DataViewSidebar /> : <DataViewTable primaryOnly={showOnlyPrimary} />}
        </div>

        <div
          className={cn(
            "shrink-0 overflow-hidden transition-[height,opacity] duration-200 ease-out",
            showPaginationSlot ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          style={{ height: showPaginationSlot ? PAGINATION_HEIGHT : 0 }}
          aria-hidden={!showPaginationContent}
        >
          <div
            className={cn(
              "transition-opacity duration-150",
              showPaginationContent ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <DataViewPagination />
          </div>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {showDetailPanel && (
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
