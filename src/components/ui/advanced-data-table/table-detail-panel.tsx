"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableDetailPanelProps } from "./types";

export function TableDetailPanel<T>({
  row,
  onClose,
  renderDetail,
  columns,
}: TableDetailPanelProps<T>) {
  if (!row) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Content */}
      <ScrollArea className="flex-1">
        {renderDetail ? (
          renderDetail(row, onClose)
        ) : (
          <DefaultDetailView row={row} columns={columns} />
        )}
      </ScrollArea>
    </div>
  );
}

// Default detail view if no custom render provided
function DefaultDetailView({ row, columns }: { row: any; columns: any[] }) {
  return (
    <div className="space-y-4">
      {columns.map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return null;

        return (
          <div key={column.key} className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">{column.header}</dt>
            <dd className="text-sm">{column.render ? column.render(value, row) : String(value)}</dd>
          </div>
        );
      })}
    </div>
  );
}
