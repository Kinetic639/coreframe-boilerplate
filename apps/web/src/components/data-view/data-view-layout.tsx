"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDataView } from "./use-data-view";
import { DataViewToolbar } from "./data-view-toolbar";
import { DataViewTable } from "./data-view-table";
import { DataViewSidebar } from "./data-view-sidebar";
import { DataViewDetail } from "./data-view-detail";
import { DataViewPagination } from "./data-view-pagination";

const FADE = { duration: 0.1 };
const DETAIL_SPRING = { type: "spring" as const, damping: 28, stiffness: 240 };
// Must match the fade duration so primaryOnly is still true while sidebar is fading in/out
const EXIT_PRIMARY_DELAY_MS = 200;

export function DataViewLayout() {
  const { isDetailOpen } = useDataView();

  /**
   * showOnlyPrimary — true while entering or exiting detail mode.
   *
   * Entering (list → detail):
   *   isDetailOpen flips to true → showOnlyPrimary becomes true in the same render.
   *   The table immediately drops to one column (no squash), then fades out while
   *   the sidebar fades in. Both happen at the narrow width.
   *
   * Exiting (detail → list):
   *   isDetailOpen flips to false → detail panel exits, sidebar fades out.
   *   showOnlyPrimary stays true via the timer, keeping the list at one column
   *   while the container expands back to full width.
   *   After EXIT_PRIMARY_DELAY_MS, showOnlyPrimary → false and all columns reappear.
   */
  const [showOnlyPrimary, setShowOnlyPrimary] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isDetailOpen) {
      // Entering detail: show only primary column immediately (same render as width change)
      setShowOnlyPrimary(true);
    } else {
      // Exiting detail: keep primary-only during the collapse/expand animation
      setShowOnlyPrimary(true);
      timerRef.current = setTimeout(() => {
        setShowOnlyPrimary(false);
      }, EXIT_PRIMARY_DELAY_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDetailOpen]);

  return (
    <div className="flex flex-col h-full overflow-hidden border rounded-lg bg-background">
      {/* Toolbar — stable min-height; switching modes must not change this height */}
      <DataViewToolbar />

      {/*
       * Body — flex-1 min-h-0 so the inner flex row can fill the remaining space.
       * min-h-0 is required to prevent the flex child from overflowing.
       */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/*
         * List panel — snaps between full-width (flex-1) and sidebar (w-72).
         * Content cross-fades to hide the instant class switch.
         * We avoid Framer Motion `layout` here because its FLIP scaleX transform
         * visually squashes column text during the resize.
         */}
        <div
          className={
            isDetailOpen
              ? "w-72 shrink-0 flex flex-col overflow-hidden"
              : "flex-1 flex flex-col overflow-hidden"
          }
        >
          <AnimatePresence initial={false}>
            {!isDetailOpen ? (
              <motion.div
                key="full-table"
                className="flex-1 flex flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
              >
                <DataViewTable primaryOnly={showOnlyPrimary} />
                <DataViewPagination />
              </motion.div>
            ) : (
              <motion.div
                key="sidebar"
                className="flex-1 h-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
              >
                <DataViewSidebar />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Detail panel — slides in from the right, fills remaining height */}
        <AnimatePresence>
          {isDetailOpen && (
            <motion.div
              key="detail-panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={DETAIL_SPRING}
              className="flex-1 h-full min-w-0 overflow-hidden"
            >
              <DataViewDetail />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
