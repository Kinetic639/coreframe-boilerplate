"use client";

import React from "react";
import { cn } from "@/utils";
import { useDataView } from "./use-data-view";

/**
 * Compact sidebar list shown in detail mode.
 *
 * Always renders only the primary (first visible) column — no subtitle/category.
 * Row height matches table rows so the layout stays visually stable when
 * transitioning between full-table and sidebar mode.
 * renderCompactItem is intentionally ignored here to preserve consistent row height.
 */
export function DataViewSidebar() {
  const { listData, urlState, getRowId, columns } = useDataView();

  const primaryCol = columns[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky header — same height as the table <thead> row so rows don't jump */}
      <div className="shrink-0 border-b bg-muted/40 px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {primaryCol?.header ?? "Name"}
      </div>

      <div className="flex-1 overflow-y-auto">
        {listData.rows.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No results
          </div>
        ) : (
          <ul role="list">
            {listData.rows.map((row) => {
              const id = getRowId(row);
              const isSelected = urlState.selected === id;

              return (
                <li key={id}>
                  <button
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b text-sm hover:bg-muted/50 transition-colors truncate",
                      isSelected &&
                        "bg-muted font-medium border-l-2 border-l-primary pl-[calc(0.75rem-2px)]"
                    )}
                    onClick={() => urlState.setSelected(id)}
                    aria-selected={isSelected}
                    data-testid={`sidebar-item-${id}`}
                  >
                    {primaryCol ? (
                      <span className="truncate block">{primaryCol.accessor(row)}</span>
                    ) : (
                      id
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
