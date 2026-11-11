/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { dataViewKeys } from "@/components/data-view/data-view-query-keys";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import { useDataViewDetailQuery } from "@/components/data-view/use-data-view-query";
import type { InventoryProductDetail } from "@/lib/warehouse/inventory-types";
import { prefetchInventoryProductDetail } from "../prefetch-inventory-product-detail";

vi.mock("server-only", () => ({}));

const selectedId = "product-1::variant-9";
const scope = dataViewScope.branch("org-1", "branch-1");
const detail = {
  id: "product-1",
  name: "Hydrated product",
} as unknown as InventoryProductDetail;

function DetailProbe({ fetcher }: { fetcher: (id: string) => Promise<typeof detail> }) {
  const query = useDataViewDetailQuery({
    entity: "inventory-products",
    scope,
    selectedId,
    detailFetcher: fetcher,
  });
  return <div>{query.data?.name ?? "pending"}</div>;
}

describe("Products compound selection SSR", () => {
  it("fetches by product ID, hydrates under the full selection ID, and avoids a client repair", async () => {
    const serverQueryClient = new QueryClient();
    const serverFetcher = vi.fn().mockResolvedValue(detail);
    await prefetchInventoryProductDetail({
      queryClient: serverQueryClient,
      scope,
      selectedId,
      fetchProduct: serverFetcher,
    });

    expect(serverFetcher).toHaveBeenCalledWith("product-1");
    expect(
      serverQueryClient.getQueryData(dataViewKeys.detail("inventory-products", scope, selectedId))
    ).toEqual(detail);

    const browserQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const browserFetcher = vi.fn().mockResolvedValue(detail);
    render(
      <QueryClientProvider client={browserQueryClient}>
        <HydrationBoundary state={dehydrate(serverQueryClient)}>
          <DetailProbe fetcher={browserFetcher} />
        </HydrationBoundary>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Hydrated product")).toBeInTheDocument();
    await waitFor(() => expect(serverFetcher).toHaveBeenCalledTimes(1));
    expect(browserFetcher).not.toHaveBeenCalled();
  });
});
