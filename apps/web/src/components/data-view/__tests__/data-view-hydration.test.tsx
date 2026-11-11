/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { DataViewListParams, PaginatedResult } from "../data-view.types";
import { dataViewKeys } from "../data-view-query-keys";
import type { DataViewScope } from "../data-view.types";
import { useDataViewListQuery } from "../use-data-view-query";

type Row = { id: string; name: string };

const params: DataViewListParams = {
  search: "",
  sort: null,
  page: 1,
  pageSize: 50,
  filters: {},
};

const result: PaginatedResult<Row> = {
  rows: [{ id: "row-1", name: "Hydrated row" }],
  totalCount: 1,
  page: 1,
  pageSize: 50,
};
const scopeA = { tenantId: "tenant-1", partitionId: "partition-a" };

function ListProbe({
  fetcher,
  initialData,
  initialDataUpdatedAt,
  scope = scopeA,
}: {
  fetcher: (input: DataViewListParams) => Promise<typeof result>;
  initialData?: PaginatedResult<Row>;
  initialDataUpdatedAt?: number;
  scope?: DataViewScope;
}) {
  const query = useDataViewListQuery({
    entity: "hydration-test",
    scope,
    listFetcher: fetcher,
    listParams: params,
    initialData,
    initialDataUpdatedAt,
  });
  return <div>{query.data?.rows[0]?.name ?? "pending"}</div>;
}

describe("DataView SSR hydration contract", () => {
  it("consumes a fresh canonical server query without an immediate client fetch", async () => {
    const serverQueryClient = new QueryClient();
    const serverFetcher = vi.fn().mockResolvedValue(result);
    await serverQueryClient.prefetchQuery({
      queryKey: dataViewKeys.list("hydration-test", scopeA, params),
      queryFn: serverFetcher,
    });

    const browserQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const browserFetcher = vi.fn().mockResolvedValue(result);

    render(
      <QueryClientProvider client={browserQueryClient}>
        <HydrationBoundary state={dehydrate(serverQueryClient)}>
          <ListProbe fetcher={browserFetcher} />
        </HydrationBoundary>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Hydrated row")).toBeInTheDocument();
    await waitFor(() => expect(serverFetcher).toHaveBeenCalledTimes(1));
    expect(browserFetcher).not.toHaveBeenCalled();
  });

  it("immediately retries an explicitly stale fallback after an SSR list failure", async () => {
    const browserQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const recoveredResult = {
      ...result,
      rows: [{ id: "row-2", name: "Recovered row" }],
    };
    const browserFetcher = vi.fn().mockResolvedValue(recoveredResult);

    render(
      <QueryClientProvider client={browserQueryClient}>
        <ListProbe
          fetcher={browserFetcher}
          initialData={{ ...result, rows: [], totalCount: 0 }}
          initialDataUpdatedAt={0}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Recovered row")).toBeInTheDocument();
    expect(browserFetcher).toHaveBeenCalledTimes(1);
  });

  it("never returns one scope's cache data for an identical query in another scope", async () => {
    const serverQueryClient = new QueryClient();
    await serverQueryClient.prefetchQuery({
      queryKey: dataViewKeys.list("hydration-test", scopeA, params),
      queryFn: async () => result,
    });
    const scopeB = { tenantId: "tenant-1", partitionId: "partition-b" };
    const scopeBResult = {
      ...result,
      rows: [{ id: "row-b", name: "Branch B row" }],
    };
    const browserFetcher = vi.fn().mockResolvedValue(scopeBResult);
    const browserQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={browserQueryClient}>
        <HydrationBoundary state={dehydrate(serverQueryClient)}>
          <ListProbe fetcher={browserFetcher} scope={scopeB} />
        </HydrationBoundary>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Branch B row")).toBeInTheDocument();
    expect(screen.queryByText("Hydrated row")).not.toBeInTheDocument();
    expect(browserFetcher).toHaveBeenCalledTimes(1);
  });
});
