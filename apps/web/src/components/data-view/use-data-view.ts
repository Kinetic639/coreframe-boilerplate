"use client";

import { useContext } from "react";
import { DataViewContext } from "./data-view-provider";

/**
 * Hook that exposes the DataView context.
 * Must be used inside a DataViewProvider.
 */
export function useDataView() {
  const ctx = useContext(DataViewContext);
  if (!ctx) {
    throw new Error("useDataView must be used within a DataViewProvider");
  }
  return ctx;
}
