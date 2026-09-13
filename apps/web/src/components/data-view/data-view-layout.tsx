"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/utils";
import { useDataViewUrl } from "./use-data-view";
import { DataViewToolbar } from "./data-view-toolbar";
import { DataViewTable } from "./data-view-table";
import { DataViewSidebar } from "./data-view-sidebar";
import { DataViewDetail } from "./data-view-detail";
import { DataViewPagination } from "./data-view-pagination";
import { DataViewMobileLayout } from "./data-view-mobile-layout";
import { type DataViewLayoutMode, useDataViewContainerMode } from "./use-data-view-container-mode";

const COLLAPSE_MS = 220;
const PAGINATION_HEIGHT = 53;
const SHARED_EASE = [0.22, 1, 0.36, 1] as const;
const DETAIL_TRANSITION = { duration: COLLAPSE_MS / 1000, ease: SHARED_EASE };

type OpenRowHandler = (rowId: string, trigger: HTMLElement) => void;

type DataViewDesktopMasterProps = {
  mode: "wide" | "medium";
  isSplit: boolean;
  onOpenRow: OpenRowHandler;
  listContainerRef: React.RefObject<HTMLDivElement | null>;
};

function DataViewDesktopMaster({
  mode,
  isSplit,
  onOpenRow,
  listContainerRef,
}: DataViewDesktopMasterProps) {
  return (
    <>
      <DataViewToolbar
        mode={isSplit ? "compact" : "list"}
        filterMode={mode === "wide" ? "inline" : "dropdown"}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {isSplit ? (
          <DataViewSidebar onOpenRow={onOpenRow} />
        ) : (
          <DataViewTable onOpenRow={onOpenRow} listContainerRef={listContainerRef} />
        )}
      </div>

      <div
        className={cn(
          "shrink-0 overflow-hidden transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none",
          !isSplit ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{ height: !isSplit ? PAGINATION_HEIGHT : 0 }}
        aria-hidden={isSplit}
      >
        <div
          className={cn(
            "transition-opacity duration-150 motion-reduce:transition-none",
            !isSplit ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <DataViewPagination />
        </div>
      </div>
    </>
  );
}

export function DataViewLayout() {
  const { containerRef, mode } = useDataViewContainerMode();
  const { urlState } = useDataViewUrl();
  const reduceMotion = useReducedMotion();
  const detailFocusRef = useRef<HTMLButtonElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const returnFocusIdRef = useRef<string | null>(null);
  const previousSelectedRef = useRef<string | null>(null);
  const previousDetailWasReplacementRef = useRef(false);
  const [mountedMasterMode, setMountedMasterMode] = useState<DataViewLayoutMode>(mode);
  const isDetailOpen = urlState.selected !== null;
  const isSplit = mode === "wide" && isDetailOpen;
  const showMaster = !isDetailOpen || isSplit;
  const renderedMasterMode = !isDetailOpen || mode === "wide" ? mode : mountedMasterMode;
  const mountedMasterIsSplit = renderedMasterMode === "wide" && isDetailOpen;

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      rootRef.current = node;
    },
    [containerRef]
  );

  const handleOpenRow = useCallback<OpenRowHandler>(
    (rowId) => {
      returnFocusIdRef.current = rowId;
      setMountedMasterMode(mode);
      urlState.setSelected(rowId);
    },
    [mode, urlState]
  );

  useEffect(() => {
    const wasSelected = previousSelectedRef.current;
    previousSelectedRef.current = urlState.selected;

    if (urlState.selected) {
      previousDetailWasReplacementRef.current = mode !== "wide";
      if (mode !== "wide") requestAnimationFrame(() => detailFocusRef.current?.focus());
      return;
    }

    if (wasSelected && previousDetailWasReplacementRef.current) {
      previousDetailWasReplacementRef.current = false;
      requestAnimationFrame(() => {
        const root = rootRef.current;
        const returnId = returnFocusIdRef.current;
        const target = returnId
          ? Array.from(root?.querySelectorAll<HTMLElement>("[data-data-view-row-id]") ?? []).find(
              (element) => element.dataset.dataViewRowId === returnId
            )
          : null;
        (target ?? listContainerRef.current)?.focus();
      });
    }
  }, [mode, urlState.selected]);

  return (
    <div
      ref={setContainerRef}
      className="h-full min-h-0 min-w-0 [container-type:inline-size]"
      data-testid="data-view-root"
      data-layout-mode={mode}
    >
      <div
        className="flex h-full min-h-0 min-w-0 overflow-hidden rounded-lg border bg-background"
        data-testid={
          mode === "wide"
            ? "data-view-wide-layout"
            : mode === "medium"
              ? "data-view-medium-layout"
              : "data-view-narrow-layout"
        }
      >
        <motion.div
          key="master"
          animate={{ width: isSplit ? "clamp(280px, 30cqw, 320px)" : "100%" }}
          transition={reduceMotion ? { duration: 0 } : DETAIL_TRANSITION}
          style={reduceMotion ? undefined : { willChange: "width" }}
          className={cn(
            "h-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden bg-background",
            showMaster ? "flex" : "hidden",
            isSplit && "border-r"
          )}
          aria-hidden={!showMaster}
          data-motion={reduceMotion ? "reduced" : "full"}
        >
          {renderedMasterMode === "narrow" ? (
            <DataViewMobileLayout onOpenRow={handleOpenRow} listContainerRef={listContainerRef} />
          ) : (
            <DataViewDesktopMaster
              mode={renderedMasterMode}
              isSplit={mountedMasterIsSplit}
              onOpenRow={handleOpenRow}
              listContainerRef={listContainerRef}
            />
          )}
        </motion.div>

        {isDetailOpen ? (
          <motion.div
            key="detail"
            initial={reduceMotion ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : DETAIL_TRANSITION}
            style={reduceMotion ? undefined : { willChange: "transform, opacity" }}
            className={cn(
              "flex h-full min-h-0 min-w-0 overflow-hidden",
              isSplit ? "flex-1" : "w-full"
            )}
            data-testid={
              mode === "narrow"
                ? "data-view-mobile-detail"
                : mode === "medium"
                  ? "data-view-replacement-detail"
                  : undefined
            }
          >
            <DataViewDetail mode={isSplit ? "split" : "replacement"} focusRef={detailFocusRef} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
