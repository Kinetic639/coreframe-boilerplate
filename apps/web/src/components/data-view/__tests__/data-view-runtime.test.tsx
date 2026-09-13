/** @vitest-environment jsdom */

import React, { type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { DataViewListParams, DataViewScope, PaginatedResult } from "../data-view.types";
import { useDataViewDetailQuery, useDataViewListQuery } from "../use-data-view-query";

type Row = { id: string; label: string };

const baseParams: DataViewListParams = {
  search: "",
  sort: null,
  filters: {},
  page: 1,
  pageSize: 25,
};

function result(label: string, page = 1): PaginatedResult<Row> {
  return { rows: [{ id: label, label }], totalCount: 75, page, pageSize: 25 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 60_000 } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("DataView runtime query guarantees", () => {
  it("passes TanStack's AbortSignal and aborts an obsolete list request", async () => {
    const { wrapper } = createHarness();
    const signals: AbortSignal[] = [];
    const requests = new Map<string, ReturnType<typeof deferred<PaginatedResult<Row>>>>();
    const fetcher = vi.fn((params: DataViewListParams, context: { signal: AbortSignal }) => {
      signals.push(context.signal);
      const request = deferred<PaginatedResult<Row>>();
      requests.set(params.search, request);
      return request.promise;
    });

    const { rerender, unmount } = renderHook(
      ({ search }) =>
        useDataViewListQuery({
          entity: "runtime-list",
          scope: { projectId: "project-1" },
          listFetcher: fetcher,
          listParams: { ...baseParams, search },
        }),
      { initialProps: { search: "a" }, wrapper }
    );

    await waitFor(() => expect(requests.has("a")).toBe(true));
    rerender({ search: "ab" });
    await waitFor(() => expect(requests.has("ab")).toBe(true));
    expect(signals[0].aborted).toBe(true);

    unmount();
    expect(signals[1].aborted).toBe(true);
  });

  it("keeps the newest search/page result visible after hostile completions", async () => {
    const { wrapper } = createHarness();
    const pending = new Map<string, ReturnType<typeof deferred<PaginatedResult<Row>>>>();
    const fetcher = (params: DataViewListParams) => {
      const key = `${params.search}:${params.page}`;
      const request = deferred<PaginatedResult<Row>>();
      pending.set(key, request);
      return request.promise;
    };
    const { result: hook, rerender } = renderHook(
      ({ search, page }) =>
        useDataViewListQuery({
          entity: "runtime-list",
          scope: { projectId: "project-1" },
          listFetcher: fetcher,
          listParams: { ...baseParams, search, page },
        }),
      { initialProps: { search: "a", page: 1 }, wrapper }
    );

    await waitFor(() => expect(pending.has("a:1")).toBe(true));
    rerender({ search: "abc", page: 3 });
    await waitFor(() => expect(pending.has("abc:3")).toBe(true));
    await act(async () => pending.get("abc:3")!.resolve(result("newest", 3)));
    await waitFor(() => expect(hook.current.data?.rows[0].label).toBe("newest"));
    await act(async () => pending.get("a:1")!.resolve(result("obsolete", 1)));
    expect(hook.current.data?.rows[0].label).toBe("newest");
  });

  it("keeps C selected through an A→B→C detail race", async () => {
    const { wrapper } = createHarness();
    const pending = new Map<string, ReturnType<typeof deferred<Row | null>>>();
    const fetcher = (id: string) => {
      const request = deferred<Row | null>();
      pending.set(id, request);
      return request.promise;
    };
    const { result: hook, rerender } = renderHook(
      ({ selectedId }) =>
        useDataViewDetailQuery({
          entity: "runtime-detail",
          scope: { workspaceId: "workspace-2" },
          detailFetcher: fetcher,
          selectedId,
        }),
      { initialProps: { selectedId: "A" as string | null }, wrapper }
    );

    await waitFor(() => expect(pending.has("A")).toBe(true));
    rerender({ selectedId: "B" });
    await waitFor(() => expect(pending.has("B")).toBe(true));
    rerender({ selectedId: "C" });
    await waitFor(() => expect(pending.has("C")).toBe(true));

    await act(async () => pending.get("C")!.resolve({ id: "C", label: "Detail C" }));
    await waitFor(() => expect(hook.current.data?.id).toBe("C"));
    await act(async () => pending.get("A")!.resolve({ id: "A", label: "Detail A" }));
    await act(async () => pending.get("B")!.resolve({ id: "B", label: "Detail B" }));
    expect(hook.current.data?.id).toBe("C");
  });

  it("isolates A→B→C→A scopes and reuses the still-fresh A cache", async () => {
    const { wrapper } = createHarness();
    const calls: string[] = [];
    const fetchers = new Map<string, () => Promise<PaginatedResult<Row>>>();
    for (const id of ["A", "B", "C"]) {
      fetchers.set(id, async () => {
        calls.push(id);
        return result(`scope-${id}`);
      });
    }
    const { result: hook, rerender } = renderHook(
      ({ scope }: { scope: DataViewScope }) => {
        const id = String(scope.projectId);
        return useDataViewListQuery({
          entity: "scoped-runtime",
          scope,
          listFetcher: fetchers.get(id)!,
          listParams: baseParams,
        });
      },
      { initialProps: { scope: { projectId: "A" } }, wrapper }
    );

    await waitFor(() => expect(hook.current.data?.rows[0].label).toBe("scope-A"));
    rerender({ scope: { projectId: "B" } });
    await waitFor(() => expect(hook.current.data?.rows[0].label).toBe("scope-B"));
    rerender({ scope: { projectId: "C" } });
    await waitFor(() => expect(hook.current.data?.rows[0].label).toBe("scope-C"));
    rerender({ scope: { projectId: "A" } });
    await waitFor(() => expect(hook.current.data?.rows[0].label).toBe("scope-A"));
    expect(calls).toEqual(["A", "B", "C"]);
  });

  it("recovers from a detail error by opening another row", async () => {
    const { wrapper } = createHarness();
    const fetcher = vi.fn(async (id: string) => {
      if (id === "broken") throw new Error("temporary failure");
      return { id, label: `Detail ${id}` };
    });
    const { result: hook, rerender } = renderHook(
      ({ selectedId }) =>
        useDataViewDetailQuery({
          entity: "detail-recovery",
          scope: { projectId: "project-1" },
          detailFetcher: fetcher,
          selectedId,
        }),
      { initialProps: { selectedId: "broken" }, wrapper }
    );

    await waitFor(() => expect(hook.current.isError).toBe(true));
    rerender({ selectedId: "healthy" });
    await waitFor(() => expect(hook.current.data?.id).toBe("healthy"));
    expect(hook.current.isError).toBe(false);
  });

  it("retains good rows across a failed background refresh", async () => {
    const { wrapper } = createHarness();
    const fetcher = vi
      .fn<() => Promise<PaginatedResult<Row>>>()
      .mockResolvedValueOnce(result("stable"))
      .mockRejectedValueOnce(new Error("temporary failure"));
    const { result: hook } = renderHook(
      () =>
        useDataViewListQuery({
          entity: "background-recovery",
          scope: { projectId: "project-1" },
          listFetcher: fetcher,
          listParams: baseParams,
        }),
      { wrapper }
    );

    await waitFor(() => expect(hook.current.data?.rows[0].label).toBe("stable"));
    let refreshError: Error | null = null;
    await act(async () => {
      const refresh = await hook.current.refetch();
      refreshError = refresh.error;
    });
    expect(hook.current.data?.rows[0].label).toBe("stable");
    expect(refreshError).toEqual(new Error("temporary failure"));
  });
});
