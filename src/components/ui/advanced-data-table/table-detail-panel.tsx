"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
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
      {/* Compact Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Details</h2>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {renderDetail ? renderDetail(row) : <DefaultDetailView row={row} columns={columns} />}
        </div>
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
