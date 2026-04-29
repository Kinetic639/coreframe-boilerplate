"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataView } from "./use-data-view";

function getStorageKey(entity: string) {
  return `data-view:${entity}:columns`;
}

/**
 * useColumnVisibility — must be called ONCE per entity (in DataViewProvider)
 * and shared via context. Calling it in multiple components creates separate
 * React state instances that don't communicate with each other.
 */
export function useColumnVisibility(
  entity: string,
  columnKeys: string[]
): {
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: (key: string, visible: boolean) => void;
  resetColumnVisibility: () => void;
} {
  const [columnVisibility, setColumnVisibilityState] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(getStorageKey(entity));
        if (stored) return JSON.parse(stored) as Record<string, boolean>;
      }
    } catch {
      // ignore
    }
    return {};
  });

  // Sync from localStorage on mount (handles SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(entity));
      if (stored) setColumnVisibilityState(JSON.parse(stored) as Record<string, boolean>);
    } catch {
      // ignore
    }
  }, [entity]);

  const setColumnVisibility = useCallback(
    (key: string, visible: boolean) => {
      setColumnVisibilityState((prev) => {
        const next = { ...prev, [key]: visible };
        try {
          localStorage.setItem(getStorageKey(entity), JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [entity]
  );

  const resetColumnVisibility = useCallback(() => {
    setColumnVisibilityState({});
    try {
      localStorage.removeItem(getStorageKey(entity));
    } catch {
      // ignore
    }
  }, [entity]);

  // Merge with defaults (all visible unless explicitly hidden)
  const merged = { ...columnVisibility };
  for (const key of columnKeys) {
    if (!(key in merged)) merged[key] = true;
  }

  return { columnVisibility: merged, setColumnVisibility, resetColumnVisibility };
}

/** Column visibility popover — reads shared state from context. */
export function DataViewColumnManager() {
  const { entity, columns, columnVisibility, setColumnVisibility } = useDataView();
  const [open, setOpen] = useState(false);

  // entity is only needed for the aria-label; visibility comes from context
  void entity;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Manage columns"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground mb-2">Toggle columns</p>
          {columns.map((col) => {
            const visible = columnVisibility[col.key] ?? true;
            return (
              <label
                key={col.key}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted"
              >
                <Checkbox
                  checked={visible}
                  onCheckedChange={(checked) => setColumnVisibility(col.key, !!checked)}
                  aria-label={`Toggle column ${col.header}`}
                />
                <span className="text-sm">{col.header}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
