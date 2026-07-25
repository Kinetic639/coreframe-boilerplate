"use client";

import * as React from "react";
import type { VmiPortalOrderDto, VmiPortalResult } from "./types";

export interface CreateVmiOrderInput {
  locationId: string;
  notes?: string;
  lines: Array<{
    inventoryItemId: string;
    requestedQty: number;
  }>;
}

export function useCreateVmiOrder() {
  const [isPending, setIsPending] = React.useState(false);
  const [result, setResult] = React.useState<VmiPortalResult<VmiPortalOrderDto> | null>(null);

  const createOrder = React.useCallback(async (input: CreateVmiOrderInput) => {
    setIsPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/portal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as VmiPortalResult<VmiPortalOrderDto>;
      setResult(payload);
      return payload;
    } catch {
      const errorResult = { success: false, error: "Nie udało się połączyć z portalem VMI." } as const;
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    createOrder,
    isPending,
    result,
  };
}
