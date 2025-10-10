"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  return (
    <AnimatePresence>
      {row && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex h-full flex-col border-l bg-background"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Details</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {renderDetail ? renderDetail(row) : <DefaultDetailView row={row} columns={columns} />}
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Default detail view if no custom render provided
function DefaultDetailView({ row, columns }: { row: any; columns: any[] }) {
  return (
    <div className="space-y-6">
      {columns.map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return null;

        return (
          <div key={column.key} className="space-y-1">
            <dt className="text-sm font-medium text-muted-foreground">{column.header}</dt>
            <dd className="text-sm">{column.render ? column.render(value, row) : String(value)}</dd>
          </div>
        );
      })}
    </div>
  );
}
