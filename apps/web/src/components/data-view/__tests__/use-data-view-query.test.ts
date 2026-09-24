/**
 * @vitest-environment jsdom
 *
 * use-data-view-query — branch-aware query-key foundation (Zone 1 / Phase 2)
 *
 * Proves the contract in isolation, before any concrete consumer (Phase 3)
 * or the DataView provider wiring depends on it:
 *   - branchId participates in cache identity only.
 *   - branchId is never forwarded to listFetcher as part of the request payload.
 *   - omitting branchId preserves the exact pre-Phase-2 key shape.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  buildDataViewQueryKey,
  useDataViewListQuery,
  useDataViewSidebarInfiniteQuery,
} from "../use-data-view-query";
import type { DataViewListParams, PaginatedResult } from "../data-view.types";

describe("buildDataViewQueryKey", () => {
  const baseKey = ["locations"];

  it("appends branchId when provided", () => {
    expect(buildDataViewQueryKey(baseKey, "branch-a")).toEqual(["locations", "branch-a"]);
  });

  it("produces different keys for different branchId values", () => {
    const keyA = buildDataViewQueryKey(baseKey, "branch-a");
    const keyB = buildDataViewQueryKey(baseKey, "branch-b");
    expect(keyA).not.toEqual(keyB);
  });

  it("produces the same key for the same branchId (stable identity)", () => {
    expect(buildDataViewQueryKey(baseKey, "branch-a")).toEqual(
      buildDataViewQueryKey(baseKey, "branch-a")
    );
  });

  it("omits branchId entirely when undefined, preserving the exact base key", () => {
    const result = buildDataViewQueryKey(baseKey, undefined);
    expect(result).toEqual(["locations"]);
    expect(result).toBe(baseKey); // same reference — no unnecessary copy for the common case
  });

  it("omits branchId entirely when null (deterministic, same as undefined)", () => {
    expect(buildDataViewQueryKey(baseKey, null)).toEqual(buildDataViewQueryKey(baseKey, undefined));
  });

  it("does not mutate the input base key array", () => {
    const original = ["locations"];
    buildDataViewQueryKey(original, "branch-a");
    expect(original).toEqual(["locations"]);
  });
});

describe("useDataViewListQuery — branch-aware cache identity", () => {
  function makeWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return {
      queryClient,
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    };
  }

  const listParams: DataViewListParams = {
    search: "",
    sort: null,
    page: 1,
    pageSize: 20,
    filters: {},
  };

  const initialData: PaginatedResult<{ id: string }> = {
    rows: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
  };

  it("different branchId values produce different cache entries for identical params", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const listFetcher = vi.fn().mockResolvedValue(initialData);

    const { result: resultA } = renderHook(
      () =>
        useDataViewListQuery({
          queryKey: ["locations"],
          listFetcher,
          listParams,
          initialData,
          branchId: "branch-a",
        }),
      { wrapper }
    );
    const { result: resultB } = renderHook(
      () =>
        useDataViewListQuery({
          queryKey: ["locations"],
          listFetcher,
          listParams,
          initialData,
          branchId: "branch-b",
        }),
      { wrapper }
    );

    await waitFor(() => expect(resultA.current.isFetched).toBe(true));
    await waitFor(() => expect(resultB.current.isFetched).toBe(true));

    // Two distinct cache entries exist — one per branch — proving the query key differs.
    expect(queryClient.getQueryData(["locations", "branch-a", listParams])).toBeDefined();
    expect(queryClient.getQueryData(["locations", "branch-b", listParams])).toBeDefined();
  });

  it("branchId is never forwarded to listFetcher — cache identity only, not request payload", async () => {
    const { wrapper } = makeWrapper();
    const listFetcher = vi.fn().mockResolvedValue(initialData);

    const { result } = renderHook(
      () =>
        useDataViewListQuery({
          queryKey: ["locations"],
          listFetcher,
          listParams,
          initialData,
          branchId: "branch-a",
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(listFetcher).toHaveBeenCalledWith(listParams);
    expect(listFetcher).toHaveBeenCalledWith(
      expect.not.objectContaining({ branchId: expect.anything() })
    );
  });

  it("omitted branchId preserves the exact pre-Phase-2 query key shape", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const listFetcher = vi.fn().mockResolvedValue(initialData);

    const { result } = renderHook(
      () =>
        useDataViewListQuery({
          queryKey: ["tickets"],
          listFetcher,
          listParams,
          initialData,
          // branchId intentionally omitted — org-scoped screen
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(queryClient.getQueryData(["tickets", listParams])).toBeDefined();
  });
});

describe("useDataViewSidebarInfiniteQuery — branch-aware cache identity", () => {
  function makeWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return {
      queryClient,
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    };
  }

  const listParams: DataViewListParams = {
    search: "",
    sort: null,
    page: 1,
    pageSize: 20,
    filters: {},
  };

  // Deliberately mismatches listParams.page so useInfiniteQuery's own
  // seed-from-initialData short-circuit (canSeedFromInitialPage) is skipped —
  // these tests need a real fetch through queryFn to observe listFetcher's
  // actual call arguments, not just cache state seeded without a fetch.
  const initialPageData: PaginatedResult<{ id: string }> = {
    rows: [],
    totalCount: 0,
    page: 0,
    pageSize: 20,
  };

  const expectedSidebarKeySegment = {
    search: listParams.search,
    sort: listParams.sort,
    filters: listParams.filters,
    pageSize: listParams.pageSize,
  };

  it("different branchId values produce different sidebar cache entries for identical params", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const listFetcher = vi.fn().mockResolvedValue({ ...initialPageData, page: 1 });

    const { result: resultA } = renderHook(
      () =>
        useDataViewSidebarInfiniteQuery({
          queryKey: ["locations"],
          listFetcher,
          listParams,
          initialPageData,
          enabled: true,
          branchId: "branch-a",
        }),
      { wrapper }
    );
    const { result: resultB } = renderHook(
      () =>
        useDataViewSidebarInfiniteQuery({
          queryKey: ["locations"],
          listFetcher,
          listParams,
          initialPageData,
          enabled: true,
          branchId: "branch-b",
        }),
      { wrapper }
    );

    await waitFor(() => expect(resultA.current.isFetched).toBe(true));
    await waitFor(() => expect(resultB.current.isFetched).toBe(true));

    // Two distinct infinite-query cache entries exist — one per branch —
    // proving the sidebar query key differs, same as the list query.
    expect(
      queryClient.getQueryData(["locations", "branch-a", "sidebar", expectedSidebarKeySegment])
    ).toBeDefined();
    expect(
      queryClient.getQueryData(["locations", "branch-b", "sidebar", expectedSidebarKeySegment])
    ).toBeDefined();
  });

  it("branchId is never forwarded to the sidebar fetcher — cache identity only, not request payload", async () => {
    const { wrapper } = makeWrapper();
    const listFetcher = vi.fn().mockResolvedValue({ ...initialPageData, page: 1 });

    const { result } = renderHook(
      () =>
        useDataViewSidebarInfiniteQuery({
          queryKey: ["locations"],
          listFetcher,
          listParams,
          initialPageData,
          enabled: true,
          branchId: "branch-a",
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(listFetcher).toHaveBeenCalledWith({ ...listParams, page: listParams.page });
    expect(listFetcher).toHaveBeenCalledWith(
      expect.not.objectContaining({ branchId: expect.anything() })
    );
  });

  it("omitted branchId preserves the exact pre-Phase-2 sidebar query-key shape", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const listFetcher = vi.fn().mockResolvedValue({ ...initialPageData, page: 1 });

    const { result } = renderHook(
      () =>
        useDataViewSidebarInfiniteQuery({
          queryKey: ["tickets"],
          listFetcher,
          listParams,
          initialPageData,
          enabled: true,
          // branchId intentionally omitted — org-scoped screen
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(
      queryClient.getQueryData(["tickets", "sidebar", expectedSidebarKeySegment])
    ).toBeDefined();
  });
});
