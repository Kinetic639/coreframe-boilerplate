"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ColumnConfig } from "./types";
import { useTableStore } from "./store/table-store";

interface TableSidebarProps<T = any> {
  data: T[];
  columns: ColumnConfig<T>[];
  onRowSelect: (row: T) => void;
  getRowId: (row: T) => string;
}

export function TableSidebar<T>({ data, columns, onRowSelect, getRowId }: TableSidebarProps<T>) {
  // Get selected row from Zustand store
  const selectedRow = useTableStore((state) => state.selectedRow);
  const primaryColumn = columns.find((col) => col.isPrimary) || columns[0];

  return (
    <motion.div
      initial={{ width: "100%" }}
      animate={{ width: "320px" }}
      exit={{ width: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col border-r bg-background"
    >
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Items ({data.length})</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {data.map((row) => {
            const rowId = getRowId(row);
            const isSelected = selectedRow && getRowId(selectedRow) === rowId;

            // Get primary column value for display
            const primaryValue = (row as any)[primaryColumn.key];
            const displayValue = primaryColumn.renderSidebar
              ? primaryColumn.renderSidebar(primaryValue, row)
              : primaryColumn.render
                ? primaryColumn.render(primaryValue, row)
                : primaryValue;

            return (
              <button
                key={rowId}
                onClick={() => onRowSelect(row)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  "hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
                  isSelected && "bg-muted"
                )}
              >
                <div className="min-w-0 flex-1">
                  {typeof displayValue === "string" ? (
                    <div className="truncate font-medium">{displayValue}</div>
                  ) : (
                    displayValue
                  )}

                  {/* Show secondary info from additional columns */}
                  {columns.slice(1, 3).map((col) => {
                    const value = (row as any)[col.key];
                    if (!value) return null;

                    return (
                      <div key={col.key} className="truncate text-xs text-muted-foreground">
                        {String(value)}
                      </div>
                    );
                  })}
                </div>

                {/* Selected indicator */}
                {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </motion.div>
  );
}
