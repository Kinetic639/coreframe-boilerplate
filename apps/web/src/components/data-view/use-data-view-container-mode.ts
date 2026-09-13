"use client";

import { useLayoutEffect, useRef, useState } from "react";

export const DATA_VIEW_TABLE_MIN_WIDTH = 560;
export const DATA_VIEW_SPLIT_MIN_WIDTH = 840;

export type DataViewLayoutMode = "wide" | "medium" | "narrow";

export function getDataViewLayoutMode(width: number): DataViewLayoutMode {
  if (width >= DATA_VIEW_SPLIT_MIN_WIDTH) return "wide";
  if (width >= DATA_VIEW_TABLE_MIN_WIDTH) return "medium";
  return "narrow";
}

export function useDataViewContainerMode() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<DataViewLayoutMode>("wide");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const update = (width: number) => {
      if (width > 0)
        setMode((current) => {
          const next = getDataViewLayoutMode(width);
          return current === next ? current : next;
        });
    };

    update(container.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return { containerRef, mode };
}
