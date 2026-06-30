"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WarehouseImportReviewColumn<T> = {
  key: string;
  header: ReactNode;
  className?: string;
  render: (row: T, index: number) => ReactNode;
};

type WarehouseImportReviewTableProps<T> = {
  title: ReactNode;
  description?: ReactNode;
  toolbar?: ReactNode;
  rows: T[];
  columns: Array<WarehouseImportReviewColumn<T>>;
  rowKey: (row: T, index: number) => string;
  minWidth?: string;
  emptyMessage?: ReactNode;
};

export function WarehouseImportReviewTable<T>({
  title,
  description,
  toolbar,
  rows,
  columns,
  rowKey,
  minWidth = "min-w-[980px]",
  emptyMessage = "No rows to review.",
}: WarehouseImportReviewTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
        <div>
          <p className="font-medium">{title}</p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
      </div>
      <div className="overflow-auto">
        <table className={cn("text-sm", minWidth)}>
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("px-3 py-2 text-left", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t">
                <td
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                  colSpan={columns.length}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={rowKey(row, index)} className="border-t">
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-3 py-2", column.className)}>
                      {column.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
