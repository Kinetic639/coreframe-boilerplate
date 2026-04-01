"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ColumnConfig } from "./types";
import { useTableStore } from "./store/table-store";
import { TableCheckbox } from "./components/table-checkbox";

interface TableMobileViewProps<T = any> {
  data: T[];
  columns: ColumnConfig<T>[];
  onRowClick: (row: T) => void;
  getRowId: (row: T) => string;
  selectable?: boolean;
}

export function TableMobileView<T>({
  data,
  columns,
  onRowClick,
  getRowId,
  selectable,
}: TableMobileViewProps<T>) {
  // Get state and actions from Zustand store
  const selectedRowIds = useTableStore((state) => state.selectedRowIds);
  const toggleRowSelection = useTableStore((state) => state.toggleRowSelection);

  // Get visible columns for mobile (limit to important ones)
  const mobileColumns = columns.filter((col) => col.showInMobile !== false).slice(0, 4);

  return (
    <div className="space-y-3">
      {data.map((row) => {
        const rowId = getRowId(row);
        const isSelected = selectedRowIds.has(rowId);

        return (
          <Card
            key={rowId}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => onRowClick(row)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Selection checkbox */}
                {selectable && (
                  <div className="flex items-center">
                    <TableCheckbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRowSelection(rowId)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Display columns */}
                {mobileColumns.map((column) => {
                  const value = (row as any)[column.key];
                  const displayValue = column.render ? column.render(value, row) : value;

                  return (
                    <div key={column.key} className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {column.header}:
                      </span>
                      <span className="text-right text-sm font-medium">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
