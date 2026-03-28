import React from "react";

import type { HookResult } from "@/lib/queries/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props<T> {
  result: HookResult<T>;
  /** Rendered while kind="loading". Defaults to null if omitted. */
  loading?: React.ReactNode;
  /** Rendered when kind="forbidden". Defaults to null if omitted. */
  forbidden?: React.ReactNode;
  /** Rendered when kind="empty". Defaults to null if omitted. */
  empty?: React.ReactNode;
  /**
   * Called with the error message when kind="error".
   * Defaults to null if omitted.
   */
  error?: (message: string) => React.ReactNode;
  /**
   * Called with the resolved data when kind="data".
   * Required — this is the primary success render path.
   */
  children: (data: T) => React.ReactNode;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Branches on HookResult.kind and renders the matching slot.
 *
 * Centralises the standard loading / forbidden / empty / error / data
 * rendering pattern so feature screens do not each inline the same switch.
 *
 * Slots are optional except `children`. Omitting a slot renders nothing for
 * that state — callers can choose which states need visible UI.
 *
 * Mobile-local. Not a generic abstraction — do not reuse in web.
 */
export function QueryStateRenderer<T>({
  result,
  loading,
  forbidden,
  empty,
  error,
  children,
}: Props<T>): React.ReactElement | null {
  switch (result.kind) {
    case "loading":
      return <>{loading ?? null}</>;
    case "forbidden":
      return <>{forbidden ?? null}</>;
    case "empty":
      return <>{empty ?? null}</>;
    case "error":
      return <>{error ? error(result.message) : null}</>;
    case "data":
      return <>{children(result.data)}</>;
  }
}
